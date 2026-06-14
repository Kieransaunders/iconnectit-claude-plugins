---
name: style-variables
description: "Brand guide → Divi 5 Global Variables converter. Turns a style guide, brand guidelines, or design tokens (prose, JSON, CSV, or table) into an importable Divi 5 Global Variables JSON (global_colors + global_variables, et_builder context)."
when_to_use: "Converting a style guide, brand guidelines, design tokens, or a colour/spacing/typography spec into Divi 5 global variables or global colours for import. Triggers: divi global variables, divi global colors, style guide to divi, design tokens divi, brand colours divi import."
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

## Usage with the landing-page skill

When the user also wants a page built, generate the variables file first, then pass the same ids into the landing-page generator so the layout references `$variable({"type":"color","value":{"name":"gcid-…","settings":{}}})$` instead of raw hex — one palette, site-wide control.
