---
name: import-to-local
description: "Import Divi 5 landing page JSON into a Local (localwp.com) WordPress site as a draft page, open the preview, and run the accept/refine loop. Use when: importing Divi JSON into a Local site, previewing a generated Divi page, publishing an approved Divi landing page, re-importing after edits. Triggers: import divi page, import to local, localwp import, preview divi page, publish divi landing page, divi local site."
---

# Divi 5 → Local WP Importer

Close the loop on a generated Divi 5 page: validate it, import it into a running Local site as a **draft**, open the preview, then act on the user's verdict — accept, refine, or re-import. The rendered page is the judgement surface.

## Non-negotiable rules

1. **Draft first, always.** Import creates/updates a draft keyed on slug. Publish only on the user's explicit accept (`--publish`).
2. **Never touch any page other than the draft keyed to this import's slug.** No deletes, no edits to other content.
3. **Validator FAILs block import** — run the sibling `landing-page` skill's `scripts/validate.js` first; no overrides. WARNs are reported but importable.
4. **All WordPress mutation goes through `scripts/wp.sh` + `wordpress/import-divi-page.php`.** Never raw SQL, never editing site files directly.
5. **Refinements amend the run's `generate-*.js` builder script and regenerate** — never hand-edit generated JSON.
6. **Re-runs with the same slug update the same draft.** No page litter.

## Workflow

### 1. Resolve inputs

- **Layout JSON**: explicit path if the user gave one; otherwise the most recent `*-landing-page.json` in the working directory. Confirm if ambiguous. Context must be `et_builder`.
- **SEO meta**: the matching `*-seo-meta.json` if present (title tag, meta description, slug).
- **Target site**: run `node scripts/list-local-sites.js --json`. One running site → use it (tell the user which). Several running → ask via AskUserQuestion. None running → tell the user to start the site in Local; do not proceed.

### 2. Validate

```bash
node <plugin>/skills/landing-page/scripts/validate.js <layout.json> --keyword "<kw>" --meta <seo-meta.json>
```

Fix FAILs (or hand back to the `landing-page` skill) before going further. Show the report.

### 3. Preflight the site

```bash
bash scripts/wp.sh <site-id> <public-dir> option get siteurl
```

- Output must match the site's domain — wrong DB means stop.
- First run on a machine: see `references/local-environment.md` if the env extraction in `wp.sh` needs adjusting for the installed Local version.

### 4. Import

```bash
bash scripts/wp.sh <site-id> <public-dir> eval-file wordpress/import-divi-page.php <layout.json> <seo-meta.json>
```

The PHP bridge (verified against Divi 5 beta 9.1 source):

- imports presets via `GlobalPreset::process_presets_for_import` and rewrites remapped preset IDs into the content,
- imports global colours (tuple → assoc conversion, merged) and global variables,
- creates/updates the draft, sets `_et_pb_use_builder` + `_et_pb_use_divi_5`,
- sets Yoast/RankMath meta when present (otherwise prints the values for manual entry),
- emits `IMPORT_REPORT:{json}` — parse it.

If the report warns that Divi 5 helpers were missing, tell the user Divi 5 isn't active on that site; content-only import has already happened, presets/colours have not.

### 5. Preview

Open the report's `previewUrl` in the browser (`open <url>` on macOS). Present the report: action taken, what was imported, validator/SEO report card, and remind about `*-schema.json` → Divi > Theme Options > Integration > head.

### 6. Decide

| Verdict | Action |
|---|---|
| **Accept** | Re-run the import with `--publish` (or `wp.sh <id> <dir> post update <pageId> --post_status=publish`). Confirm the live URL. |
| **Refine** | Take the feedback, amend the run's `generate-*.js` builder script, re-run it, re-validate, re-import (same slug → same draft). |
| **Re-import** | User hand-edited the builder script or JSON: validate, then import again. |
| **Rewrite** | Hand back to the `landing-page` skill with the amended brief. |

## Resources

- `scripts/list-local-sites.js` — site discovery from Local's `sites.json` + running heuristic
- `scripts/wp.sh` — WP-CLI against a Local site via its ssh-entry environment
- `wordpress/import-divi-page.php` — the import bridge (run via `wp eval-file`)
- `references/local-environment.md` — Local paths, mechanisms, first-run verification, pitfalls
