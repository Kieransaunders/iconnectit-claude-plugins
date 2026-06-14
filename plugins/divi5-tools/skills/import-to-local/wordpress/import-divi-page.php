<?php
/**
 * import-divi-page.php — import a Divi 5 et_builder JSON export as a WordPress page.
 *
 * Run via WP-CLI:
 *   wp eval-file import-divi-page.php <layout.json> [<seo-meta.json>] [--publish]
 *
 * Behaviour:
 *   - Creates a DRAFT page keyed on slug; re-runs with the same slug UPDATE the same
 *     draft (no page litter). Publishes only when --publish is passed.
 *   - Imports presets via Divi 5's own importer and rewrites remapped preset IDs in
 *     the content (GlobalPreset::process_presets_for_import returns preset_id_mappings).
 *   - Imports global colours via Divi's converter (tuple export format -> assoc map,
 *     merged with existing colours), and global variables when present.
 *   - Sets _et_pb_use_builder / _et_pb_use_divi_5, page title + slug from seo-meta,
 *     and Yoast/RankMath meta when those plugins are active.
 *   - Prints a JSON report on the last line of output (prefix: IMPORT_REPORT:).
 *
 * Verified against Divi 5.0.0-public-beta.9.1 source:
 *   ET\Builder\Packages\GlobalData\GlobalPreset::process_presets_for_import()
 *   ET\Builder\Packages\GlobalData\GlobalData::get_imported_global_colors()
 *   ET\Builder\Packages\GlobalData\GlobalData::set_global_colors()
 *   ET\Builder\Packages\GlobalData\GlobalData::import_global_variables()
 */

if ( ! defined( 'WP_CLI' ) ) {
	fwrite( STDERR, "This script must be run via: wp eval-file import-divi-page.php <layout.json>\n" );
	exit( 1 );
}

$warnings = array();
$publish  = in_array( '--publish', $args, true );
$file_args = array_values( array_filter( $args, static function ( $a ) {
	return '--publish' !== $a;
} ) );

if ( empty( $file_args[0] ) ) {
	WP_CLI::error( 'Usage: wp eval-file import-divi-page.php <layout.json> [<seo-meta.json>] [--publish]' );
}

// ---------------------------------------------------------------------------
// 1. Load and sanity-check the export JSON.
// ---------------------------------------------------------------------------
$layout_path = $file_args[0];
if ( ! file_exists( $layout_path ) ) {
	WP_CLI::error( "Layout file not found: $layout_path" );
}
$layout = json_decode( file_get_contents( $layout_path ), true );
if ( ! is_array( $layout ) ) {
	WP_CLI::error( "Could not parse JSON: $layout_path" );
}
if ( ( $layout['context'] ?? '' ) !== 'et_builder' ) {
	WP_CLI::error( "Expected context 'et_builder', got '" . ( $layout['context'] ?? 'none' ) . "'. Library exports (et_builder_layouts) are not page imports." );
}
if ( empty( $layout['data'] ) || ! is_array( $layout['data'] ) ) {
	WP_CLI::error( 'Export has no data map.' );
}
$content = reset( $layout['data'] ); // First (normally only) entry is the page content string.
if ( ! is_string( $content ) || false === strpos( $content, 'wp:divi/placeholder' ) ) {
	WP_CLI::error( 'Page content missing the divi/placeholder wrapper — refusing to import.' );
}

// Optional SEO meta.
$seo = array();
if ( ! empty( $file_args[1] ) ) {
	if ( ! file_exists( $file_args[1] ) ) {
		WP_CLI::error( 'SEO meta file not found: ' . $file_args[1] );
	}
	$seo = json_decode( file_get_contents( $file_args[1] ), true );
	if ( ! is_array( $seo ) ) {
		WP_CLI::error( 'Could not parse SEO meta JSON: ' . $file_args[1] );
	}
}

// ---------------------------------------------------------------------------
// 2. Confirm Divi 5 internals are available.
// ---------------------------------------------------------------------------
$preset_class = 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset';
$data_class   = 'ET\\Builder\\Packages\\GlobalData\\GlobalData';
$d5_available = class_exists( $preset_class ) && method_exists( $preset_class, 'process_presets_for_import' );

if ( ! $d5_available ) {
	$warnings[] = 'Divi 5 import helpers were not found. Confirm Divi 5 is installed and active in this Local site. Importing content only (no presets/global colours).';
}

// ---------------------------------------------------------------------------
// 3. Import presets FIRST (their ID mappings rewrite the content).
// ---------------------------------------------------------------------------
$presets_imported = false;
if ( $d5_available && ! empty( $layout['presets'] ) && is_array( $layout['presets'] ) ) {
	$result = $preset_class::process_presets_for_import( $layout['presets'] ); // auto-saves.
	if ( ! empty( $result['preset_id_mappings'] ) && is_array( $result['preset_id_mappings'] ) ) {
		foreach ( $result['preset_id_mappings'] as $old_id => $new_id ) {
			if ( is_string( $old_id ) && is_string( $new_id ) && $old_id !== $new_id ) {
				$content = str_replace( $old_id, $new_id, $content );
			}
		}
	}
	$presets_imported = true;
} elseif ( empty( $layout['presets'] ) ) {
	$warnings[] = 'Export contains no presets.';
}

// ---------------------------------------------------------------------------
// 4. Global colours and variables (Divi's own converters, merge semantics).
// ---------------------------------------------------------------------------
$colors_imported = false;
if ( $d5_available && ! empty( $layout['global_colors'] ) && is_array( $layout['global_colors'] ) ) {
	if ( method_exists( $data_class, 'get_imported_global_colors' ) && method_exists( $data_class, 'set_global_colors' ) ) {
		$converted = $data_class::get_imported_global_colors( $layout['global_colors'] );
		if ( is_array( $converted ) && ! empty( $converted ) ) {
			$data_class::set_global_colors( $converted, true ); // true => sanitized + merged with existing.
			$colors_imported = true;
		}
	} else {
		$warnings[] = 'GlobalData colour import methods not found — global colours skipped.';
	}
}

$variables_imported = false;
if ( $d5_available && ! empty( $layout['global_variables'] ) && is_array( $layout['global_variables'] ) ) {
	if ( method_exists( $data_class, 'import_global_variables' ) ) {
		$data_class::import_global_variables( $layout['global_variables'] );
		$variables_imported = true;
	} else {
		$warnings[] = 'GlobalData::import_global_variables not found — global variables skipped.';
	}
}

// ---------------------------------------------------------------------------
// 5. Create or update the draft page (keyed on slug).
// ---------------------------------------------------------------------------
$title = $seo['title'] ?? $seo['pageTitle'] ?? null;
if ( ! $title && preg_match( '/"content":"([^"]{1,120})/', $content, $m ) ) {
	$title = wp_strip_all_tags( stripslashes( $m[1] ) );
}
$title = $title ?: 'Generated Landing Page ' . gmdate( 'Y-m-d H:i' );

$slug = $seo['slug'] ?? sanitize_title( $title );

$existing = get_page_by_path( $slug, OBJECT, 'page' );
$postarr  = array(
	'post_type'    => 'page',
	'post_title'   => $title,
	'post_name'    => $slug,
	'post_content' => $content,
	'post_status'  => $publish ? 'publish' : 'draft',
);

if ( $existing ) {
	$postarr['ID'] = $existing->ID;
	// Never silently publish an existing draft unless asked.
	if ( ! $publish ) {
		$postarr['post_status'] = $existing->post_status === 'publish' ? 'publish' : 'draft';
	}
	$page_id = wp_update_post( wp_slash( $postarr ), true );
	$action  = 'updated';
} else {
	$page_id = wp_insert_post( wp_slash( $postarr ), true );
	$action  = 'created';
}

if ( is_wp_error( $page_id ) ) {
	WP_CLI::error( 'Page save failed: ' . $page_id->get_error_message() );
}

update_post_meta( $page_id, '_et_pb_use_builder', 'on' );
update_post_meta( $page_id, '_et_pb_use_divi_5', 'on' );

// ---------------------------------------------------------------------------
// 6. SEO plugin meta (best effort).
// ---------------------------------------------------------------------------
$seo_plugin = 'none';
$meta_title = $seo['titleTag'] ?? $seo['title'] ?? null;
$meta_desc  = $seo['metaDescription'] ?? $seo['description'] ?? null;
if ( $meta_title || $meta_desc ) {
	if ( defined( 'WPSEO_VERSION' ) ) {
		$seo_plugin = 'yoast';
		if ( $meta_title ) { update_post_meta( $page_id, '_yoast_wpseo_title', $meta_title ); }
		if ( $meta_desc ) { update_post_meta( $page_id, '_yoast_wpseo_metadesc', $meta_desc ); }
	} elseif ( class_exists( 'RankMath' ) ) {
		$seo_plugin = 'rankmath';
		if ( $meta_title ) { update_post_meta( $page_id, 'rank_math_title', $meta_title ); }
		if ( $meta_desc ) { update_post_meta( $page_id, 'rank_math_description', $meta_desc ); }
	} else {
		$warnings[] = 'No SEO plugin detected — set the title tag and meta description manually: '
			. wp_json_encode( array( 'title' => $meta_title, 'description' => $meta_desc ) );
	}
}

// ---------------------------------------------------------------------------
// 7. Report.
// ---------------------------------------------------------------------------
$report = array(
	'action'             => $action,
	'pageId'             => $page_id,
	'status'             => get_post_status( $page_id ),
	'slug'               => $slug,
	'previewUrl'         => get_preview_post_link( $page_id ),
	'editUrl'            => admin_url( 'post.php?post=' . $page_id . '&action=edit' ),
	'builderUrl'         => add_query_arg( array( 'p' => $page_id, 'et_fb' => '1' ), home_url( '/' ) ),
	'presetsImported'    => $presets_imported,
	'colorsImported'     => $colors_imported,
	'variablesImported'  => $variables_imported,
	'seoPlugin'          => $seo_plugin,
	'warnings'           => $warnings,
);

WP_CLI::log( 'IMPORT_REPORT:' . wp_json_encode( $report ) );
WP_CLI::success( ucfirst( $action ) . " page #$page_id ('$slug', " . get_post_status( $page_id ) . ')' );
