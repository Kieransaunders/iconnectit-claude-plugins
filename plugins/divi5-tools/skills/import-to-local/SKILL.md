---
name: import-to-local
description: "Import Divi 5 landing page JSON into any WordPress site (local or hosted) as a draft page via the Divi Tools Importer plugin REST API, then open the preview and run the accept/refine loop."
when_to_use: "Importing or deploying a generated Divi 5 page into WordPress and previewing it. Triggers: import divi page, import to local, localwp import, preview divi page, publish divi landing page, divi local site, import divi hosted, deploy divi page."
argument-hint: "[site-url] [api-key]  — or omit to be prompted"
---

# Divi 5 Page Importer

Close the loop on a generated Divi 5 page: validate it, push it to any WordPress site via the Divi Tools Importer plugin, open the preview, then act on the user's verdict. Works on **any host** — Local, Kinsta, WP Engine, SiteGround, Flywheel — no SSH or WP-CLI required.

## Pre-requisite

The **Divi Tools Importer** plugin must be installed and active on the target site.

The plugin ships as unpacked source under `plugin-src/` (a bundled `.zip` can't live inside a Claude Code plugin — the installer rejects nested zips). Build the installable zip on demand:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/build-plugin-zip.sh" ~/Downloads
```

It prints the path to the finished zip (e.g. `~/Downloads/divi-tools-importer.zip`). Tell the user:

> "I've built the plugin zip at `~/Downloads/divi-tools-importer.zip`. Install it via **WordPress Admin → Plugins → Add New → Upload Plugin**, then activate it."

After activation they go to **Settings → Divi Tools Importer** to copy their site URL and API key.

## Non-negotiable rules

1. **Draft first, always.** Never pass `"publish": true` unless the user explicitly says "publish" or "go live".
2. **Never touch any page other than the draft keyed to this import's slug.**
3. **Validator FAILs block import** — run `landing-page`'s `scripts/validate.js` first; fix all FAILs before sending. WARNs are reported but don't block.
4. **Refinements amend the run's `generate-*.js` and regenerate** — never hand-edit the JSON.
5. **Re-runs with the same slug update the same draft.** No page litter.
6. **Never log or store the API key.** Use it only in the request header.

---

## Workflow

### 1. Resolve inputs

**Layout JSON** — explicit path if given; otherwise the most recent `*-landing-page.json` or `*-section.json` in the working directory. Confirm if ambiguous.

Check the `context` field to determine import type:
- `"context": "et_builder"` → **page import** (standard flow below)
- `"context": "et_builder_layouts"` → **section/library import** — use the same `/import` endpoint; the plugin handles both contexts. Remind the user to import via **Divi Library → Import → check "Import Presets"**, not via page import. Skip SEO and schema steps (not applicable to sections).

**SEO meta** — matching `*-seo-meta.json` if present. Keys used: `title`/`titleTag`, `description`/`metaDescription`, `slug`, `keyword`.

**Schema** — matching `*-schema.json` if present. Sent as-is; the plugin stores it and auto-injects it into `<head>` by slug.

**Site URL + API key** — from `$ARGUMENTS`, or ask via AskUserQuestion:
- "What is your WordPress site URL?" (e.g. `https://mysite.com` or `http://mysite.local`)
- "What is your Divi Tools Importer API key?" (starts with `dtik_`)

### 2. Validate

```bash
node <CLAUDE_SKILL_DIR>/../landing-page/scripts/validate.js <layout.json> \
  --keyword "<keyword from seo-meta>" \
  --meta <seo-meta.json>
```

Show the report. Stop on any FAIL — hand back to `landing-page` skill to fix.

### 2.5. Live preview (fidelity gate — before full import)

Build a temporary payload with just the layout:

```bash
node -e "
const l = JSON.parse(require('fs').readFileSync('<layout.json>','utf8'));
require('fs').writeFileSync('preview-payload.json', JSON.stringify({layout:l}));
"
```

POST it to the preview endpoint:

```bash
curl -s -X POST "<site-url>/wp-json/divi-tools/v1/preview" \
  -H "Content-Type: application/json" \
  -H "X-Divi-Tools-Key: <api-key>" \
  -d @preview-payload.json
```

Parse the response and open the `preview_url` in the browser:

```bash
open "<preview_url>"
```

This renders the page via **real Divi 5** — full presets, global colours, animations, responsive breakpoints — without creating a named page. The preview overwrites a fixed draft (`dti-live-preview`) each time, so there is no page litter.

Wait for the user's verdict:

| Verdict | Action |
|---|---|
| **Approved** | Proceed to Step 3 (full `/import`) |
| **Refine** | Hand back to `landing-page` skill — fix `generate-*.js`, regenerate, re-validate, re-preview |

### 3. Ping the site

```bash
curl -s "<site-url>/wp-json/divi-tools/v1/ping?dti_key=<api-key>"
```

Check the response:
- `status: "ok"` → proceed
- HTTP 401 → wrong key, ask the user to check Settings → Divi Tools Importer
- HTTP 404 → plugin not active, ask user to activate it
- Connection refused / timeout → site is down or URL is wrong

Report what was detected: Divi 5, Yoast, RankMath. If no SEO plugin, warn the user they'll need to set meta manually.

### 4. Build the payload and import

Assemble `payload.json` in the working directory:

```json
{
  "layout":  <contents of layout JSON>,
  "seo":     <contents of seo-meta JSON, or {}>,
  "schema":  <contents of schema JSON, or {}>,
  "publish": false
}
```

Send it:

```bash
curl -s -X POST "<site-url>/wp-json/divi-tools/v1/import" \
  -H "Content-Type: application/json" \
  -H "X-Divi-Tools-Key: <api-key>" \
  -d @payload.json
```

Parse the JSON response. On error:
- `401` → invalid key
- `422` → layout validation failed (show `message`)
- `429` → rate limited, wait 60s and retry
- `500` → server error (show `message`)

### 5. Present the report

Show the user:
- Page action (created / updated), slug, status (draft/published)
- What was imported: presets, global colours, global variables
- SEO plugin used (or warning if none)
- Schema saved: yes/no
- Any warnings from the plugin
- Preview URL (open it: `open <previewUrl>` on macOS)
- ~~Schema reminder~~ — **not needed**, the plugin handles it automatically

### 6. Decide

| Verdict | Action |
|---|---|
| **Accept** | Re-send with `"publish": true`. Confirm the live URL from `slug`. |
| **Refine** | Take feedback, amend `generate-*.js`, regenerate, re-validate, re-import. |
| **Re-import** | User edited the script: validate then import again (same slug → same draft). |
| **Rewrite** | Hand back to `landing-page` skill with amended brief. |

---

## Publish flow (after accept)

```bash
curl -s -X POST "<site-url>/wp-json/divi-tools/v1/import" \
  -H "Content-Type: application/json" \
  -H "X-Divi-Tools-Key: <api-key>" \
  -d @payload.json  # same payload with "publish": true
```

Confirm the live URL: `<site-url>/<slug>/`
