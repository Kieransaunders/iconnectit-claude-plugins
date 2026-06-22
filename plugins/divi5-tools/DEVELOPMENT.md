# Divi 5 Tools — Developer Guide

**Internal contributor documentation.** For user-facing workflows, see [README.md](README.md). For high-level product context, see [docs/product-overview.md](docs/product-overview.md).

---

## Project structure

```
/Volumes/External/iConnectIT claude plugins/
├── plugins/divi5-tools/                          # ← Everything lives here
│   ├── README.md                                 # User-facing docs (this file)
│   ├── DEVELOPMENT.md                            # You are here
│   ├── docs/
│   │   ├── product-overview.md                   # Product/architecture overview
│   │   ├── user-flow.md                          # Mermaid flowcharts
│   │   └── plans/
│   │       └── 2026-06-22-amazing-generator-from-new-or-existing.md  # 6-phase plan
│   ├── skills/divi5-page-generator/
│   │   ├── SKILL.md                              # Skill instructions (the prompt)
│   │   ├── scripts/
│   │   │   ├── divi-builder.js                   # Builder library (~784 lines)
│   │   │   ├── validate.js                       # Validator (~418 lines)
│   │   │   ├── preview.js                        # Preview renderer
│   │   │   └── __tests__/
│   │   │       ├── smoke.test.js
│   │   │       └── phase0.test.js
│   │   └── references/
│   │       ├── taste.md                          # Taste/aesthetic system
│   │       ├── aesthetics.md
│   │       └── Divi design system JSON/          # Design packs
│   │           ├── Divi-5-Launch-Freebie_Pages.json  # 24 unused premade pages
│   │           └── ...                            # 47 section types
│   ├── plugin/
│   │   ├── build-zip.sh                          # Zip builder — run from repo root
│   │   └── divi-tools-importer/                  # CANONICAL SOURCE (v1.2.0)
│   │       ├── divi-tools-importer.php            # Plugin entry point
│   │       ├── src/
│   │       │   ├── Auth.php                       # X-Divi-Tools-Key auth
│   │       │   ├── RestApi.php                    # Route registration
│   │       │   ├── PageImporter.php               # POST /import
│   │       │   ├── PagePreviewer.php               # POST /preview
│   │       │   ├── PageExporter.php                # GET /export
│   │       │   ├── PresetManager.php               # GET /presets, POST /presets/import
│   │       │   ├── LibraryImporter.php             # Bulk import
│   │       │   ├── SeoWriter.php                   # Yoast/RankMath integration
│   │       │   └── SchemaInjector.php              # JSON-LD schema
│   │       └── deploy.sh                          # rsync to Local WP test site
│   └── app/                                      # Node.js local server
│       ├── server.js                             # Express app (port 3747)
│       ├── db.js
│       └── tests/
│           ├── style-check.test.js
│           └── server.test.js
                                                  # (no committed zip — built on demand; see "Rebuild the plugin zip")
```

## Environment paths

| What | Path |
|------|------|
| Repo root | `/Volumes/External/iConnectIT claude plugins` |
| Generator skill | `plugins/divi5-tools/skills/divi5-page-generator/` |
| Importer plugin (canonical source) | `plugins/divi5-tools/plugin/divi-tools-importer/` |
| Importer zip | built on demand — never committed (the plugin installer rejects nested zips) |
| Local app (Node) | `plugins/divi5-tools/app/` (`node server.js` on port 3747) |
| **Live WordPress test site** | `/Users/boss/Local Sites/divi-5-airtable-plugin/app/public` |
| Installed plugin (test target) | `/Users/boss/Local Sites/divi-5-airtable-plugin/app/public/wp-content/plugins/divi-tools-importer` |
| Site URL | TODO: confirm with user — likely `https://divi-5-airtable-plugin.local` |
| API key | Starts with `dtik_` — get from WordPress admin → Settings → Divi Tools Importer. **NEVER log it.** |
| Divi CSS cache | `wp-content/et-cache/{post_id}/` — clear after preset or import changes |

## Build / deploy / test flows

### Rebuild the plugin zip

The zip is **never committed** — the Claude Code plugin installer rejects packages containing a nested `.zip` ("nested zips not allowed"). It's built on demand from the canonical source. Two equivalent builders:

```bash
# Shipped builder — script-relative, no git, writes to a dir you choose.
# This is what /divi5-tools:help and the app's /download-plugin endpoint use:
bash plugins/divi5-tools/skills/import-to-local/scripts/build-plugin-zip.sh ~/Downloads

# Maintainer convenience — git-based, writes to the monorepo root:
bash plugins/divi5-tools/plugin/build-zip.sh
```

Both zip the canonical `plugin/divi-tools-importer/` source. Verify: `unzip -p <zip> divi-tools-importer/divi-tools-importer.php | grep Version` shows `1.2.0` (17 entries total).

### Deploy to Local WP test site

```bash
# Quick rsync — no zip needed:
bash plugins/divi5-tools/plugin/divi-tools-importer/deploy.sh
# rsyncs canonical source to /Users/boss/Local Sites/divi-5-airtable-plugin/.../divi-tools-importer/
```

Or upload the zip via WordPress admin: Plugins → Add New → Upload → select `divi-tools-importer.zip`.

**After deploying:** if presets changed, clear the Divi CSS cache:
```bash
rm -rf "/Users/boss/Local Sites/divi-5-airtable-plugin/app/public/wp-content/et-cache/"*
```

### Dev-watch (auto-deploy on save) — recommended for plugin development

Instead of running `deploy.sh` manually after every edit, use the watcher:

```bash
# Prerequisite (one-time):
brew install fswatch

# Start watching (run from anywhere):
bash plugins/divi5-tools/plugin/divi-tools-importer/dev-watch.sh
```

On every `.php` save in the canonical source, it:
1. rsyncs to the installed plugin at the Local WP test site (~200ms)
2. clears `wp-content/et-cache/*.css` so style/preset changes render immediately
3. logs `[HH:MM:SS] deployed + cache cleared`

**Loop becomes:** edit PHP in repo → save → refresh browser. No terminal switching.

Ctrl-C to stop. Pass a path arg to target a different site:
```bash
bash plugins/divi5-tools/plugin/divi-tools-importer/dev-watch.sh /path/to/other/site/wp-content/plugins/divi-tools-importer
```

The watcher is excluded from `deploy.sh` rsyncs (it never ships to production sites).

### Run the local app

```bash
cd plugins/divi5-tools/app
node server.js
# Listens on port 3747
```

### Run tests

```bash
# Unit tests (Node — no WordPress required):
cd plugins/divi5-tools/app && npm test

# Generator script tests:
cd plugins/divi5-tools/skills/divi5-page-generator/scripts && npm test
```

### Verify a deploy (byte-level)

```bash
# Compare zip contents against installed plugin:
md5sum divi-tools-importer.zip
ssh wp-site "md5sum /path/to/wp-content/plugins/divi-tools-importer.zip"
# Or: check individual file md5s from unzip vs installed
```

## Canonical source vs stale duplicates

| Source | Path | Version | Status |
|--------|------|---------|--------|
| **Canonical** | `plugins/divi5-tools/plugin/divi-tools-importer/` | v1.2.0 | ✅ Active — source of truth |
| Stale (removed) | `divi-tools-importer/` at repo root | v1.0.0 | ❌ Removed in commit `6785d33` (2026-06-22) |
| Importer zip | built on demand (not committed) | v1.2.0 | ✅ Built from canonical source on each request |
| Installed on test site | `/Users/boss/Local Sites/.../divi-tools-importer` | v1.2.0 | ✅ Synced via `deploy.sh` |

**CRITICAL:** The stale repo-root `divi-tools-importer/` was a v1.0.0 orphan with only 5 source files and no CSS cache fixes. It confused the initial diagnosis into thinking real restoration work was needed. **Never recreate it.** Always work from `plugins/divi5-tools/plugin/divi-tools-importer/`.

## REST API contract

All endpoints at `/wp-json/divi-tools/v1/*`. **All require** `X-Divi-Tools-Key` header (no query-param fallback — prevents access-log leaks).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/import` | Create a draft page from generated JSON |
| POST | `/preview` | Render a page server-side (no page created) — verify output before import |
| GET | `/export?slug=<slug>` | Export a page with presets + global colours |
| POST | `/presets/import` | Import a preset pack independently |
| GET | `/presets` | List all presets as name → ID map |
| GET | `/ping` | Health check — verify plugin is active and key is valid |

## Current development state

- **Phase -1 (DONE):** Rebuilt stale zip from v1.2.0 source, removed duplicate repo-root directory. Committed in `6785d33` (2026-06-22).
- **Phase 0 (DONE):** ET pack clone-first path. `scripts/et-pages.js` indexes the 24 premade pages and outputs importable JSON. SKILL.md Stage 0 makes the generator default to cloning from the ET pack before building from scratch.
- **Phases 1–4:** Planned, not started. Full plan at `docs/plans/2026-06-22-amazing-generator-from-new-or-existing.md`.

## Key decisions (don't re-litigate)

- **Preset strategy — hybrid inline+dedupe.** Inline preset attrs in every page (zero-setup). When a site registry is loaded via `loadPresetRegistry`, swap duplicate IDs for existing ones. Fixes the broken-button regression.
- **Mutator scope — constrained change-set first.** Phase 2 covers copy rewrites, colour swaps, image swaps, section reorder/add/remove (~90% of real client edits). Expand later.
- **Taste bar — universal anti-slop rules + per-aesthetic visual target.** Hard rules (no em-dashes, no three-equal-card grids, no AI-tell decoration, hero fits viewport) apply to every page. Floria references are default visual target.
- **Breaking change — clean break, no `--legacy` flag.** Validator changes will FAIL pages that currently pass (phantom preset IDs, raw hex matching tokens). Those pages were already rendering broken. Ship honest with migration notes.

## Known pitfalls

1. **Preset-first mode silently ships phantom preset IDs** if the pack isn't imported first. The validator currently trusts any ID when `presets.module` is empty.
2. **`colorRef()` / `variableRef()` throw on unknown labels.** The AI either bails or avoids the API entirely. Phase 1B plans a soft fallback.
3. **Divi generates front-end CSS from inline block attrs, NOT preset registry entries.** This is why preset-first mode without attr inlining produces default-blue buttons.
4. **WordPress `wp_kses_post()` corrupts block comment delimiters** containing JSON. The importer bypasses this via `$wpdb->update()` directly.
5. **Per-page CSS cache at `et-cache/{post_id}/` is NOT cleared by Divi's global cache API.** The importer now handles this automatically in `PageImporter.php::clear_page_css_cache()`.
6. **`$variable()$` refs in `decoration.background` inside presets produce no CSS.** Preset background MUST use raw hex. Font/text colours in presets CAN use variable refs.
7. **Button custom styles require `enable: 'on'`** — `button.decoration.button.desktop.value.enable: 'on'` or Divi ignores all background/border/font styles and falls back to default blue.

## Untapped resources

- **`references/Divi design system JSON/Divi-5-Launch-Freebie_Pages.json`** — 24 complete premade pages the generator doesn't use yet. Phase 0 (proposed) will add a "start from ET pack" ingestion path.
- **47 section types** in the same directory — structural inspiration the generator sometimes skips.

## Testing approach

| Layer | Tool / method | Location |
|-------|---------------|----------|
| Unit tests | Node.js (Vitest/Jest) | `app/tests/`, `scripts/__tests__/` |
| Integration | POST to `/preview` endpoint on Local WP | Deploy → generate page → verify render |
| Live verification | Playwright MCP screenshot diff | Screenshot live page, diff against HTML mockup |
| Build verification | `md5sum` zip vs installed plugin | Byte-level comparison |

For the planned Phase 4 test suite: each known past bug (doubled `divi/` prefix, code module with `[]`, button without `enable:'on'`, raw hex matching ET token, em-dash in copy, phantom preset ID) gets a fixture + expected validator verdict. CI-runnable, no WordPress required.
