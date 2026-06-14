<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_Auth {

	const KEY_OPTION  = 'dti_api_key_hash';
	const LOG_OPTION  = 'dti_import_log';
	const RATE_OPTION = 'dti_rate_limit';

	public static function maybe_generate_key(): void {
		if ( ! get_option( self::KEY_OPTION ) ) {
			self::generate_key();
		}
	}

	public static function generate_key(): string {
		$key = 'dtik_' . bin2hex( random_bytes( 24 ) );
		update_option( self::KEY_OPTION, wp_hash_password( $key ), false );
		// Store the plain key once for first-view display, then delete after shown.
		update_option( 'dti_api_key_plain', $key, false );
		return $key;
	}

	public static function verify( string $key ): bool {
		$hash = get_option( self::KEY_OPTION );
		if ( ! $hash ) {
			return false;
		}
		return wp_check_password( $key, $hash );
	}

	/**
	 * Simple per-IP rate limit: max 30 requests per 60 seconds.
	 */
	public static function check_rate_limit(): bool {
		$ip      = sanitize_text_field( $_SERVER['REMOTE_ADDR'] ?? 'unknown' );
		$key     = self::RATE_OPTION . '_' . md5( $ip );
		$data    = get_transient( $key );
		$count   = is_array( $data ) ? (int) $data['count'] : 0;

		if ( $count >= 30 ) {
			return false;
		}

		set_transient( $key, array( 'count' => $count + 1 ), 60 );
		return true;
	}

	public static function log_import( array $entry ): void {
		$log   = get_option( self::LOG_OPTION, array() );
		array_unshift( $log, array_merge( $entry, array( 'time' => gmdate( 'Y-m-d H:i:s' ) ) ) );
		$log   = array_slice( $log, 0, 50 ); // keep last 50
		update_option( self::LOG_OPTION, $log, false );
	}

	public static function get_log(): array {
		return get_option( self::LOG_OPTION, array() );
	}
}
