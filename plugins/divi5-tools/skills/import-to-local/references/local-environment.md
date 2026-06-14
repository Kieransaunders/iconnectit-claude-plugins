# Local (localwp.com) environment reference

How this skill talks to Local sites, and what to verify on first run.

## Key paths (macOS)

| What | Path |
|---|---|
| Local data dir | `~/Library/Application Support/Local` (override: `LOCAL_DATA_DIR` env) |
| Site registry | `<data>/sites.json` — object keyed by site id: `{name, path, domain, ...}` |
| Per-site env script | `<data>/ssh-entry/<site-id>.sh` — what "Open Site Shell" runs |
| Running heuristic | `<data>/run/<site-id>/mysql/mysqld.sock` exists while the site is up |
| Site web root | `<site.path>/app/public` |

Windows: data dir is `%APPDATA%/Local`. Linux: `~/.config/Local`.

## How `wp.sh` works (and why)

Local bundles per-site PHP, MySQL and WP-CLI ("lightning services"). The ssh-entry script exports the right PATH/env for the selected site — but it may end by `exec`-ing an interactive shell, so sourcing it whole would hang a script. `wp.sh` therefore greps out only the environment lines (`export …`, `PATH=…`, `MYSQL_HOME=…`, `PHPRC=…`, `WP_CLI_…`), evals them, `cd`s to the site's `app/public`, and runs `wp`.

**First-run verification (one-time, per machine / Local version):**

1. `cat "<data>/ssh-entry/<site-id>.sh"` — eyeball what it sets. If env lines use a different shape than the grep pattern in `wp.sh`, extend the pattern.
2. `bash scripts/wp.sh <id> <public-dir> option get siteurl` — must print the site's URL. Wrong URL = wrong DB = stop.
3. `bash scripts/wp.sh <id> <public-dir> theme list` — confirm Divi 5 present and active.

## Divi 5 import internals (verified in 5.0.0-public-beta.9.1 source)

| API | Source location | Notes |
|---|---|---|
| `GlobalPreset::process_presets_for_import($presets, $auto_save = true)` | `includes/builder-5/server/Packages/GlobalData/GlobalPreset.php` | Accepts the export's `presets` value (`{module: …}`), auto-detects D4/D5, merges + dedupes, saves. **Returns `preset_id_mappings`** — imported preset IDs may be remapped and the content string must be rewritten with new IDs (the bridge does this). |
| `GlobalData::get_imported_global_colors($incoming)` | `…/GlobalData/GlobalData.php` | Converts the export's tuple format `[["gcid-…", {…}], …]` into the assoc map `set_global_colors` expects. |
| `GlobalData::set_global_colors($data, true)` | same | With `$already_sanitized = true`, **merges** with existing colours instead of replacing. |
| `GlobalData::import_global_variables($incoming)` | same | Used when the export carries `global_variables`. |
| Page meta flags | `update_post_meta: _et_pb_use_builder = 'on'`, `_et_pb_use_divi_5 = 'on'` | Matches what Divi's own SyncToServer/PageManager controllers set. |

These are beta APIs — re-run the verification greps after any Divi update and bump expectations here if signatures move.

## Pitfalls

- **Site not running**: WP-CLI will fail at the MySQL socket. Check the running heuristic before importing; tell the user to start the site in Local.
- **`sites.json` field drift**: Local has renamed fields across versions; `list-local-sites.js` reads defensively (`path|sitePath`, `domain|host`). If a site shows blank fields, inspect `sites.json` and extend.
- **Preset ID collisions**: handled by Divi's merge + the mapping rewrite. Do not skip the rewrite step — content referencing old preset IDs silently loses styling.
- **`wp_slash` on insert**: Divi block content contains escaped JSON; `wp_insert_post`/`wp_update_post` unslash. The bridge wraps `$postarr` in `wp_slash()` — keep it.
- **Preview link on drafts**: `get_preview_post_link()` includes the preview nonce-less public URL form for drafts; if a 404 appears, use the `builderUrl` or log in to wp-admin first.
- **Never run against a production site.** This skill targets Local development sites only.
