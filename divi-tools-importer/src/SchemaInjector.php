<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_SchemaInjector {

	const OPTION_PREFIX = 'dti_schema_';

	public static function save( string $slug, array $schema ): void {
		update_option( self::OPTION_PREFIX . sanitize_key( $slug ), $schema, false );
	}

	public static function delete( string $slug ): void {
		delete_option( self::OPTION_PREFIX . sanitize_key( $slug ) );
	}

	public static function maybe_inject(): void {
		if ( ! is_singular() ) {
			return;
		}

		$slug   = get_post_field( 'post_name', get_queried_object_id() );
		$schema = get_option( self::OPTION_PREFIX . sanitize_key( $slug ) );

		if ( ! is_array( $schema ) || empty( $schema ) ) {
			return;
		}

		$json = wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT );
		if ( ! $json ) {
			return;
		}

		echo "\n<script type=\"application/ld+json\">\n" . $json . "\n</script>\n";
	}
}
