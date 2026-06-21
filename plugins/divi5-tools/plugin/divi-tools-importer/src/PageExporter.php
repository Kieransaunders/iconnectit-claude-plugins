<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exports a Divi 5 page's raw block content, registered presets, and global
 * colours so the generator can read the exact attribute structure Divi uses
 * internally (e.g. for buttons, fonts) rather than inferring from screenshots.
 *
 * GET /wp-json/divi-tools/v1/export?id=<page_id>
 * GET /wp-json/divi-tools/v1/export?slug=<post_slug>
 *
 * Returns:
 *   post_id        int
 *   title          string
 *   slug           string
 *   content        string   raw post_content from DB (block markup)
 *   presets        object   Divi 5 module presets keyed by module name
 *   global_colors  array    registered global colour entries
 *   meta           object   relevant post meta (_et_pb_*, _wp_page_template)
 */
class DTI_PageExporter {

	/**
	 * @return array<string,mixed>
	 * @throws InvalidArgumentException
	 * @throws RuntimeException
	 */
	public static function export( int $post_id = 0, string $slug = '' ): array {
		// ── 1. Resolve the post ──────────────────────────────────────────────
		if ( $post_id > 0 ) {
			$post = get_post( $post_id );
		} elseif ( $slug !== '' ) {
			$post = get_page_by_path( sanitize_title( $slug ), OBJECT, array( 'page', 'post' ) );
		} else {
			throw new InvalidArgumentException( 'Provide id or slug.' );
		}

		if ( ! $post ) {
			throw new InvalidArgumentException( 'Post not found.' );
		}

		// ── 2. Raw content direct from DB (bypasses wpautop / kses) ─────────
		global $wpdb;
		$raw = $wpdb->get_var( $wpdb->prepare(
			'SELECT post_content FROM %i WHERE ID = %d',
			$wpdb->posts,
			$post->ID
		) );

		// ── 3. Divi 5 presets ────────────────────────────────────────────────
		$presets      = array();
		$preset_class = 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset';
		if ( class_exists( $preset_class ) && method_exists( $preset_class, 'get_data' ) ) {
			$presets = $preset_class::get_data();
		}

		// ── 4. Global colours ────────────────────────────────────────────────
		$colors      = array();
		$data_class  = 'ET\\Builder\\Packages\\GlobalData\\GlobalData';
		if ( class_exists( $data_class ) && method_exists( $data_class, 'get_global_colors' ) ) {
			$colors = $data_class::get_global_colors();
		}

		// ── 5. Relevant post meta ────────────────────────────────────────────
		$meta_keys = array(
			'_et_pb_use_builder',
			'_et_pb_use_divi_5',
			'_et_pb_page_layout',
			'_wp_page_template',
			'_et_pb_built_for_post_type',
		);
		$meta = array();
		foreach ( $meta_keys as $k ) {
			$v = get_post_meta( $post->ID, $k, true );
			if ( $v !== '' && $v !== false ) {
				$meta[ $k ] = $v;
			}
		}

		return array(
			'post_id'      => $post->ID,
			'title'        => $post->post_title,
			'slug'         => $post->post_name,
			'status'       => $post->post_status,
			'content'      => $raw,
			'presets'      => $presets,
			'global_colors' => $colors,
			'meta'         => $meta,
		);
	}
}
