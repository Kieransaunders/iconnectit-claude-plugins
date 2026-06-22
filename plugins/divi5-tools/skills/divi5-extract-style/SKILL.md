---
name: divi5-extract-style
description: "Divi 5 style extraction and variables tool: (1) brand guide / design tokens → importable Divi 5 Global Variables JSON; (2) an existing Divi 5 page export → design tokens (colours, variables, presets) the page generator can reuse."
when_to_use: "Extracting the design system from an existing Divi 5 page export so new pages can be generated in the same style — OR converting a brand style guide into Divi 5 global variables. Triggers: extract divi style, reuse divi design, divi export to tokens, divi global variables, divi global colors, style guide to divi, design tokens divi, brand colours divi import, reuse divi design system, extract divi presets, divi export design system."
argument-hint: "[style guide text, token table, or file path]"
---

# Divi 5 Style Variables Generator

Convert brand guidelines or design tokens into a Divi 5 Global Variables import JSON. Import destination: **Divi → Divi Library → Import & Export → Import Global Variables**.

## Rules

1. **Extract only explicit values.** Never invent brand colours or sizes. If the guide says "our blue" without a hex, list it in the missing-values report instead of guessing. Derived shades (hover states, tints) are allowed only when the user asks for them, and must be labelled as derived.
2. **Every token gets a stable, readable id**: `gcid-<kebab-label>` for colours, `gvid-<kebab-label>` for numbers/strings. Lowercase alphanumeric + hyphens.
3. **Output is a single importable JSON file** — no placeholders.

## Output format

```json
{
  "context": "et_builder",
  "data": {},
  "presets": { "module": {} },
  "global_colors": [
    ["gcid-primary", {"color": "#1A2744", "status": "active", "label": "Primary Navy"}],
    ["gcid-accent", {"color": "#F97316", "status": "active", "label": "Accent Orange"}]
  ],
  "global_variables": [
    {"id": "gvid-radius-buttons", "label": "Rounded Corners - Buttons", "value": "8px", "status": "active", "type": "numbers"},
    {"id": "gvid-font-size-body", "label": "Font Size - Body", "value": "16px", "status": "active", "type": "numbers"}
  ],
  "images": {},
  "thumbnails": []
}
```

- `global_colors` entries are **tuples**: `[id, {color, status, label}]`.
- `global_variables` entries are **objects**: `{id, label, value, status, type}` where `type` is `"numbers"` for any CSS length/size value.
- Verified against official Divi 5 Design System exports (e.g. `"gvid-…", "label": "Border Width", "value": "1px", "type": "numbers"`).

## What to extract

| Token class | Target | Examples |
|-------------|--------|----------|
| Brand colours | `global_colors` | primary, secondary, accents, neutrals, backgrounds, text colours |
| Font sizes | `global_variables` (numbers) | h1–h6, body, caption, button |
| Spacing | `global_variables` (numbers) | section padding, card padding, gaps |
| Radii | `global_variables` (numbers) | buttons, cards, images |
| Line heights / letter-spacing | `global_variables` (numbers) | body line height, eyebrow tracking |
| Borders | `global_variables` (numbers) | border widths |

## Deliverables (in order)

1. Suggested filename: `<Brand>_Global-Variables.json`
2. The JSON file, written to the working directory
3. A token report table: id, label, value, type, source (quoted from the guide)
4. Missing/ambiguous checklist: anything the guide mentions without an explicit value

## Usage with the divi5-page-generator skill

When the user also wants a page built, generate the variables file first, then pass the same ids into the divi5-page-generator so the layout references `$variable({"type":"color","value":{"name":"gcid-…","settings":{}}})$` instead of raw hex — one palette, site-wide control.

## Reusing an existing site's design system (Divi export → tokens)

When the user has an existing Divi 5 site/theme and wants generated pages to **inherit its branding** (rather than convert a fresh style guide), extract the design system from a Divi export instead of authoring one.

Divi 5 variables and presets are **global, site-level records referenced by id** (`gcid-…`, `gvid-…`, and random preset ids). A generated page inherits a site's design system for free *as long as it references ids that already exist on that install*. The generator supports this (`globalColor('gcid-…')` reuses the id; `preset: '<id>'` binds `modulePreset`) — it just needs to be told the ids.

**Run the extractor:**

```bash
node ${CLAUDE_SKILL_DIR}/scripts/extract-from-export.js <export.json> --out <dir> --name "<Brand>"
```

It parses `global_colors` (resolving derived `$variable(...)$` shades), `global_variables`, and `presets.module` + `presets.group`, then writes:

| File | Purpose |
|------|---------|
| `<name>.variables.json` | Importable Global Variables — seeds a **fresh** site (Divi → Import Global Variables). |
| `<name>.tokens.js` | `require()`-able token map for `generate-<brand>.js`: `colorRef[label]`, `colorId[label]`, `colorHex[id]`, `variableRef[label]`, `variableId[label]`, `preset[name]`, `presetList`. |
| `<name>.presets.json` | Raw module + group preset definitions for reference / re-import. |

…and prints a report table of every colour, variable and preset with its id.

**Two reuse paths — pick by target site state:**

1. **Existing site** (the export is already imported there) — in `generate-<brand>.js`, drop `T.colorRef['<label>']` straight into colour fields and pass `preset: T.preset['<name>']`. Nothing extra to import; the page binds to the live design system. **Do not** re-register those colours via `builder.globalColor()` — that ships a second definition that can collide with the site's.
2. **Fresh site** — import `<name>.variables.json` first (and the original export with **Import Presets** checked to land the presets), then generate as above.

Verified end-to-end against a real export: the generated page references the existing `gcid-…` colour ids and binds `modulePreset` to the existing `h1` / `body text` / row preset ids.
