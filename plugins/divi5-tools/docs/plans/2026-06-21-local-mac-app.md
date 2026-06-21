# Divi 5 Tools — Local Mac App Plan

**Date:** 2026-06-21  
**Status:** Approved  
**Goal:** A double-click Mac app that lets a non-technical user generate Divi 5 pages without ever touching a terminal.

---

## Proof of concept (confirmed)

`claude -p` with `--plugin-dir` and `--dangerously-skip-permissions` runs the full skill headlessly and writes output files. Tested 2026-06-21:

```bash
echo "/divi5-tools:divi5-page-generator Build a page for Acme Corp, keyword 'test', sections: Hero, CTA" \
  | claude -p \
      --plugin-dir "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools" \
      --dangerously-skip-permissions
# → writes acme-landing-page.json, acme-seo-meta.json to cwd
# → 0 validator errors, 0 warnings
```

---

## Architecture

```
Electron shell (double-click .app)
  └── Chromium window  →  HTML/CSS/JS form UI
  └── Node main process
        ├── Express-style IPC (or direct ipcMain)
        ├── child_process.spawn('claude', [...])
        ├── stdout streaming → window via IPC
        ├── file watcher on output dir
        └── downloads folder management
```

Electron is the right choice over a plain Express server because:
- Double-click to open — no terminal, no `node server.js`
- Can bundle Node without requiring the user to install it
- File system access for output folder picker
- Native Mac menu bar, dock icon, notifications

Claude Code (`claude` CLI) must be installed separately — it handles auth, the AI call, and all skill logic. The app just drives it.

---

## Phases

### Phase 1 — Working prototype (Express + HTML, ~1 day)

Prove the full loop before building the Electron shell. A local Express server the developer runs once to test.

**Files:**
```
app/
  server.js        — Express server, spawns claude, watches output dir
  public/
    index.html     — single-page form UI
    app.js         — fetch + SSE stream handler
    style.css
```

**server.js responsibilities:**
- `POST /generate` — receives form data, builds the claude prompt, spawns the process, streams stdout back via Server-Sent Events
- `GET /files` — lists generated JSON files in the output dir
- `GET /download/:file` — serves a file for download
- `POST /style-check` — runs style-check.js when an original export is uploaded

**Form fields (index.html):**
- Brand name (text)
- What it does / who it's for (textarea)
- Primary SEO keyword (text)
- Secondary keywords (text, optional)
- Sections (checkbox grid): Hero, About, Features, Process, Testimonials, Pricing, Stats, FAQ, CTA Band, Contact, Footer
- Aesthetic (radio): Organic Tech / Midnight Luxe / Brutalist Signal / Vapor Clinic / Minimal Editorial
- Primary CTA label + URL (text)
- DiviTheatre motion (radio): Yes / No / No but I want it
- Original designer export (file upload, optional — triggers style-check gate)
- Output folder (directory picker)

**Stream display:**
- Live terminal-style output panel showing claude's stdout
- Progress steps highlighted as they complete (Brief → Preview → Generate → Validate → Style Check)
- Final status: CONSISTENT / INCONSISTENT, validator pass/fail

**On completion:**
- List of output files with download buttons
- Copy-paste ready import instructions

---

### Phase 2 — Electron app (~2–3 days)

Wrap Phase 1 in Electron so it's a proper `.app`.

**Structure:**
```
divi5-generator/
  package.json
  main.js            — Electron main process
  preload.js         — context bridge (no nodeIntegration)
  src/
    server.js        — same Express logic, required by main.js
    renderer/        — same HTML/JS/CSS from Phase 1
  assets/
    icon.icns        — Mac dock icon
  build/             — electron-builder output → .dmg
```

**main.js responsibilities:**
- Launch Express server on random port on app start
- Open BrowserWindow pointing at localhost:{port}
- Find `claude` binary (check PATH, check `/usr/local/bin`, check npm global)
- Expose output folder via dialog (native macOS folder picker)
- Show dock badge when generation completes
- Menu bar: About, Check for Updates, Open Output Folder

**Packaging:**
- `electron-builder` → `.dmg` installer
- Universal binary (Apple Silicon + Intel)
- Notarized for Gatekeeper (requires Apple Developer account)
- Auto-update via `electron-updater` pointing at a GitHub releases feed

---

### Phase 3 — Style check integration (half day, after Phase 1)

When the user uploads an original designer export:
1. Save upload to a temp file
2. After page generation completes, run:
   ```bash
   node /path/to/divi5-style-check/scripts/style-check.js original.json output.json
   ```
3. Parse stdout, display the CONSISTENT / INCONSISTENT verdict in the UI
4. Show FAILs in red, WARNs in amber, gate the download button on CONSISTENT (with override option)

---

### Phase 4 — Spec compliance check (half day, after Phase 3)

After the user imports and re-exports from Divi, they can drag the exported file back in:
1. File drop zone: "Drop exported page JSON here to check against your brief"
2. Runs `design-review` skill in spec mode:
   ```bash
   echo "/divi5-tools:design-review exported.json --spec brief.md" | claude -p ...
   ```
3. Displays COMPLIANT / NON-COMPLIANT report
4. "Fix and Regenerate" button pre-fills the form with the original brief and re-runs

---

## UI design

```
┌─────────────────────────────────────────────────────┐
│  🎨 Divi 5 Page Generator                    _ □ ✕ │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Brand & Brief                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Brand name          [                      ] │   │
│  │ What it does        [                      ] │   │
│  │ Primary keyword     [                      ] │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Sections                                           │
│  ☑ Hero   ☑ Features   ☐ About   ☑ Testimonials   │
│  ☐ Pricing  ☑ FAQ   ☑ CTA Band  ☐ Contact         │
│                                                     │
│  Aesthetic                                          │
│  ○ Organic Tech  ● Midnight Luxe  ○ Brutalist      │
│  ○ Vapor Clinic  ○ Minimal Editorial               │
│                                                     │
│  Designer export (optional)  [  Drop file here  ]  │
│  Output folder               [ ~/Desktop/divi   ]  │
│                                                     │
│              [ Generate Page ]                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ▸ Stage 1 — Brief ✓                               │
│  ▸ Stage 2 — HTML Preview ✓                        │
│  ▸ Stage 3 — Generating JSON...                    │
│    Validator: 0 errors, 0 warnings ✓               │
│  ▸ Gate 1 — Style check: CONSISTENT ✓             │
│                                                     │
│  Output files                                       │
│  📄 acme-landing-page.json     [ Download ]        │
│  📄 acme-seo-meta.json         [ Download ]        │
│  📄 acme-schema.json           [ Download ]        │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites check on startup

On launch, the app checks:
1. `claude` binary found in PATH or common locations → ✓ / show install instructions
2. Claude Code is authenticated (`claude --version` exits 0) → ✓ / prompt to run `claude` once to authenticate
3. Node.js available (bundled in Electron, so always ✓)
4. divi5-tools plugin dir found (bundled with the app) → always ✓

---

## Storage — fully local (SQLite + filesystem)

Everything stays on the user's machine. No accounts, no internet dependency, no cloud.

| Data | Storage | Location |
|---|---|---|
| Generation history, briefs, check results | SQLite (`better-sqlite3`) | `~/Library/Application Support/Divi5Generator/history.db` |
| Output JSON files | Filesystem | User-chosen output folder (e.g. `~/Desktop/divi/`) |
| Uploaded designer exports | Filesystem | `~/Library/Application Support/Divi5Generator/exports/` |
| Log streaming | Server-Sent Events | Piped direct from claude subprocess stdout — no DB |

### SQLite schema

```sql
CREATE TABLE generations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  brand       TEXT NOT NULL,
  keyword     TEXT NOT NULL,
  sections    TEXT NOT NULL,   -- JSON array
  aesthetic   TEXT NOT NULL,
  cta_label   TEXT,
  cta_url     TEXT,
  output_dir  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running',  -- running | complete | failed
  style_check TEXT,   -- consistent | inconsistent | skipped
  spec_check  TEXT,   -- compliant | non-compliant | skipped
  validator_errors INTEGER DEFAULT 0,
  validator_warns  INTEGER DEFAULT 0,
  log         TEXT    -- full claude stdout, appended as it streams
);

CREATE TABLE output_files (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id  INTEGER REFERENCES generations(id),
  filename       TEXT NOT NULL,
  kind           TEXT NOT NULL   -- page | seo-meta | schema | generator-script
);

CREATE TABLE designer_exports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_at    TEXT NOT NULL DEFAULT (datetime('now')),
  label       TEXT NOT NULL,
  brand       TEXT NOT NULL,
  filepath    TEXT NOT NULL,
  preset_count INTEGER DEFAULT 0,
  colour_count INTEGER DEFAULT 0
);
```

### Log streaming (SSE — no database polling)

```
User submits form
  → POST /generate
    → INSERT INTO generations → id
    → spawn claude subprocess
    → pipe stdout chunks → SSE stream to browser (live terminal panel)
    → append chunks to generations.log in DB (for history)
    → watch output dir for new .json files → INSERT INTO output_files
    → on exit → UPDATE generations SET status='complete'
  → browser SSE listener updates progress steps + download buttons in real time
```

No framework reactivity needed — SSE is native to the browser and handles the streaming cleanly.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron 30 | Double-click .app, native file dialogs, bundles Node |
| UI | Plain HTML/CSS/JS | No framework needed — SSE handles live updates natively |
| Storage | SQLite (`better-sqlite3`) | Zero setup, single file, fully local, fast |
| File storage | Filesystem | Output files stay where the user expects them |
| Streaming | Server-Sent Events | Pipe claude stdout direct to browser — simple and reliable |
| Packaging | electron-builder | .dmg + auto-update |
| Claude | `claude` CLI subprocess | Handles auth, skills, all AI logic |

---

## What the app does NOT do

- Host anything online — fully local, no backend
- Store any user data — output files go to their chosen folder, nothing else persists
- Require an Anthropic API key — Claude Code's existing auth is used
- Replace the full skill — power users can still run the skill directly in Claude Code for advanced options

---

## Delivery order

1. **Convex setup** — `npx convex dev`, define schema, deploy to a project
2. **Phase 1** (Express + React prototype) — form UI, spawns claude, writes history to Convex, streams log via Convex mutations
3. **Phase 3** (style-check gate) — wire in, result stored on `generations.styleCheck`
4. **Phase 2** (Electron wrap) — bundle React app + Express + Convex client into `.app`
5. **Phase 4** (spec compliance) — drag-and-drop post-import check, result on `generations.specCheck`

Estimated total: **4–5 days** for a working, distributable `.dmg` with full history.

### Convex account setup (one-time)

```bash
npm install convex
npx convex dev   # creates project, opens browser to log in
# → CONVEX_URL written to .env.local
# → types auto-generated in convex/_generated/
```

The Convex URL is bundled into the Electron app at build time. End users need no Convex account — they use the shared project.
