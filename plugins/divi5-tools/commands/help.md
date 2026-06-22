---
description: Divi 5 Tools help — find & install the importer plugin zip, get the API key, then generate/import pages.
---

# Divi 5 Tools — Getting Started

Walk the user through setup. Be concise. Run the steps below, adapting to where they already are.

## 1. Build the importer plugin zip

The **Divi Tools Importer** WordPress plugin ships as unpacked source (a Claude Code plugin can't bundle a nested `.zip`). Build the installable zip — find the build script first (its location varies by install method), then run it, writing the zip to `~/Downloads`:

```bash
SCRIPT=$(find ~/.claude/skills ~/.claude/plugins/cache ~/.claude/plugins/marketplaces \
  -path '*import-to-local/scripts/build-plugin-zip.sh' 2>/dev/null | head -1)
[ -n "$SCRIPT" ] && bash "$SCRIPT" ~/Downloads
```

Report the printed zip path (e.g. `~/Downloads/divi-tools-importer.zip`) to the user. If the script isn't found, the plugin isn't installed — have them re-install divi5-tools.

## 2. Install it in WordPress

Tell the user:

> 1. **WP Admin → Plugins → Add New → Upload Plugin** → choose the zip above → **Install** → **Activate**.
> 2. Go to **Settings → Divi Tools Importer**.
> 3. Copy your **Site URL** and **API key** (the key starts with `dtik_`).

Works on any host — Local, Kinsta, WP Engine, SiteGround, Flywheel. No SSH/WP-CLI needed.

## 3. Come back with credentials

Ask for the **Site URL** and **API key**, then hand off:

- **Generate a page** → invoke the `divi5-page-generator` skill (`/divi5-tools:divi5-page-generator`).
- **Import an existing JSON** → invoke the `import-to-local` skill with the site URL + API key.

Never log or store the API key — use it only in the request header.

## Quick reference

| Want to… | Do this |
|----------|---------|
| Build a page | `/divi5-tools:divi5-page-generator "<brief>"` |
| Import/preview a page | `import-to-local` skill |
| Standalone browser UI | double-click `app/launch.command` (→ http://localhost:3747) |
| Review a Divi export | `design-review` / `divi5-style-check` skills |
