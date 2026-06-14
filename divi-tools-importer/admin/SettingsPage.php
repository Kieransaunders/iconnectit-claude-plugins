<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DTI_SettingsPage {

	public static function register(): void {
		add_options_page(
			'Divi Tools Importer',
			'Divi Tools Importer',
			'manage_options',
			'divi-tools-importer',
			array( __CLASS__, 'render' )
		);
	}

	public static function handle_actions(): void {
		if ( ! isset( $_POST['dti_action'] ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( ! check_admin_referer( 'dti_action' ) ) {
			wp_die( 'Security check failed.' );
		}
		if ( $_POST['dti_action'] === 'regenerate_key' ) {
			DTI_Auth::generate_key();
			wp_redirect( add_query_arg( array( 'page' => 'divi-tools-importer', 'dti_msg' => 'regenerated' ), admin_url( 'options-general.php' ) ) );
			exit;
		}
		if ( $_POST['dti_action'] === 'clear_log' ) {
			delete_option( DTI_Auth::LOG_OPTION );
			wp_redirect( add_query_arg( array( 'page' => 'divi-tools-importer', 'dti_msg' => 'log_cleared' ), admin_url( 'options-general.php' ) ) );
			exit;
		}
	}

	public static function render(): void {
		// Show plain key once, then delete it.
		$plain_key = get_option( 'dti_api_key_plain', '' );
		if ( $plain_key ) {
			delete_option( 'dti_api_key_plain' );
		}

		$has_key     = (bool) get_option( DTI_Auth::KEY_OPTION );
		$endpoint    = home_url( '/wp-json/divi-tools/v1/import' );
		$ping_url    = home_url( '/wp-json/divi-tools/v1/ping' );
		$log         = DTI_Auth::get_log();
		$msg         = sanitize_key( $_GET['dti_msg'] ?? '' );
		?>
		<div class="wrap">
			<h1>Divi Tools Importer</h1>

			<?php if ( $msg === 'regenerated' ) : ?>
				<div class="notice notice-warning"><p>API key regenerated. Your old key no longer works — copy the new one below.</p></div>
			<?php elseif ( $msg === 'log_cleared' ) : ?>
				<div class="notice notice-success"><p>Import log cleared.</p></div>
			<?php endif; ?>

			<?php if ( $plain_key ) : ?>
				<div class="notice notice-success" style="border-left-color:#2271b1">
					<p><strong>Your API key (shown once — copy it now):</strong></p>
					<p><code style="font-size:15px;user-select:all;background:#f0f6fc;padding:8px 12px;display:inline-block;border-radius:4px"><?php echo esc_html( $plain_key ); ?></code></p>
				</div>
			<?php endif; ?>

			<table class="form-table" role="presentation">
				<tr>
					<th>API Key</th>
					<td>
						<?php if ( $has_key && ! $plain_key ) : ?>
							<em>Key is set (hidden for security)</em>
						<?php elseif ( ! $has_key ) : ?>
							<em>No key generated yet — activate the plugin to generate one.</em>
						<?php endif; ?>
						<form method="post" style="margin-top:8px">
							<?php wp_nonce_field( 'dti_action' ); ?>
							<input type="hidden" name="dti_action" value="regenerate_key">
							<button type="submit" class="button" onclick="return confirm('Regenerate key? Your current key will stop working immediately.')">
								Regenerate Key
							</button>
						</form>
					</td>
				</tr>
				<tr>
					<th>Import Endpoint</th>
					<td>
						<code style="user-select:all"><?php echo esc_html( $endpoint ); ?></code>
					</td>
				</tr>
				<tr>
					<th>Quick test</th>
					<td>
						<a href="<?php echo esc_url( $ping_url ); ?>" target="_blank" class="button">Ping endpoint ↗</a>
						<p class="description">Opens the ping endpoint — requires your key as <code>?dti_key=YOUR_KEY</code></p>
					</td>
				</tr>
				<tr>
					<th>SEO plugin</th>
					<td>
						<?php
						if ( defined( 'WPSEO_VERSION' ) ) {
							echo '<span style="color:green">✓ Yoast SEO detected</span>';
						} elseif ( class_exists( 'RankMath' ) ) {
							echo '<span style="color:green">✓ Rank Math detected</span>';
						} else {
							echo '<span style="color:#b32d2e">✗ No SEO plugin detected — install Yoast or Rank Math for automatic meta injection</span>';
						}
						?>
					</td>
				</tr>
				<tr>
					<th>Divi 5</th>
					<td>
						<?php
						if ( class_exists( 'ET\\Builder\\Packages\\GlobalData\\GlobalPreset' ) ) {
							echo '<span style="color:green">✓ Divi 5 detected — full import (presets + colours)</span>';
						} else {
							echo '<span style="color:#b32d2e">✗ Divi 5 not detected — content-only import</span>';
						}
						?>
					</td>
				</tr>
			</table>

			<hr>
			<h2>How to use</h2>
			<p>Give these two values to Claude Code (or paste them into the <code>import</code> skill):</p>
			<ol>
				<li><strong>Site URL:</strong> <code><?php echo esc_html( home_url() ); ?></code></li>
				<li><strong>API Key:</strong> the key shown above (or regenerate to see it again)</li>
			</ol>
			<p>Claude will call <code>POST /wp-json/divi-tools/v1/import</code> with your Divi JSON, SEO meta, and FAQ schema in one request. The page is created as a draft — you approve before publishing.</p>

			<hr>
			<h2>Example curl</h2>
			<pre style="background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:6px;overflow-x:auto;font-size:12px">curl -s -X POST \
  '<?php echo esc_html( $endpoint ); ?>' \
  -H 'Content-Type: application/json' \
  -H 'X-Divi-Tools-Key: YOUR_KEY_HERE' \
  -d '{
    "layout":  { ...et_builder JSON... },
    "seo":     { "title": "Page Title | Brand", "description": "...", "slug": "page-slug" },
    "schema":  { "@context": "https://schema.org", "@type": "FAQPage", ... },
    "publish": false
  }'</pre>

			<hr>
			<h2>Import log <small>(last 50)</small></h2>
			<?php if ( empty( $log ) ) : ?>
				<p><em>No imports yet.</em></p>
			<?php else : ?>
				<form method="post" style="margin-bottom:12px">
					<?php wp_nonce_field( 'dti_action' ); ?>
					<input type="hidden" name="dti_action" value="clear_log">
					<button type="submit" class="button button-small">Clear log</button>
				</form>
				<table class="widefat striped" style="max-width:900px">
					<thead>
						<tr>
							<th>Time</th>
							<th>Slug</th>
							<th>Action</th>
							<th>Status</th>
							<th>SEO plugin</th>
							<th>Warnings</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $log as $entry ) : ?>
							<tr>
								<td><?php echo esc_html( $entry['time'] ); ?></td>
								<td><code><?php echo esc_html( $entry['slug'] ); ?></code></td>
								<td><?php echo esc_html( $entry['action'] ); ?></td>
								<td><?php echo esc_html( $entry['status'] ); ?></td>
								<td><?php echo esc_html( $entry['seo_plugin'] ); ?></td>
								<td>
									<?php if ( ! empty( $entry['warnings'] ) ) : ?>
										<ul style="margin:0">
											<?php foreach ( $entry['warnings'] as $w ) : ?>
												<li style="color:#b32d2e"><?php echo esc_html( $w ); ?></li>
											<?php endforeach; ?>
										</ul>
									<?php else : ?>
										<span style="color:green">None</span>
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}
}
