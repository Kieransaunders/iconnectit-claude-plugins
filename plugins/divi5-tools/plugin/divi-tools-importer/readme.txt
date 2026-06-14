===  Divi Tools Importer ===
Contributors: iconnectit
Tags: divi, divi 5, landing page, seo, import
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

REST API endpoint for importing Divi 5 pages, SEO meta, and FAQ schema from Claude Code in a single request.

== Description ==

Divi Tools Importer closes the gap between Claude Code generating a Divi 5 landing page and that page appearing on your WordPress site — without WP-CLI, SSH, or manual copy-pasting.

**What it does:**

* Exposes a secure `POST /wp-json/divi-tools/v1/import` endpoint on your site
* Accepts a Divi 5 page JSON, SEO meta, and FAQ schema in one request
* Creates or updates a **draft** page with the Divi content
* Imports Divi 5 presets, global colours, and global variables automatically
* Writes the title tag and meta description to Yoast SEO or Rank Math
* Stores the FAQ schema and injects it as JSON-LD in the page `<head>` automatically — no manual pasting
* Returns a preview URL so you can review before publishing
* Logs every import in Settings → Divi Tools Importer

**Works on any host** — Kinsta, WP Engine, SiteGround, Flywheel, Local by WP Engine. No SSH, no WP-CLI required.

**How to use:**

1. Install and activate this plugin
2. Go to Settings → Divi Tools Importer
3. Copy your site URL and API key
4. Give those two values to Claude Code
5. Claude calls the endpoint — your page appears as a draft

**Compatible with:**

* Divi 5 (full import — presets, global colours, global variables)
* Yoast SEO (auto title tag + meta description)
* Rank Math (auto title tag + meta description)
* No SEO plugin (values stored in post meta with a warning)

== Installation ==

1. Upload the `divi-tools-importer` folder to `/wp-content/plugins/`
2. Activate via Plugins → Installed Plugins
3. Go to Settings → Divi Tools Importer to get your API key

== Frequently Asked Questions ==

= Is the endpoint secure? =

Yes. Every request requires an `X-Divi-Tools-Key` header matching a hashed key stored in your database. The key is never stored in plain text. There is also a rate limit of 30 requests per 60 seconds per IP.

= What if I don't have Divi 5? =

The content will still import — the page will be created with the raw Divi block content. Presets and global colours won't be imported (a warning is returned). Activate Divi 5 for full import.

= What if I don't have Yoast or Rank Math? =

SEO values are stored in post meta (`_dti_seo_title`, `_dti_seo_description`) and a warning is returned. Set them manually in your SEO plugin.

= Can I publish immediately instead of creating a draft? =

Pass `"publish": true` in the request body. Default is always draft so you can review first.

= How do I regenerate my API key? =

Settings → Divi Tools Importer → Regenerate Key. Your old key stops working immediately.

== Changelog ==

= 1.0.0 =
* Initial release
