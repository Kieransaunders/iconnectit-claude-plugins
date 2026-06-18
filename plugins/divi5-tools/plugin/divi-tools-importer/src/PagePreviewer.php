<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_PagePreviewer {

	const PREVIEW_SLUG  = 'dti-live-preview';
	const PREVIEW_TITLE = 'DTI Live Preview';

	/**
	 * Create or update the fixed preview page with the supplied Divi 5 layout.
	 *
	 * Imports presets and global colours so Divi renders with the correct design
	 * system. The page is always kept as a draft and never appears in navigation.
	 *
	 * @param array $layout  Parsed et_builder export array.
	 * @return array{preview_url:string, page_id:int, action:string, warnings:string[]}
	 */
	public static function preview( array $layout ): array {
		$warnings = array();

		// -----------------------------------------------------------------------
		// 1. Validate the export shape (same rules as PageImporter).
		// -----------------------------------------------------------------------
		if ( ( $layout['context'] ?? '' ) !== 'et_builder' ) {
			throw new InvalidArgumentException(
				"Expected context 'et_builder', got '" . ( $layout['context'] ?? 'none' ) . "'. " .
				"Library exports (et_builder_layouts) cannot be used here."
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
			$warnings[] = 'Divi 5 import helpers not found — presets and global colours skipped.';
		}

		// -----------------------------------------------------------------------
		// 3. Import presets so the preview renders with the correct design tokens.
		// -----------------------------------------------------------------------
		if ( $d5_available && ! empty( $layout['presets'] ) && is_array( $layout['presets'] ) ) {
			$result = $preset_class::process_presets_for_import( $layout['presets'] );
			if ( ! empty( $result['preset_id_mappings'] ) ) {
				foreach ( $result['preset_id_mappings'] as $old => $new ) {
					if ( is_string( $old ) && is_string( $new ) && $old !== $new ) {
						$content = str_replace( $old, $new, $content );
					}
				}
			}
		}

		// -----------------------------------------------------------------------
		// 4. Global colours + variables (needed for $variable(...)$ references).
		// -----------------------------------------------------------------------
		if ( $d5_available && ! empty( $layout['global_colors'] ) && is_array( $layout['global_colors'] ) ) {
			if ( method_exists( $data_class, 'get_imported_global_colors' )
				&& method_exists( $data_class, 'set_global_colors' ) ) {
				$converted = $data_class::get_imported_global_colors( $layout['global_colors'] );
				if ( is_array( $converted ) && ! empty( $converted ) ) {
					$data_class::set_global_colors( $converted, true );
				}
			} else {
				$warnings[] = 'GlobalData colour methods not found — global colours skipped.';
			}
		}

		if ( $d5_available && ! empty( $layout['global_variables'] ) && is_array( $layout['global_variables'] ) ) {
			if ( method_exists( $data_class, 'import_global_variables' ) ) {
				$data_class::import_global_variables( $layout['global_variables'] );
			} else {
				$warnings[] = 'GlobalData::import_global_variables not found — variables skipped.';
			}
		}

		// -----------------------------------------------------------------------
		// 5. Create or overwrite the fixed preview page.
		// -----------------------------------------------------------------------
		$existing = get_page_by_path( self::PREVIEW_SLUG, OBJECT, 'page' );
		$postarr  = array(
			'post_type'    => 'page',
			'post_title'   => self::PREVIEW_TITLE,
			'post_name'    => self::PREVIEW_SLUG,
			'post_content' => $content,
			'post_status'  => 'draft',
		);

		if ( $existing ) {
			$postarr['ID'] = $existing->ID;
			$page_id       = wp_update_post( wp_slash( $postarr ), true );
			$action        = 'updated';
		} else {
			$page_id = wp_insert_post( wp_slash( $postarr ), true );
			$action  = 'created';
		}

		if ( is_wp_error( $page_id ) ) {
			throw new RuntimeException( 'Preview page save failed: ' . $page_id->get_error_message() );
		}

		update_post_meta( $page_id, '_et_pb_use_builder', 'on' );
		update_post_meta( $page_id, '_et_pb_use_divi_5', 'on' );

		return array(
			'preview_url' => get_preview_post_link( $page_id ),
			'page_id'     => $page_id,
			'action'      => $action,
			'warnings'    => $warnings,
		);
	}
}
