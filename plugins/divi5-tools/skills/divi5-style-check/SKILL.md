---
name: divi5-style-check
description: "Divi 5 style consistency auditor — compares an original designer Divi 5 export against a newly generated page JSON and verifies that presets, colours, and typography from the original are actually reused, not replaced with new IDs or inline values."
when_to_use: "After generating a new Divi 5 page from a designer's export, to verify the generated page actually inherits the designer's design system (presets, colours, fonts) rather than creating its own. Use as a QA gate between divi5-page-generator and import-to-local. Triggers: check divi style, verify divi consistency, divi style audit, divi preset check, divi colour check, style check divi, divi design inheritance, divi style gate."
argument-hint: "<original-export.json> <generated-page.json>"
allowed-tools: Bash(node *)
---

# Divi 5 Style Consistency Checker

You are a Divi 5 style consistency auditor. A web designer has an existing Divi 5 page with an established design system (presets, global colours, typography). A new page has been generated that should inherit that design system. Your job is to verify it actually does.

## Workflow position

```
/divi5-extract-style  → *.tokens.js
/divi5-page-generator → new-page.json
/divi5-style-check original-export.json new-page.json  ← YOU ARE HERE
/import-to-local      → live page
```

Run this check **before** importing a generated page. If it returns INCONSISTENT, fix the generator script and regenerate — do not import a page that fails.

## Running the check

```bash
node ${CLAUDE_SKILL_DIR}/scripts/style-check.js <original-export.json> <generated-page.json>
```

The script exits `0` (CONSISTENT) or `1` (INCONSISTENT).

## What the script checks

### 1. Preset reuse
Extracts every preset ID from the designer's export (`presets.module[*].items` keys).
For every `modulePreset` reference in the generated page:
- **PASS** — preset ID exists in the designer's export
- **FAIL** — preset ID is new (not in the designer's export) — the generator created a fresh preset instead of reusing the designer's

### 2. Colour consistency
Extracts every colour value from the designer's export (`global_colors` + hex values in preset styleAttrs).
For every colour in the generated page (gcid- variable refs and raw hex values):
- **PASS** — colour matches one from the designer's palette
- **FAIL** — colour is not in the designer's palette — the generator introduced a new colour
- **WARN** — colour appears as raw hex in the generated page where the designer used a `gcid-` variable ref

### 3. Typography consistency
Extracts font families from the designer's presets.
For every font family used in the generated page:
- **PASS** — font family matches one from the designer's export
- **WARN** — inline font override on a module that also has a preset reference (confirm it's preset-inherited, not a diverging override)
- **FAIL** — font family not present anywhere in the designer's export

### 4. Structural preset coverage
Lists every module type in the generated page. For each type:
- **PASS** — at least one module of that type has a `modulePreset` from the designer's export
- **WARN** — module type has no preset reference and will render with Divi global defaults

## Reading the report

```
STYLE CONSISTENCY REPORT
========================
Original export:  designer-export.json  (12 presets, 8 colours)
Generated page:   new-page.json  (~47 blocks, 23 preset refs)

Preset reuse:     23/23 references match designer presets
Colour palette:   31 colour refs — 30 match, 1 new
Typography:       2 font families in generated; 2 in designer presets
Structural:       6/6 module types have designer-preset coverage

FAILS (1):
  ✖ Colour palette — raw hex "#e74c3c" at content[3].attrs.background is not in designer's palette

WARNINGS (2):
  ⚠ Colour — raw hex "#1a2744" at content[1].attrs.color matches palette but designer used a gcid- variable ref
  ⚠ Structural — module type "divi/divider" has no preset reference — will render with Divi defaults

VERDICT: INCONSISTENT ✖

To fix — use these from the designer's export instead:
  Colour palette from original export:
    gcid-primary  #1a2744
    gcid-accent   #f97316
    …
```

## Fixing FAILs

When the check returns INCONSISTENT, open the generator script and address each FAIL:

| FAIL type | Fix |
|---|---|
| Preset ID not in designer's export | Use the preset IDs listed in the "To fix" section — pass them as `preset: '<id>'` in the builder |
| Colour not in palette | Replace the raw hex with `builder.globalColor('gcid-…')` using an ID from the designer's export |
| Font family not in export | Remove the inline `fontFamily` override — let the preset inherit the correct font |

**Regenerate** after fixing, then re-run the style check to confirm CONSISTENT before importing.

## WARN-only is acceptable to import

A report with zero FAILs but some WARNs is safe to import. Address WARNs when possible (prefer `gcid-` refs over raw hex; add presets to uncovered module types), but they are not blockers.
