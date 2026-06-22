<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_RestApi {

	const NAMESPACE = 'divi-tools/v1';

	public static function register_routes(): void {
		register_rest_route( self::NAMESPACE, '/import', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_import' ),
			'permission_callback' => array( __CLASS__, 'authenticate' ),
			'args'                => array(
				'layout'  => array( 'required' => true,  'type' => 'object' ),
				'seo'     => array( 'required' => false, 'type' => 'object', 'default' => array() ),
				'schema'  => array( 'required' => false, 'type' => 'object', 'default' => array() ),
				'publish' => array( 'required' => false, 'type' => 'boolean', 'default' => false ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/preview', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_preview' ),
			'permission_callback' => array( __CLASS__, 'authenticate' ),
			'args'                => array(
				'layout' => array( 'required' => true, 'type' => 'object' ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/export', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'handle_export' ),
			'permission_callback' => array( __CLASS__, 'authenticate' ),
			'args'                => array(
				'id'   => array( 'required' => false, 'type' => 'integer', 'default' => 0 ),
				'slug' => array( 'required' => false, 'type' => 'string',  'default' => '' ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/presets/import', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'handle_presets_import' ),
			'permission_callback' => array( __CLASS__, 'authenticate' ),
			'args'                => array(
				'presets' => array( 'required' => true, 'type' => 'object' ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/presets', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'handle_presets_list' ),
			'permission_callback' => array( __CLASS__, 'authenticate' ),
			'args'                => array(
				'module'     => array( 'required' => false, 'type' => 'string',  'default' => '' ),
				'with_attrs' => array( 'required' => false, 'type' => 'boolean', 'default' => false ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/ping', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'handle_ping' ),
			'permission_callback' => array( __CLASS__, 'authenticate' ),
		) );
	}

	public static function authenticate( WP_REST_Request $request ): bool|WP_Error {
		if ( ! DTI_Auth::check_rate_limit() ) {
			return new WP_Error( 'rate_limited', 'Too many requests. Try again in 60 seconds.', array( 'status' => 429 ) );
		}

		$key = $request->get_header( 'X-Divi-Tools-Key' );
		if ( ! $key ) {
			// Also accept as query param for easy browser testing.
			$key = sanitize_text_field( $request->get_param( 'dti_key' ) ?? '' );
		}

		if ( ! $key || ! DTI_Auth::verify( $key ) ) {
			return new WP_Error( 'unauthorized', 'Invalid or missing API key.', array( 'status' => 401 ) );
		}

		return true;
	}

	public static function handle_preview( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$layout = $request->get_param( 'layout' );

		if ( ! is_array( $layout ) || empty( $layout ) ) {
			return new WP_Error( 'invalid_layout', 'layout must be a non-empty JSON object.', array( 'status' => 400 ) );
		}

		try {
			$result = DTI_PagePreviewer::preview( $layout );
		} catch ( InvalidArgumentException $e ) {
			return new WP_Error( 'validation_failed', $e->getMessage(), array( 'status' => 422 ) );
		} catch ( RuntimeException $e ) {
			return new WP_Error( 'preview_failed', $e->getMessage(), array( 'status' => 500 ) );
		}

		return new WP_REST_Response( $result, 200 );
	}

	public static function handle_export( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id   = (int) $request->get_param( 'id' );
		$slug = sanitize_text_field( (string) $request->get_param( 'slug' ) );

		try {
			$result = DTI_PageExporter::export( $id, $slug );
		} catch ( InvalidArgumentException $e ) {
			return new WP_Error( 'not_found', $e->getMessage(), array( 'status' => 404 ) );
		} catch ( RuntimeException $e ) {
			return new WP_Error( 'export_failed', $e->getMessage(), array( 'status' => 500 ) );
		}

		return new WP_REST_Response( $result, 200 );
	}

	public static function handle_presets_import( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$presets = $request->get_param( 'presets' );

		if ( ! is_array( $presets ) || empty( $presets ) ) {
			return new WP_Error( 'invalid_presets', 'presets must be a non-empty JSON object.', array( 'status' => 400 ) );
		}

		try {
			$result = DTI_PresetManager::import_presets( $presets );
		} catch ( RuntimeException $e ) {
			return new WP_Error( 'import_failed', $e->getMessage(), array( 'status' => 500 ) );
		}

		return new WP_REST_Response( $result, 200 );
	}

	public static function handle_presets_list( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$module     = sanitize_text_field( (string) $request->get_param( 'module' ) );
		$with_attrs = (bool) $request->get_param( 'with_attrs' );

		try {
			$result = DTI_PresetManager::list_presets( $module, $with_attrs );
		} catch ( RuntimeException $e ) {
			return new WP_Error( 'list_failed', $e->getMessage(), array( 'status' => 500 ) );
		}

		return new WP_REST_Response( $result, 200 );
	}

	public static function handle_ping( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( array(
			'status'      => 'ok',
			'site'        => get_bloginfo( 'name' ),
			'url'         => home_url(),
			'divi5'       => class_exists( 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset' ),
			'yoast'       => defined( 'WPSEO_VERSION' ),
			'rankmath'    => class_exists( 'RankMath' ),
			'dti_version' => DTI_VERSION,
		), 200 );
	}

	public static function handle_import( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$layout  = $request->get_param( 'layout' );
		$seo     = $request->get_param( 'seo' )    ?: array();
		$schema  = $request->get_param( 'schema' ) ?: array();
		$publish = (bool) $request->get_param( 'publish' );

		// Validate layout is an array (REST converts object → assoc array).
		if ( ! is_array( $layout ) || empty( $layout ) ) {
			return new WP_Error( 'invalid_layout', 'layout must be a non-empty JSON object.', array( 'status' => 400 ) );
		}

		$context = $layout['context'] ?? '';

		// Route to library importer for et_builder_layouts (sections, rows, modules).
		if ( $context === 'et_builder_layouts' ) {
			try {
				$result = DTI_LibraryImporter::import( $layout );
			} catch ( InvalidArgumentException $e ) {
				return new WP_Error( 'validation_failed', $e->getMessage(), array( 'status' => 422 ) );
			} catch ( RuntimeException $e ) {
				return new WP_Error( 'import_failed', $e->getMessage(), array( 'status' => 500 ) );
			}
			DTI_Auth::log_import( array(
				'slug'     => $result['imported'][0]['title'] ?? 'library',
				'action'   => $result['imported'][0]['action'] ?? 'created',
				'status'   => 'library',
				'warnings' => $result['warnings'],
			) );
			return new WP_REST_Response( $result, 200 );
		}

		// Standard page import.
		try {
			$result = DTI_PageImporter::import( $layout, $seo, $publish );
		} catch ( InvalidArgumentException $e ) {
			return new WP_Error( 'validation_failed', $e->getMessage(), array( 'status' => 422 ) );
		} catch ( RuntimeException $e ) {
			return new WP_Error( 'import_failed', $e->getMessage(), array( 'status' => 500 ) );
		}

		// Save schema for automatic <head> injection.
		if ( ! empty( $schema ) && is_array( $schema ) ) {
			DTI_SchemaInjector::save( $result['slug'], $schema );
			$result['schema_saved'] = true;
		} else {
			$result['schema_saved'] = false;
		}

		DTI_Auth::log_import( array(
			'slug'       => $result['slug'],
			'action'     => $result['action'],
			'status'     => $result['status'],
			'seo_plugin' => $result['seo_plugin'],
			'warnings'   => $result['warnings'],
		) );

		return new WP_REST_Response( $result, 200 );
	}
}
