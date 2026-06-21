# Divi 5 Generator App — Improvement Plan

**Date:** 2026-06-21  
**Status:** Draft  
**Scope:** Everything needed to turn the Phase 1 Express prototype into a polished, self-installing tool a non-technical user can actually hand to a client.

---

## Does it install itself? No — and that's the biggest gap.

Current state: a developer runs `npm install && node server.js` and opens `http://localhost:3747`. A non-technical user cannot do this.

Every improvement below is ranked by how much it removes friction for a non-developer user.

---

## Priority 1 — Self-launching (blocks everything else)

### 1A. One-click launcher script

**Problem:** User needs a terminal to start the server.  
**Fix:** A double-click shell script that opens the browser automatically.

```bash
# launch.command  (chmod +x so Finder can double-click it)
#!/bin/bash
cd "$(dirname "$0")"
npm install --silent 2>/dev/null
node server.js &
sleep 2
open http://localhost:3747
```

Put `launch.command` in the app root. On macOS, `.command` files open in Terminal and run when double-clicked from Finder. One file, zero developer knowledge required.

**Effort:** 30 minutes. **Do this first.**

### 1B. Keep-alive: reopen if server dies

Add a simple retry loop in `launch.command` so if the user quits accidentally and re-clicks, it restarts cleanly:

```bash
# Kill any existing instance on port 3747 before starting
lsof -ti:3747 | xargs kill -9 2>/dev/null
```

### 1C. Electron wrap (Phase 2 — after 1A is proven)

Replace `launch.command` with a proper `.app` bundle. User drags it to Applications, double-clicks, it appears in the Dock. No Terminal window visible at all.

The Express server runs as a child process of the Electron main process. Electron adds:
- Native macOS dock icon + menu bar
- Native folder picker (replaces the text field for output folder)
- Desktop notification when generation completes
- Auto-quit when window closes

---

## Priority 2 — Missing functionality (the app looks complete but isn't)

### 2A. Import to WordPress button

**Problem:** Settings tab saves the site URL and API key but nothing uses them. After generation, the user still has to manually import.  
**Fix:** Add an **Import to Site** button next to each output file's Download button. It calls `/import` on the server which POSTs the JSON to the WordPress REST endpoint.

```
POST /import/:generationId
  → reads output_files WHERE kind='page'
  → reads settings siteUrl + apiKey
  → POST https://site.com/wp-json/divi-tools/v1/import
      { layout: <json>, seo: <seo-meta>, schema: <schema>, draft: true }
  → returns { previewUrl }
  → UI opens preview in browser tab
```

Add `import_status` and `preview_url` columns to `generations` table.

Result in UI: after clicking Import, a **Preview in WordPress** link appears. User clicks, sees the draft page in real Divi.

### 2B. HTML preview approval step

**Problem:** Stage 2 (HTML preview gate) happens inside Claude's output stream. The user sees log text like "preview-brand.html built" but can't actually see or approve it.  
**Fix:** When the file watcher detects a `preview-*.html` in the output dir, serve it at `/preview/:generationId` and show a **View Preview** button in the UI that opens it in a new tab. Add an **Approve** / **Revise** pair of buttons — Approve resumes generation, Revise sends a follow-up prompt.

This is the biggest UX improvement for non-technical users — they can actually see and sign off the design before JSON is generated.

### 2C. Output folder picker (native dialog)

**Problem:** The output folder is a text field — a non-technical user won't know what `~/Desktop/divi-output` means.  
**Fix (pre-Electron):** A `GET /pick-folder` endpoint that uses AppleScript to show a native folder picker:

```js
execSync(`osascript -e 'POSIX path of (choose folder with prompt "Where should output files be saved?")'`)
```

Returns the chosen path. The UI calls it and fills the text field.

**Fix (Electron):** `dialog.showOpenDialog({ properties: ['openDirectory'] })` — standard native picker.

### 2D. Style check details expandable

**Problem:** The style check verdict (CONSISTENT / INCONSISTENT) shows as a badge but the full report (which preset IDs failed, which colours are wrong) is buried in the log.  
**Fix:** Parse the `--- STYLE CHECK ---` block from the log and display it as a structured panel under the output files section — expandable, with FAILs highlighted in red and WARNs in amber. Include the "To fix" preset IDs so the user knows exactly what went wrong.

---

## Priority 3 — UX polish

### 3A. Aesthetic previews

**Problem:** "Midnight Luxe", "Brutalist Signal" etc. mean nothing to a non-designer.  
**Fix:** Add a small thumbnail or colour swatch + one-line description next to each radio option. Pull the palette from `references/aesthetics.md`.

| Aesthetic | Swatch colours | One-liner |
|---|---|---|
| Minimal Editorial | `#111` `#fff` `#e5e5e5` | Clean, white-space-led, editorial |
| Midnight Luxe | `#0a0a0f` `#c9a84c` `#1a1a2e` | Dark, gold accents, premium feel |
| Organic Tech | `#1a2e1a` `#7ab648` `#f5f0e8` | Warm green, natural, sustainable |
| Brutalist Signal | `#000` `#ff2d00` `#fff` | Bold, high-contrast, direct |
| Vapor Clinic | `#0d0d1a` `#a78bfa` `#e0d7ff` | Purple-toned, clinical, AI-forward |

### 3B. Re-run / tweak past generation

**Problem:** History panel shows past runs but clicking one only loads the log — there's no way to re-use the brief to generate again with tweaks.  
**Fix:** Add a **Re-run** button on each history item that pre-fills the form with the original brief fields (brand, keyword, sections, aesthetic, cta) so the user can adjust and regenerate.

### 3C. Saved designer exports library

**Problem:** The designer export is uploaded fresh each time.  
**Fix:** Saved exports (already in the DB) should appear as a dropdown on the Generate tab — "Use saved export: [label]" — so the user doesn't re-upload the same file every time.

### 3D. Settings connection test

**Problem:** User saves a site URL and API key with no confirmation they work.  
**Fix:** A **Test Connection** button next to Save that pings `GET /wp-json/divi-tools/v1/status` on the target site and returns either "Connected ✓" or a specific error (wrong URL, API key rejected, plugin not activated).

### 3E. Progress step for import

Add a **Stage 5 — Import to WordPress** step to the progress tracker that activates when Import is clicked, showing "Uploading…" → "Draft created ✓" → **Preview** link.

---

## Priority 4 — Spec compliance (post-import gate)

### 4A. Post-import export drop zone

After the user previews and publishes, they export the live page from Divi and drag it back into the app. The app runs `design-review --spec` comparing it against the original brief fields stored in the DB.

**UI:** A second drop zone below the output files panel, labelled "Drop exported page JSON here to check spec compliance". Shows COMPLIANT / NON-COMPLIANT verdict with the same structured report as the style check.

---

## Summary table

| # | Improvement | Effort | Impact |
|---|---|---|---|
| 1A | `launch.command` self-starter | 30 min | Unblocks all non-dev users |
| 2A | Import to WordPress button | 2h | Closes the loop end-to-end |
| 2B | HTML preview approval in UI | 3h | Biggest UX win |
| 2C | Native folder picker | 1h | Removes text-field confusion |
| 3D | Settings connection test | 1h | Removes silent misconfiguration |
| 3C | Saved exports dropdown | 1h | Saves repeated uploads |
| 2D | Style check details panel | 1h | Makes FAILs actionable |
| 3A | Aesthetic previews | 2h | Helps non-designers choose |
| 3B | Re-run from history | 1h | Quality-of-life |
| 3E | Import progress step | 30 min | Consistency |
| 4A | Post-import spec drop zone | 2h | Completes the QA pipeline |
| 1C | Electron .app | 3–4 days | Fully native — do last |

**Recommended order:** 1A → 2A → 3D → 2C → 3C → 2D → 2B → 3A → 3B → 1C

Start with 1A today — it takes 30 minutes and immediately makes the app usable by anyone with Node installed.
