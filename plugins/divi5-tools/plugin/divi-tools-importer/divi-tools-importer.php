<?php
/**
 * Plugin Name:       Divi Tools Importer
 * Plugin URI:        https://iconnectit.co.uk
 * Description:       REST API endpoint for importing Divi 5 pages, SEO meta, and FAQ schema from Claude Code. Install, copy your API key, hand it to Claude.
 * Version:           1.2.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            iConnectIT
 * Author URI:        https://iconnectit.co.uk
 * License:           GPL-2.0-or-later
 * Text Domain:       divi-tools-importer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DTI_VERSION', '1.2.0' );
define( 'DTI_FILE', __FILE__ );
define( 'DTI_DIR', plugin_dir_path( __FILE__ ) );

require_once DTI_DIR . 'src/Auth.php';
require_once DTI_DIR . 'src/SchemaInjector.php';
require_once DTI_DIR . 'src/SeoWriter.php';
require_once DTI_DIR . 'src/PageImporter.php';
require_once DTI_DIR . 'src/PagePreviewer.php';
require_once DTI_DIR . 'src/PageExporter.php';
require_once DTI_DIR . 'src/LibraryImporter.php';
require_once DTI_DIR . 'src/PresetManager.php';
require_once DTI_DIR . 'src/RestApi.php';
require_once DTI_DIR . 'admin/SettingsPage.php';

register_activation_hook( __FILE__, array( 'DTI_Auth', 'maybe_generate_key' ) );

add_action( 'rest_api_init', array( 'DTI_RestApi', 'register_routes' ) );
add_action( 'wp_head',       array( 'DTI_SchemaInjector', 'maybe_inject' ) );
add_action( 'admin_menu',    array( 'DTI_SettingsPage', 'register' ) );
add_action( 'admin_init',    array( 'DTI_SettingsPage', 'handle_actions' ) );
