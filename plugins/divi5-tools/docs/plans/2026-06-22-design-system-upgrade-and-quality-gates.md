# Divi 5 Generator — Design System Upgrade & Quality Gates

**Date:** 2026-06-22  
**Status:** Plan  
**Prior plan:** `2026-06-22-amazing-generator-from-new-or-existing.md` (Phase 2 complete)

---

## What's done so far

| Feature | Status |
|---|---|
| Phase 0 — builder + validator baseline | ✓ complete |
| Phase 1 — validate token / ET-colour rules | ✓ complete |
| Phase 2 — `ingest.js` + `mutate.js` round-trip | ✓ complete |
| Phase 4A — `/preview` render smoke-test | ✓ complete |
| Phase 4B — fixture suite (B0–B7 + GAP docs) | ✓ complete |
| GAP-A — button without `enable:'on'` validator | ✗ not caught |
| GAP-B — `codeBlock([])` array guard in builder | ✗ not thrown |

---

## What the template design system taught us

`references/ template design system.json` ("Krafter Lite") is a real Divi 5 site's design system export. It shows the correct way to wire up typography, spacing, colour, and presets.

### Type scale — clamp values via global variables

All font sizes in the template are global variables with `clamp()` values, then referenced in group presets via `$variable({...})$`. **Never hardcode `px` or `rem` sizes in heading presets.**

| Label | ID | Value |
|---|---|---|
| text 3xl | `gvid-n47zgqjjk1` | `clamp(2.25rem, 2rem + 1vw, 3rem)` |
| text 2xl | `gvid-rg08d8aw6a` | `clamp(1.875rem, 1.6rem + 0.7vw, 2.25rem)` |
| text xl  | `gvid-qyvnl4k7mq` | `clamp(1.5rem, 1.3rem + 0.6vw, 1.875rem)` |
| text m   | `gvid-jppypwne1e` | `clamp(1rem, 0.9rem + 0.4vw, 1.25rem)` |

→ H1 uses text 3xl, H2 uses text 2xl, H3 uses text xl, body uses text m.

### Spacing scale — clamp values via global variables

| Label | ID | Value |
|---|---|---|
| space l | `gvid-m1gohdw1dx` | `clamp(1.5rem, 1rem + 1vw, 2.5rem)` |
| space m | `gvid-65fgnh5ctw` | `clamp(1rem, 0.6rem + 0.8vw, 1.5rem)` |
| space s | `gvid-q8bc2c3ahi` | `clamp(0.5rem, 0.3rem + 0.6vw, 1rem)` |

Spacing presets (`divi/spacing` group) reference these for margin-top and all-padding.

### Colour palette — lightness-derived variants

```
Primary Color        (gcid-primary-color)   base hex, e.g. #2ea3f2
Primary 100          (gcid-752quxmhcy)      lightness +40 of primary (light tint)
Primary 700          (gcid-dmtl913igj)      lightness -20 of primary (hover / dark)
Secondary Color      (gcid-secondary-color) base hex
Gray 100             (gcid-zclnclpjct)      Black at lightness 97 (light bg)
Gray 900             (gcid-52n8ll62mn)      Black at lightness 10 (dark text)
Black                (gcid-awtsd5ig2f)      #000000
```

The derived colours use `$variable({"type":"color","value":{"name":"gcid-xxx","settings":{"lightness":40}}})$` — Divi's own lightness modifier. No need to compute tints manually.

### Button presets — the correct pattern

Every button group preset in the template has:
```json
"button": {
  "decoration": {
    "button": { "desktop": { "value": { "enable": "on", "icon": { "enable": "off" } } } },
    "background": { "desktop": { "value": { "color": "$variable(...gcid-primary-color...)$" } },
                    "hover":   { "color": "$variable(...gcid-dmtl913igj...)$" } },
    "border":     { "desktop": { "value": { "styles": { "all": { "color": "$variable(...primary...)$" } } } },
                    "hover":   { "styles": { "all": { "color": "$variable(...primary-700...)$" } } } },
    "font":       { "font": { "desktop": { "value": { "color": "#ffffff", "size": "1rem" } } } }
  }
}
```

Key rules:
- `enable:'on'` is **always** required — this is what activates the preset CSS
- `icon.enable:'off'` prevents the default arrow appearing
- Background, border, and hover all reference `gcid-*` variables
- Font colour is `#ffffff` (white on coloured button) — raw hex is correct here
- Hover uses the dark variant (Primary 700), not the base

### Text row — 90ch readability cap

The "text row" preset uses `maxWidth: '90ch'` on the row — limits prose column width for readability. Narrower than the content row's 1280px max.

### Group presets vs module presets

The template uses `groupPreset` (not `modulePreset`) for typography and spacing:
- `divi/font` group → heading font settings (h1, h2, h3)
- `divi/font-body` group → body text settings
- `divi/spacing` group → margin/padding named tokens
- `divi/layout` group → column/row gap settings

The builder already supports `b.groupPreset()`. These should be the standard way to wire up typography — not inline attrs on each heading.

---

## Plan

### Phase 5 — Design system upgrade

**Goal:** the `divi5-page-generator` skill ships pages that use variable-linked clamp font sizes and semantic spacing — matching the template design system pattern — instead of hardcoded `px` values.

#### 5A. Add clamp variables to `divi-builder.js`

Add a `b.typeScale()` helper and a `b.spaceScale()` helper that register the standard clamp variables as global variables and return `variableRef`s for use in presets.

```js
// Usage in a page builder:
const { h1, h2, h3, body } = b.typeScale();
const { s, m, l } = b.spaceScale();
```

Internally, each helper calls `b.globalVariable(id, label, clampValue)` for the 7 variables above and returns the `$variable(...)$` ref strings. If the same IDs are already registered, it's a no-op (idempotent).

The clamp values should be constants in a new `references/type-scale.js` file (importable by both the builder and tests).

**Exit criteria:**
- `b.typeScale().h1` returns the correct `$variable(...)$` string
- Running `node validate.js` on a page built with type scale variables exits 0
- The 7 variables appear in `global_variables` in the assembled JSON

#### 5B. Add semantic spacing group presets

Add `b.spacingPresets()` that registers the 6 spacing group presets (`margin-top-small`, `margin-top-medium`, `margin-top-large`, `padding-small`, `padding-medium`, `padding-large`) as `divi/spacing` group presets and returns their IDs.

```js
const spacing = b.spacingPresets();
D.column({ groupPreset: spacing.paddingMedium }, [...])
```

**Exit criteria:**
- `b.spacingPresets()` returns an object with 6 named IDs
- A page assembled with spacing presets validates green (no phantom preset IDs)

#### 5C. Add correct button group presets

Add `b.buttonPresets(primaryGcid, hoverGcid, secondaryGcid)` that registers:
- `Button Primary` — enable:'on', primary colour, hover via hoverGcid
- `Button Secondary` — enable:'on', secondary colour, hover via hoverGcid

Returns `{ primary, secondary }` preset IDs.

The `enable:'on'` is **hardcoded** — not optional. The builder cannot produce a button preset without it.

**Exit criteria:**
- Assembled JSON has `enable:'on'` in both button presets
- `node validate.js` on a page with button presets exits 0
- GAP-A is closed: validator now checks button group presets for `enable:'on'` and FAILs if missing

#### 5D. Add heading group presets

Add `b.headingPresets(typeScale)` that registers h1/h2/h3 as `divi/font` group presets referencing the type scale variables, plus weight 600 and lineHeight 1.1em.

```js
const ts = b.typeScale();
const headings = b.headingPresets(ts);
D.heading({ text: 'Hero', level: 'h1', groupPreset: headings.h1 })
```

**Exit criteria:**
- Each heading preset size is a variable ref (not a raw value)
- Validator exits 0 on a page using these presets

#### 5E. Update `iConnectITHomepage` example

Refactor `examples/iConnectITHomepage.js` (or `.presets.json` equivalent) to use:
- `b.typeScale()` for all heading sizes
- `b.spacingPresets()` for section padding
- `b.buttonPresets()` for CTA buttons (closes the existing GAP-A ticket on this example)

This is the regression guard: if Phase 5A-D break anything, this example's validate + preview will catch it.

**Exit criteria:**
- `node validate.js examples/iConnectITHomepage.json` exits 0
- `node scripts/__tests__/smoke.test.js` exits 0

---

### Phase 6 — Close known gaps

#### 6A. GAP-A: Validator check for button without `enable:'on'`

The validator already scans preset attrs. Extend it to:
- Walk `presets.group['divi/button'].items`
- For each, check `attrs.button.decoration.button.desktop.value.enable === 'on'`
- FAIL with `BUTTON  button preset "${name}" missing enable:"on" — will render default blue`

Also check module-level button attrs (not just group presets) for the same path.

**Exit criteria:**
- B0 baseline still passes
- A button preset without `enable:'on'` exits 1 with a BUTTON FAIL message
- Phase 4B fixture suite still passes (GAP-A is now caught, not a gap)
- Update `phase4b.test.js` GAP-A note to a proper test case

#### 6B. GAP-B: Builder throws on `codeBlock([])`

In `divi-builder.js`, in the `codeBlock()` function, add:
```js
if (Array.isArray(content)) throw new Error('codeBlock: content must be a string or null, not an array');
```

**Exit criteria:**
- `D.codeBlock([])` throws synchronously with a clear message
- `D.codeBlock(null)` and `D.codeBlock('<script>...')` still work
- Update `phase4b.test.js` GAP-B note to a proper test case

---

### Phase 7 — Taste gate

**Goal:** deterministic pre-flight check that catches AI-generated pages that look like Divi demos rather than professional designs.

#### 7A. `taste-check.js` — deterministic gate

Extract the taste rules from `references/taste.md` into a scriptable checker. Each rule is a function `(outline, doc) => { pass, code, detail }`.

Rules to implement:
- `TASTE-EM` — no em-dash or en-dash in copy (already in validator; move here for cleaner separation)
- `TASTE-EQUAL-CARDS` — no more than 3 cards/features with identical copy length ±5%
- `TASTE-EYEBROW` — max 1 eyebrow label per section  
- `TASTE-AI-TELL` — no "Unlock", "Leverage", "Transform", "Seamlessly" in h1/h2
- `TASTE-H1-VERB` — h1 must start with a noun or number, not a verb ("Get", "Build", "Discover")

Run against the `outline.json` produced by `ingest.js`. No WordPress required.

**Exit criteria:**
- `node taste-check.js <outline.json>` exits 0 on the iConnectITHomepage outline
- Each rule has a failing fixture in `__tests__/taste.test.js`

#### 7B. Wire into SKILL.md

Add taste-check as a required Step 3 gate in SKILL.md (after outline is generated, before builder runs). A TASTE FAIL blocks JSON generation with a clear message.

---

### Phase 8 — Bundled example regression

**Goal:** `npm test` catches any generator change that breaks a known-good page.

#### 8A. Golden outputs for bundled examples

Check three known-good JSON files into `scripts/__tests__/golden/`:
- `iConnectITHomepage.json` (already exists as an example)
- One more — generate one from the new design system using Phase 5 tools

For each, store:
- The JSON output
- The `validate.js` exit code (expected: 0)
- The `ingest.js` outline (for taste-check)

#### 8B. Regression test

Add `scripts/__tests__/regression.test.js`:
- For each golden JSON: run validate.js → assert exit 0
- If golden doesn't exist: create it and print "Golden created — re-run to diff"
- If golden exists: diff `validate.js` output, fail on any new FAIL lines

**Exit criteria:**
- `npm test` runs all 6 suites (smoke, phase0, phase2, phase4b, taste, regression) green
- Introducing a known bug (e.g. raw hex in font color) fails the regression suite

---

## Recommended order

| Phase | Why | Effort |
|---|---|---|
| **6A** Button validator | Closes a known rendering bug immediately; uses existing validator pattern | S |
| **6B** codeBlock guard | One line; closes GAP-B | XS |
| **5A–5D** Design system upgrade | Biggest quality lift; gives every future page fluid type + spacing | M |
| **5E** Update iConnectITHomepage | Validates Phase 5 tools against a real page | S |
| **7A–7B** Taste gate | Stops AI-tell patterns before they land in a client deliverable | M |
| **8A–8B** Regression suite | CI net for everything above | S |

---

## Key constants to extract

These values come directly from the template design system and should live in `references/type-scale.js`:

```js
// Type scale (clamp — fluid between mobile and desktop)
exports.TYPE = {
  '3xl': 'clamp(2.25rem, 2rem + 1vw, 3rem)',       // H1
  '2xl': 'clamp(1.875rem, 1.6rem + 0.7vw, 2.25rem)', // H2
  xl:    'clamp(1.5rem, 1.3rem + 0.6vw, 1.875rem)',  // H3
  m:     'clamp(1rem, 0.9rem + 0.4vw, 1.25rem)',     // body
};

// Spacing scale (clamp — fluid)
exports.SPACE = {
  l: 'clamp(1.5rem, 1rem + 1vw, 2.5rem)',
  m: 'clamp(1rem, 0.6rem + 0.8vw, 1.5rem)',
  s: 'clamp(0.5rem, 0.3rem + 0.6vw, 1rem)',
};

// Standard variable IDs (stable; match the template's gvid- slugs concept)
exports.GVID = {
  text3xl: 'gvid-text-3xl',
  text2xl: 'gvid-text-2xl',
  textXl:  'gvid-text-xl',
  textM:   'gvid-text-m',
  spaceL:  'gvid-space-l',
  spaceM:  'gvid-space-m',
  spaceS:  'gvid-space-s',
};
```

Note: we use **our own stable IDs** (not the template's `gvid-n47zgqjjk1` etc) so pages built by the generator have consistent, readable variable IDs that survive being imported to any site.
