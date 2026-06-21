<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_PageImporter {

	/**
	 * Import a Divi 5 et_builder JSON export as a WordPress page.
	 *
	 * @param array $layout  Parsed et_builder export array.
	 * @param array $seo     SEO meta (title, description, slug).
	 * @param bool  $publish Create as published rather than draft.
	 * @return array{page_id:int, action:string, slug:string, warnings:string[], seo_plugin:string, preview_url:string, edit_url:string}
	 */
	public static function import( array $layout, array $seo, bool $publish = false ): array {
		$warnings = array();

		// -----------------------------------------------------------------------
		// 1. Validate the export shape.
		// -----------------------------------------------------------------------
		if ( ( $layout['context'] ?? '' ) !== 'et_builder' ) {
			throw new InvalidArgumentException(
				"Expected context 'et_builder', got '" . ( $layout['context'] ?? 'none' ) . "'. " .
				"Library exports (et_builder_layouts) cannot be used as page imports."
			);
		}
		if ( empty( $layout['data'] ) || ! is_array( $layout['data'] ) ) {
			throw new InvalidArgumentException( 'Export has no data map.' );
		}
		$content = reset( $layout['data'] );
		if ( ! is_string( $content ) || false === strpos( $content, 'wp:divi/placeholder' ) ) {
			throw new InvalidArgumentException( 'Page content is missing the divi/placeholder wrapper.' );
		}

		// -----------------------------------------------------------------------
		// 2. Divi 5 internals availability.
		// -----------------------------------------------------------------------
		$preset_class = 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset';
		$data_class   = 'ET\\Builder\\Packages\\GlobalData\\GlobalData';
		$d5_available = class_exists( $preset_class )
			&& method_exists( $preset_class, 'process_presets_for_import' );

		if ( ! $d5_available ) {
			$warnings[] = 'Divi 5 import helpers not found — ensure Divi 5 is active. Importing content only (no presets or global colours).';
		}

		// -----------------------------------------------------------------------
		// 3. Import presets (their ID mappings rewrite the content string).
		// -----------------------------------------------------------------------
		$presets_imported = false;
		if ( $d5_available && ! empty( $layout['presets'] ) && is_array( $layout['presets'] ) ) {
			$result = $preset_class::process_presets_for_import( $layout['presets'] );
			if ( ! empty( $result['preset_id_mappings'] ) ) {
				foreach ( $result['preset_id_mappings'] as $old => $new ) {
					if ( is_string( $old ) && is_string( $new ) && $old !== $new ) {
						$content = str_replace( $old, $new, $content );
					}
				}
			}
			$presets_imported = true;
			// Mirror what GlobalPreset::save_data() does: clear Divi's CSS cache so
			// newly imported preset IDs get their CSS rules generated on next load.
			if ( class_exists( 'ET_Core_PageResource' ) ) {
				ET_Core_PageResource::remove_static_resources( 'all', 'all', true, 'all', true );
			}
		} elseif ( empty( $layout['presets'] ) ) {
			$warnings[] = 'Export contains no presets.';
		}

		// -----------------------------------------------------------------------
		// 4. Global colours + variables.
		// -----------------------------------------------------------------------
		$colors_imported = false;
		if ( $d5_available && ! empty( $layout['global_colors'] ) && is_array( $layout['global_colors'] ) ) {
			if ( method_exists( $data_class, 'get_imported_global_colors' )
				&& method_exists( $data_class, 'set_global_colors' ) ) {
				$converted = $data_class::get_imported_global_colors( $layout['global_colors'] );
				if ( is_array( $converted ) && ! empty( $converted ) ) {
					$data_class::set_global_colors( $converted, true );
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

		// -----------------------------------------------------------------------
		// 5. Resolve title + slug.
		// -----------------------------------------------------------------------
		$title = $seo['titleTag'] ?? $seo['title'] ?? '';
		if ( ! $title ) {
			// Try to extract from content as last resort.
			if ( preg_match( '/"content":"([^"]{1,120})/', $content, $m ) ) {
				$title = wp_strip_all_tags( stripslashes( $m[1] ) );
			}
		}
		$title = $title ?: 'Imported Page ' . gmdate( 'Y-m-d H:i' );
		$slug  = $seo['slug'] ?? sanitize_title( $title );

		// -----------------------------------------------------------------------
		// 6. Create or update the page.
		// -----------------------------------------------------------------------
		$existing = get_page_by_path( $slug, OBJECT, 'page' );
		$postarr  = array(
			'post_type'   => 'page',
			'post_title'  => sanitize_text_field( $title ),
			'post_name'   => sanitize_title( $slug ),
			'post_status' => $publish ? 'publish' : 'draft',
		);

		if ( $existing ) {
			$postarr['ID'] = $existing->ID;
			if ( ! $publish ) {
				$postarr['post_status'] = ( $existing->post_status === 'publish' ) ? 'publish' : 'draft';
			}
			$page_id = wp_update_post( wp_slash( $postarr ), true );
			$action  = 'updated';
		} else {
			$page_id = wp_insert_post( wp_slash( $postarr ), true );
			$action  = 'created';
		}

		if ( is_wp_error( $page_id ) ) {
			throw new RuntimeException( 'Page save failed: ' . $page_id->get_error_message() );
		}

		// Write Divi 5 block markup directly to bypass wp_kses_post() / balanceTags(),
		// which corrupt block comment delimiters when JSON values contain HTML tags.
		global $wpdb;
		$wpdb->update( $wpdb->posts, array( 'post_content' => $content ), array( 'ID' => $page_id ) );
		clean_post_cache( $page_id );

		// Clear the page-specific Divi CSS cache. Divi generates per-page preset CSS
		// in et-cache/{post_id}/et-core-unified-{post_id}.min.css — if a stale file
		// exists from a previous import with different preset IDs, the new preset
		// classes won't render until the cache is regenerated.
		self::clear_page_css_cache( $page_id );

		update_post_meta( $page_id, '_et_pb_use_builder', 'on' );
		update_post_meta( $page_id, '_et_pb_use_divi_5', 'on' );
		update_post_meta( $page_id, '_wp_page_template', 'page-template-blank.php' );
		update_post_meta( $page_id, '_et_pb_page_layout', 'et_full_width_page' );
		update_post_meta( $page_id, '_et_pb_built_for_post_type', array( 'page' ) );

		// -----------------------------------------------------------------------
		// 7. SEO meta.
		// -----------------------------------------------------------------------
		$seo_plugin = DTI_SeoWriter::write( $page_id, $seo );
		if ( $seo_plugin === 'none' && ( ! empty( $seo['titleTag'] ) || ! empty( $seo['title'] ) ) ) {
			$warnings[] = 'No Yoast or RankMath detected — SEO values stored in post meta (dti_seo_title / dti_seo_description). Set them manually in your SEO plugin.';
		}

		return [
			'page_id'            => $page_id,
			'action'             => $action,
			'slug'               => $slug,
			'status'             => get_post_status( $page_id ),
			'preview_url'        => get_preview_post_link( $page_id ),
			'edit_url'           => admin_url( 'post.php?post=' . $page_id . '&action=edit' ),
			'builder_url'        => add_query_arg( [ 'p' => $page_id, 'et_fb' => '1' ], home_url( '/' ) ),
			'presets_imported'   => $presets_imported,
			'colors_imported'    => $colors_imported,
			'variables_imported' => $variables_imported,
			'seo_plugin'         => $seo_plugin,
			'warnings'           => $warnings,
		];
	}

	/**
	 * Delete the page-specific Divi CSS cache files so preset classes are regenerated
	 * on next page load. Divi writes per-page CSS into:
	 *   et-cache/{post_id}/et-core-unified-{post_id}.min.css
	 *   et-cache/{post_id}/et-core-unified-deferred-{post_id}.min.css
	 * These are NOT cleared by ET_Core_PageResource::remove_static_resources() — that
	 * only clears the global/builder cache, not the rendered page CSS.
	 */
	private static function clear_page_css_cache( int $post_id ): void {
		$cache_dir = WP_CONTENT_DIR . '/et-cache/' . $post_id;
		if ( ! is_dir( $cache_dir ) ) {
			return;
		}
		$files = glob( $cache_dir . '/*.css' );
		if ( $files ) {
			foreach ( $files as $file ) {
				@unlink( $file );
			}
		}
	}
}
