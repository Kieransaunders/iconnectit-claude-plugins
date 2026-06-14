# WP Dev Tools

Claude plugin bundling the two WordPress plugin/theme workflows that sit either side of a release: marketing it, and getting it past WordPress.org review.

## Skills

    /wp-dev-tools:wp-plugin-marketing        Produce finished go-to-market assets for a WordPress plugin or theme
    /wp-dev-tools:wp-plugin-submission-check  Audit a plugin for WordPress.org Plugin Directory submission readiness

### wp-plugin-marketing

Generates the actual marketing assets, not a strategy to execute: tagline, short/long descriptions, `readme.txt`, WordPress.org listing copy, product landing page, cornerstone/docs pages, About page, blog posts, email sequences, social posts, case studies, an Ideal Customer Profile, and a marketing roadmap/KPI plan. Defaults to UK English.

### wp-plugin-submission-check

Audits a plugin directory for readiness to submit to the [WordPress.org Plugin Directory](https://wordpress.org/plugins/developers/add/): Plugin Check (PCP) issues, plugin guideline compliance, `readme.txt` validation, header checks, and a pre-release security/compliance pass.

## Requirements

No external services required. The submission check works against any local plugin directory.
