<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Import and list Divi 5 module presets independently of any page.
 *
 * POST /wp-json/divi-tools/v1/presets/import
 *   body: { presets: { module: { "divi/section": { default, items: {...} } } } }
 *   Returns: { imported_count, id_mappings, warnings }
 *
 * GET /wp-json/divi-tools/v1/presets
 *   Returns: { presets: { "divi/section": [ { id, name } ] } }
 *   Optional ?module=divi/button to filter by module.
 */
class DTI_PresetManager {

	/**
	 * Import a preset pack. Registers presets and triggers CSS regeneration.
	 *
	 * @param array $presets  Preset object in Divi 5 format: { module: { "divi/x": { default, items } } }
	 * @return array{ imported_count: int, id_mappings: array, warnings: string[] }
	 */
	public static function import_presets( array $presets ): array {
		$warnings = [];

		$preset_class = 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset';

		if ( ! class_exists( $preset_class ) || ! method_exists( $preset_class, 'process_presets_for_import' ) ) {
			throw new RuntimeException( 'Divi 5 GlobalPreset class not available.' );
		}

		// Normalise — accept { module: {...} } or bare { "divi/x": {...} }
		if ( ! isset( $presets['module'] ) && ! isset( $presets['group'] ) ) {
			$presets = [ 'module' => $presets, 'group' => [] ];
		}

		$result      = $preset_class::process_presets_for_import( $presets );
		$id_mappings = $result['preset_id_mappings'] ?? [];

		$imported_count = 0;
		foreach ( $presets['module'] ?? [] as $module_data ) {
			$imported_count += count( $module_data['items'] ?? [] );
		}

		// Call save_data() to persist AND trigger CSS cache clearing.
		// process_presets_for_import() merges but doesn't save — save_data() does both.
		$merged = $preset_class::get_data();
		$preset_class::save_data( $merged );

		return [
			'imported_count' => $imported_count,
			'id_mappings'    => $id_mappings,
			'warnings'       => $warnings,
		];
	}

	/**
	 * List all registered presets, optionally filtered by module name.
	 *
	 * Default: returns a flat name→id map per module.
	 * With $with_attrs = true: returns name→{ id, attrs } so the JS generator can
	 * inline preset attrs for front-end CSS rendering (fixes default-blue buttons).
	 *
	 * @param string $module      Optional filter, e.g. "divi/button"
	 * @param bool   $with_attrs  Include stored preset attrs in the response.
	 * @return array{ presets: array<string, array<string, mixed>> }
	 */
	public static function list_presets( string $module = '', bool $with_attrs = false ): array {
		$preset_class = 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset';

		if ( ! class_exists( $preset_class ) || ! method_exists( $preset_class, 'get_data' ) ) {
			throw new RuntimeException( 'Divi 5 GlobalPreset class not available.' );
		}

		$data   = $preset_class::get_data();
		$result = [];

		foreach ( $data['module'] ?? [] as $module_name => $module_data ) {
			if ( $module && $module_name !== $module ) continue;

			$result[ $module_name ] = [];
			foreach ( $module_data['items'] ?? [] as $id => $item ) {
				$name = $item['name'] ?? '';
				if ( ! $name ) continue;

				if ( $with_attrs ) {
					$result[ $module_name ][ $name ] = [
						'id'   => $id,
						'attrs' => $item['attrs'] ?? null,
					];
				} else {
					$result[ $module_name ][ $name ] = $id;
				}
			}
		}

		return [ 'presets' => $result ];
	}
}
