<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Imports an et_builder_layouts export (sections, rows, modules) into the Divi Library.
 *
 * The et_builder_layouts format stores each layout item as a post record inside
 * data[]. Each record carries post_meta (_et_pb_template_type, _et_pb_built_for_post_type)
 * and taxonomy terms (scope, module_width, layout_type, layout_category).
 */
class DTI_LibraryImporter {

	/**
	 * Import a Divi 5 et_builder_layouts export into the Divi Library.
	 *
	 * @param array $layout  Parsed et_builder_layouts export array.
	 * @return array{imported:array, warnings:string[], presets_imported:bool, colors_imported:bool}
	 */
	public static function import( array $layout ): array {
		$warnings = array();

		// -----------------------------------------------------------------------
		// 1. Validate.
		// -----------------------------------------------------------------------
		if ( ( $layout['context'] ?? '' ) !== 'et_builder_layouts' ) {
			throw new InvalidArgumentException(
				"Expected context 'et_builder_layouts', got '" . ( $layout['context'] ?? 'none' ) . "'."
			);
		}
		if ( empty( $layout['data'] ) || ! is_array( $layout['data'] ) ) {
			throw new InvalidArgumentException( 'Export has no data map.' );
		}

		// -----------------------------------------------------------------------
		// 2. Divi 5 internals.
		// -----------------------------------------------------------------------
		$preset_class = 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset';
		$data_class   = 'ET\\Builder\\Packages\\GlobalData\\GlobalData';
		$d5_available = class_exists( $preset_class )
			&& method_exists( $preset_class, 'process_presets_for_import' );

		if ( ! $d5_available ) {
			$warnings[] = 'Divi 5 import helpers not found — presets and global colours skipped.';
		}

		// -----------------------------------------------------------------------
		// 3. Import presets.
		// -----------------------------------------------------------------------
		$presets_imported = false;
		if ( $d5_available && ! empty( $layout['presets'] ) && is_array( $layout['presets'] ) ) {
			$preset_class::process_presets_for_import( $layout['presets'] );
			$presets_imported = true;
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
			}
		}
		if ( $d5_available && ! empty( $layout['global_variables'] ) && is_array( $layout['global_variables'] ) ) {
			if ( method_exists( $data_class, 'import_global_variables' ) ) {
				$data_class::import_global_variables( $layout['global_variables'] );
			}
		}

		// -----------------------------------------------------------------------
		// 5. Import each layout item.
		// -----------------------------------------------------------------------
		$imported = array();

		foreach ( $layout['data'] as $item ) {
			if ( ! is_array( $item ) || empty( $item['post_content'] ) ) {
				continue;
			}

			$content       = $item['post_content'];
			$title         = sanitize_text_field( $item['post_title'] ?? 'Imported Layout' );
			$slug          = sanitize_title( $item['post_name'] ?? $title );
			$template_type = $item['post_meta']['_et_pb_template_type'][0] ?? 'section';
			$built_for     = $item['post_meta']['_et_pb_built_for_post_type'][0] ?? 'page';

			// Resolve preset IDs in content now that presets have been imported.
			if ( $presets_imported ) {
				$result = $preset_class::process_presets_for_import( $layout['presets'] );
				if ( ! empty( $result['preset_id_mappings'] ) ) {
					foreach ( $result['preset_id_mappings'] as $old => $new ) {
						if ( is_string( $old ) && is_string( $new ) && $old !== $new ) {
							$content = str_replace( $old, $new, $content );
						}
					}
				}
			}

			// Create or update the library post.
			$existing = get_page_by_path( $slug, OBJECT, 'et_pb_layout' );
			$postarr  = array(
				'post_type'    => 'et_pb_layout',
				'post_title'   => $title,
				'post_name'    => $slug,
				'post_content' => $content,
				'post_status'  => 'publish',
			);

			if ( $existing ) {
				$postarr['ID'] = $existing->ID;
				$post_id       = wp_update_post( wp_slash( $postarr ), true );
				$action        = 'updated';
			} else {
				$post_id = wp_insert_post( wp_slash( $postarr ), true );
				$action  = 'created';
			}

			if ( is_wp_error( $post_id ) ) {
				$warnings[] = 'Failed to save "' . $title . '": ' . $post_id->get_error_message();
				continue;
			}

			// Post meta.
			update_post_meta( $post_id, '_et_pb_use_builder', 'on' );
			update_post_meta( $post_id, '_et_pb_use_divi_5', 'on' );
			update_post_meta( $post_id, '_et_pb_template_type', $template_type );
			update_post_meta( $post_id, '_et_pb_built_for_post_type', array( $built_for ) );

			// Taxonomy terms — map from the export's term data.
			self::set_layout_terms( $post_id, $item['terms'] ?? array(), $template_type );

			$imported[] = array(
				'post_id'       => $post_id,
				'title'         => $title,
				'action'        => $action,
				'template_type' => $template_type,
				'edit_url'      => admin_url( 'post.php?post=' . $post_id . '&action=edit' ),
			);
		}

		if ( empty( $imported ) ) {
			throw new RuntimeException( 'No valid layout items found in the export.' );
		}

		return array(
			'imported'         => $imported,
			'presets_imported' => $presets_imported,
			'colors_imported'  => $colors_imported,
			'warnings'         => $warnings,
		);
	}

	/**
	 * Set Divi Library taxonomy terms on a post, creating terms as needed.
	 * Resolves by slug/taxonomy rather than by the export's integer IDs.
	 *
	 * @param int   $post_id
	 * @param array $terms_data  Terms map from the export (keyed by old term ID).
	 * @param string $template_type  Fallback template type if terms_data is empty.
	 */
	private static function set_layout_terms( int $post_id, array $terms_data, string $template_type ): void {
		// Collect terms by taxonomy from the export data.
		$by_taxonomy = array();
		foreach ( $terms_data as $term ) {
			if ( empty( $term['taxonomy'] ) || empty( $term['slug'] ) ) {
				continue;
			}
			$by_taxonomy[ $term['taxonomy'] ][] = array(
				'name' => $term['name'] ?? $term['slug'],
				'slug' => $term['slug'],
			);
		}

		// If no terms in export, derive from template_type.
		if ( empty( $by_taxonomy ) ) {
			$by_taxonomy = array(
				'scope'        => array( array( 'name' => 'Not Global', 'slug' => 'non_global' ) ),
				'module_width' => array( array( 'name' => 'Regular', 'slug' => 'regular' ) ),
				'layout_type'  => array( array( 'name' => $template_type, 'slug' => $template_type ) ),
			);
		}

		foreach ( $by_taxonomy as $taxonomy => $terms ) {
			if ( ! taxonomy_exists( $taxonomy ) ) {
				continue;
			}
			$term_ids = array();
			foreach ( $terms as $t ) {
				$existing = get_term_by( 'slug', $t['slug'], $taxonomy );
				if ( $existing ) {
					$term_ids[] = $existing->term_id;
				} else {
					$created = wp_insert_term( $t['name'], $taxonomy, array( 'slug' => $t['slug'] ) );
					if ( ! is_wp_error( $created ) ) {
						$term_ids[] = $created['term_id'];
					}
				}
			}
			if ( ! empty( $term_ids ) ) {
				wp_set_object_terms( $post_id, $term_ids, $taxonomy );
			}
		}
	}
}
