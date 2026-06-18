# Variable-First Builder Design

**Date:** 2026-06-18
**Scope:** divi5-tools landing-page skill — three-phase quality and capability upgrade
**Status:** Approved

## Context

The landing-page skill generates Divi 5 JSON using a Node builder library. Currently all colour, typography, and spacing values are hardcoded raw strings (`#F95E00`, `48px`, `6em`). The Elegant Themes official design system (now bundled as reference tokens) exposes these values as site-level variables (`gcid-*` colours, `gvid-*` spacing/type). Divi 5 resolves `$variable(...)$` refs server-side for all CSS fields — confirmed in `builder-5/server/FrontEnd/Module/Style.php`.

This design covers three ordered improvements:

---

## Phase 3 — Design System Linting in `validate.js`

**Why first:** Isolated, ~2 hours, immediately improves every generated page.

### Two new checks

**COLOUR TOKEN CHECK — FAIL**
- Build a Set of hex values from `doc.global_colors` + ET design system token file
- Scan stringified module attrs for raw `#rrggbb` / `rgba()` values
- If the hex resolves to a known token → FAIL: `"Use builder.colorRef('White') not '#ffffff'"`
- Unknown hex (custom brand colour, no matching token) → pass silently

**VARIABLE TOKEN CHECK — WARN**
- Build a Map of values from `global_variables` + ET token file (`variableValue` map)
- Scan for literal `px`/`em`/`clamp()` values that exactly match a token value
- Known match → WARN: `"Consider builder.variableRef('H1 Fluid') instead of 'clamp(26px, 0.22rem + 6vw, 90px)'"`
- Unrecognised value → pass

### Where it lives
`scripts/validate.js` — two new functions after the existing structural checks, using the same report-card pattern. Reads the ET tokens file from `${SKILL_DIR}/references/Divi design system JSON/divi-design-system.tokens.js` when present.

---

## Phase 1 — Variable-First Builder API in `divi-builder.js`

**Why second:** Non-breaking, half a day, unlocks design-system-consistent generation.

### New API

Two new methods on the builder instance (returned by `createBuilder()`):

```js
builder.colorRef('Primary Color')
// → '$variable({"type":"color","value":{"name":"gcid-primary-color","settings":{}}})'

builder.variableRef('H1 Fluid')
// → '$variable({"type":"content","value":{"name":"gvid-usjpmggb92","settings":{}}})'
```

### Token loading

```js
const b = D.createBuilder({ tokens: require('./divi-design-system.tokens.js') });
```

- `tokens` is the object produced by `extract-from-export.js` — has `colorId`, `colorRef`, `variableId`, `variableRef` maps
- `builder.colorRef(label)` looks up `tokens.colorId[label]` and emits the `$variable(...)$` string; throws if label not found
- `builder.variableRef(label)` looks up `tokens.variableId[label]` and emits the content-type variable string; throws if not found
- Both methods work without `tokens` loaded — they fall back to throwing with a clear message so generators fail fast rather than silently emitting nothing

### What does NOT change
- No existing module function signatures change
- Raw string values still accepted everywhere
- Generator scripts opt in incrementally: replace `'clamp(26px,...)'` with `b.variableRef('H1 Fluid')` one field at a time

### Rollout
Update `examples/example-page.js` to demonstrate token usage. Update SKILL.md to document the new API. Existing generators continue to work unchanged.

---

## Phase 2 — `overlaySection()` in `divi-builder.js`

**Why third:** A few hours, unlocks premium image-overlay aesthetics. Scoped to the confirmed use case: dark image + colour overlay with blend mode.

### New helper

```js
D.overlaySection({
  image:    { src: 'https://...', alt: 'Hero background' },
  overlay:  { color: b.colorRef('Black'), opacity: 0.7, blend: 'multiply' },
  padding:  '8vw',
  adminLabel: 'Hero',
  theatre:  'hero-reveal',   // optional DiviTheatre
}, [ ...rows ])
```

### What it emits

A `divi/section` block with `decoration.background` as an **array**:

```json
{
  "decoration": {
    "background": {
      "desktop": {
        "value": [
          { "image": { "url": "...", "parallax": "off" } },
          { "color": "$variable(...)$", "blend": "multiply", "opacity": 0.7 }
        ]
      }
    }
  }
}
```

This matches the Divi 5 JSON schema confirmed in `builder-5/visual-builder/packages/module-library/src/components/section/conversion-outline.json` (`background.*.mask.blend` array notation).

All other section options (spacing, sizing, adminLabel, theatre, preset) pass through to the underlying `section()` call.

### What it does NOT do
- No pattern backgrounds (out of scope)
- No hover state backgrounds (Divi 5 exposes these but the use case isn't confirmed)
- No changes to the existing `section()` function

---

## File Map

| File | Change |
|---|---|
| `scripts/validate.js` | Add colour token FAIL check + variable token WARN check |
| `scripts/divi-builder.js` | Add `colorRef()` + `variableRef()` to builder instance; add `overlaySection()` helper |
| `examples/example-page.js` | Update to demonstrate token API |
| `SKILL.md` | Document new builder methods and `overlaySection()` |

---

## Success Criteria

- Phase 3: `validate.js` FAILs when a raw hex matches a known token; WARNs when a raw size matches a token value
- Phase 1: `builder.colorRef('Primary Color')` emits correct `$variable(...)$` string; `builder.variableRef('H1 Fluid')` emits correct content variable string; both throw on unknown label
- Phase 2: `overlaySection()` with image + overlay produces valid JSON that renders correctly in Divi 5 on the Local site via the `/preview` endpoint
- No existing generators break (backwards compatible throughout)
