<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_SeoWriter {

	/**
	 * Write SEO meta to whichever SEO plugin is active.
	 *
	 * @param int   $page_id
	 * @param array $seo  Keys: title, description (and aliases titleTag, metaDescription)
	 * @return string  Which plugin was used: 'yoast' | 'rankmath' | 'none'
	 */
	public static function write( int $page_id, array $seo ): string {
		$title = $seo['titleTag'] ?? $seo['title'] ?? '';
		$desc  = $seo['metaDescription'] ?? $seo['description'] ?? '';

		if ( ! $title && ! $desc ) {
			return 'none';
		}

		if ( defined( 'WPSEO_VERSION' ) ) {
			if ( $title ) {
				update_post_meta( $page_id, '_yoast_wpseo_title', sanitize_text_field( $title ) );
			}
			if ( $desc ) {
				update_post_meta( $page_id, '_yoast_wpseo_metadesc', sanitize_text_field( $desc ) );
			}
			return 'yoast';
		}

		if ( class_exists( 'RankMath' ) ) {
			if ( $title ) {
				update_post_meta( $page_id, 'rank_math_title', sanitize_text_field( $title ) );
			}
			if ( $desc ) {
				update_post_meta( $page_id, 'rank_math_description', sanitize_text_field( $desc ) );
			}
			return 'rankmath';
		}

		// Fallback: store in our own meta so the admin can see the values.
		update_post_meta( $page_id, '_dti_seo_title', sanitize_text_field( $title ) );
		update_post_meta( $page_id, '_dti_seo_description', sanitize_text_field( $desc ) );
		return 'none';
	}
}
