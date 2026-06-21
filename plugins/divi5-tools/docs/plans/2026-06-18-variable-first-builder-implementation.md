# Variable-First Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add design-system linting to `validate.js`, token-aware builder methods to `divi-builder.js`, and an `overlaySection()` helper — all backwards-compatible.

**Architecture:** Three independent phases. Phase 3 (validate.js linting) is first because it is isolated and adds immediate value. Phase 1 (builder API) is second — non-breaking additions to `createBuilder()`. Phase 2 (overlaySection) is last — a new standalone helper that wraps the existing `section()` function.

**Tech Stack:** Node.js (CommonJS), no new npm dependencies.

---

## Task 1: Colour token FAIL check in `validate.js` (Phase 3a)

**Files:**
- Modify: `scripts/validate.js` (after line 260, after existing colour reference check)
- Test: manual — run `node scripts/validate.js examples/example-landing-page.json`

The check reads the ET token file's `colorHex` map, builds a reverse lookup (hex → label), then scans all stringified module attrs for `#rrggbb` literals. If the hex matches a known token, it FAILs with "Use `b.colorRef('Label')` not `'#hex'`".

**Step 1: Locate the insertion point**

Open `scripts/validate.js`. The insertion point is after line 260:
```js
if (definedColors.size) pass(`${definedColors.size} global colours defined, references checked`);
```
Everything after that is the taste/glyph check.

**Step 2: Write the new check**

Insert this block (after line 260, before the glyph section):

```js
// ─── design system token linting ────────────────────────────────────────────
// Phase 3a: raw hex → FAIL if it matches an ET token. Unknown hex → pass.
// Phase 3b: raw size value → WARN if it matches an ET variable value.
//
// Token file is optional — if absent, checks are skipped silently.
(function () {
  const tokenPath = path.join(__dirname, '../references/Divi design system JSON/divi-design-system.tokens.js');
  if (!fs.existsSync(tokenPath)) return;
  const tokens = require(tokenPath);

  // Build hex → label reverse lookup from colorHex map.
  const hexToLabel = {};
  for (const [gcid, val] of Object.entries(tokens.colorHex || {})) {
    const hex = typeof val === 'string' ? val.toLowerCase()
      : (val.resolvesTo || '').toLowerCase();
    if (!hex) continue;
    // Find the human label via colorId reverse lookup.
    const label = Object.keys(tokens.colorId || {}).find(k => tokens.colorId[k] === gcid);
    if (label && hex) hexToLabel[hex] = label;
  }

  // Scan stringified content for raw hex values.
  // We search the full JSON text of each module's attrs to catch nested values.
  const RAW_HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
  const rawHexHits = [];
  for (const tok of tokens$1) {  // tokens$1 is the parsed block list from the existing tokeniser
    if (!tok.attrs) continue;
    const attrsStr = JSON.stringify(tok.attrs);
    let m;
    RAW_HEX_RE.lastIndex = 0;
    while ((m = RAW_HEX_RE.exec(attrsStr)) !== null) {
      const hex = m[0].toLowerCase();
      if (hexToLabel[hex]) {
        rawHexHits.push({ block: tok.name, hex, label: hexToLabel[hex] });
      }
    }
  }
  if (rawHexHits.length) {
    for (const h of rawHexHits) {
      err(`TOKEN: raw colour ${h.hex} in ${h.block} matches ET token "${h.label}" — use builder.colorRef('${h.label}') instead`);
    }
  } else {
    pass('no raw hex values matched ET design system tokens');
  }

  // Phase 3b: variable value WARN.
  const valToLabel = {};
  for (const [label, ref] of Object.entries(tokens.variableRef || {})) {
    // variableRef values are $variable(...)$ strings — value is in the gvid entry.
    // The variableValue map (if present) stores label → CSS value string.
    if (tokens.variableValue && tokens.variableValue[label]) {
      valToLabel[tokens.variableValue[label]] = label;
    }
  }
  if (Object.keys(valToLabel).length) {
    const RAW_SIZE_RE = /\b(\d+(?:\.\d+)?(?:px|em|rem|vw|vh)|clamp\([^)]+\))/g;
    for (const tok of tokens$1) {
      if (!tok.attrs) continue;
      const attrsStr = JSON.stringify(tok.attrs);
      let m;
      RAW_SIZE_RE.lastIndex = 0;
      while ((m = RAW_SIZE_RE.exec(attrsStr)) !== null) {
        const val = m[0];
        if (valToLabel[val]) {
          warn(`TOKEN: literal "${val}" in ${tok.name} matches ET variable "${valToLabel[val]}" — consider builder.variableRef('${valToLabel[val]}')`);
        }
      }
    }
  }
})();
```

**Important:** The existing block tokeniser stores parsed blocks in a variable. Check what it is named in your version of validate.js — search for where `blockCount` is incremented. The array of parsed tokens is likely named `tokens` or `parsed`. In the code above it is referenced as `tokens$1` — rename it to match whatever variable name the existing code uses.

**Step 3: Check what the block array is called**

Run:
```bash
grep -n 'blockCount\|const parsed\|const tokens\|const blocks\|\.push(t)' \
  "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/scripts/validate.js" | head -20
```

Find the array name and use it instead of `tokens$1` above. Also verify `fs` and `path` are already required at the top of the file:
```bash
grep -n "^const fs\|^const path\|require('fs')\|require('path')" \
  "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/scripts/validate.js" | head -5
```

**Step 4: Run against a JSON that has raw hex**

The example page (`examples/example-landing-page.json`) uses raw hex values like `#0D0D12` and `#FFFFFF`. These match ET tokens (`Black` = `#000000`, `White` = `#ffffff`). Run:

```bash
node "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/scripts/validate.js" \
  "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/examples/example-landing-page.json"
```

Expected: at least one `TOKEN: raw colour` FAIL line, exit code 1.

**Step 5: Commit**

```bash
git add "plugins/divi5-tools/skills/landing-page/scripts/validate.js"
git commit -m "feat(validate): FAIL on raw hex that matches ET design system token"
```

---

## Task 2: `colorRef()` + `variableRef()` on `createBuilder()` (Phase 1)

**Files:**
- Modify: `scripts/divi-builder.js` — inside `createBuilder()` function (around line 585)

**Step 1: Understand the current builder instance**

`createBuilder()` currently returns an object with `globalColor()`, `colorVar()`, `preset()`, `assemble()`. We add two new methods: `colorRef(label)` and `variableRef(label)`.

**Step 2: Add `tokens` param to `createBuilder()`**

Change the function signature and add the two methods. Find:

```js
function createBuilder() {
  const presets = {}; // moduleName -> { default, items }
  const globalColors = [];
```

Replace with:

```js
function createBuilder(opts) {
  const tokens = (opts && opts.tokens) || null;
  const presets = {}; // moduleName -> { default, items }
  const globalColors = [];
```

**Step 3: Add the two new methods to the returned object**

After the existing `colorVar()` method (around line 602), add:

```js
    /**
     * Emit a $variable(...)$ colour ref by human label from the loaded token file.
     * Requires createBuilder({ tokens }) to be called with the token module.
     * Throws if tokens not loaded or label not found — fail fast, never silently emit nothing.
     */
    colorRef(label) {
      if (!tokens) throw new Error(`builder.colorRef('${label}'): no tokens loaded — pass { tokens: require('./divi-design-system.tokens.js') } to createBuilder()`);
      const ref = tokens.colorRef[label];
      if (!ref) throw new Error(`builder.colorRef('${label}'): unknown label. Known labels: ${Object.keys(tokens.colorRef).join(', ')}`);
      return ref;
    },

    /**
     * Emit a $variable(...)$ content ref by human label (spacing, type, etc.).
     * Requires createBuilder({ tokens }).
     */
    variableRef(label) {
      if (!tokens) throw new Error(`builder.variableRef('${label}'): no tokens loaded — pass { tokens: require('./divi-design-system.tokens.js') } to createBuilder()`);
      const ref = tokens.variableRef && tokens.variableRef[label];
      if (!ref) throw new Error(`builder.variableRef('${label}'): unknown label. Known labels: ${tokens.variableRef ? Object.keys(tokens.variableRef).join(', ') : 'none'}`);
      return ref;
    },
```

**Step 4: Smoke-test**

```bash
node -e "
const D = require('./scripts/divi-builder');
const tokens = require('./references/Divi design system JSON/divi-design-system.tokens.js');
const b = D.createBuilder({ tokens });
console.log(b.colorRef('White'));
console.log(b.colorRef('Primary Color'));
try { b.colorRef('DoesNotExist'); } catch(e) { console.log('THROWS OK:', e.message.slice(0,60)); }
try { D.createBuilder().colorRef('White'); } catch(e) { console.log('NO TOKENS OK:', e.message.slice(0,50)); }
" -- "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page"
```

Run from the `skills/landing-page/` directory. Expected output:
```
$variable({"type":"color","value":{"name":"gcid-y43rzvjcdl","settings":{}}})$
$variable({"type":"color","value":{"name":"gcid-primary-color","settings":{}}})$
THROWS OK: builder.colorRef('DoesNotExist'): unknown label. Known labels:
NO TOKENS OK: builder.colorRef('White'): no tokens loaded
```

**Step 5: Verify `createBuilder()` with no args still works**

```bash
node -e "
const D = require('./scripts/divi-builder');
const b = D.createBuilder();
console.log(b.globalColor('brand-blue', '#1a2bcc', 'Brand Blue'));
" -- "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page"
```

Expected: the `$variable(...)$` string for `gcid-brand-blue`.

**Step 6: Commit**

```bash
git add "plugins/divi5-tools/skills/landing-page/scripts/divi-builder.js"
git commit -m "feat(builder): add colorRef() and variableRef() token API to createBuilder()"
```

---

## Task 3: `overlaySection()` helper (Phase 2)

**Files:**
- Modify: `scripts/divi-builder.js` — add after the existing `section()` function (find `function section(`)

**Step 1: Find where `section()` ends**

```bash
grep -n "^function section\|^function row\|^function column" \
  "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/scripts/divi-builder.js" | head -5
```

The new `overlaySection()` goes immediately before `row()`.

**Step 2: Understand the background array format**

The Divi 5 background array format (confirmed in `conversion-outline.json`):

```json
{
  "decoration": {
    "background": {
      "desktop": {
        "value": [
          { "image": { "url": "https://...", "parallax": "off" } },
          { "color": "$variable(...)$", "blend": "multiply", "opacity": 0.7 }
        ]
      }
    }
  }
}
```

The image layer goes first (bottom), colour overlay goes second (top).

**Step 3: Write the function**

Insert after `section()` (before `row()`):

```js
/**
 * overlaySection({ image, overlay, padding, adminLabel, theatre, preset }, rows)
 *
 * Emits a divi/section with a multi-layer background: image + colour overlay.
 *
 * @param {object} opts
 * @param {{ src: string, alt?: string, parallax?: string }} opts.image
 * @param {{ color: string, opacity?: number, blend?: string }} opts.overlay
 * @param {string} [opts.padding]
 * @param {string} [opts.adminLabel]
 * @param {string} [opts.theatre]
 * @param {string} [opts.preset]
 * @param {string[]} rows  - serialised row block strings
 */
function overlaySection(opts, rows) {
  const o = opts || {};
  const imgLayer = {
    image: {
      url: (o.image && o.image.src) || '',
      parallax: (o.image && o.image.parallax) || 'off',
    },
  };
  const colorLayer = {};
  if (o.overlay) {
    if (o.overlay.color != null) colorLayer.color = o.overlay.color;
    if (o.overlay.blend != null) colorLayer.blend = o.overlay.blend;
    if (o.overlay.opacity != null) colorLayer.opacity = o.overlay.opacity;
  }
  const backgroundValue = [imgLayer, colorLayer];
  const sectionOpts = {
    adminLabel: o.adminLabel,
    theatre: o.theatre,
    preset: o.preset,
    padding: o.padding,
    background: { desktop: { value: backgroundValue } },
  };
  return section(sectionOpts, rows);
}
```

This delegates everything to the existing `section()` function. It just pre-builds the `background` array — so any future improvements to `section()` are inherited automatically.

**Important:** Check how the existing `section()` function accepts a `background` key. Read the `section()` function in `divi-builder.js` to see what attrs shape it expects. If `section()` does not have a `background` passthrough, you may need to look at how it builds `decoration.background` and add one.

**Step 4: Check `section()` signature**

```bash
grep -n "function section\|decoration.*background\|o\.background\|opts\.background" \
  "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/scripts/divi-builder.js" | head -20
```

If `section()` does NOT handle a `background` option, you need to add it. Find where `section()` builds `decoration` attrs and add:

```js
// Inside section(), when building attrs:
const bg = o.background || (o.bgColor ? { desktop: { value: [{ color: o.bgColor }] } } : undefined);
// ...
decoration: prune({
  background: bg,
  // ... existing spacing etc.
}),
```

Verify by looking at the existing section structure in the file before implementing.

**Step 5: Smoke-test**

```bash
node -e "
const D = require('./scripts/divi-builder');
const tokens = require('./references/Divi design system JSON/divi-design-system.tokens.js');
const b = D.createBuilder({ tokens });
const result = D.overlaySection({
  image: { src: 'https://picsum.photos/seed/hero/1200/800' },
  overlay: { color: b.colorRef('Background Overlay - Dark'), opacity: 0.75, blend: 'multiply' },
  padding: '8vw',
  adminLabel: 'Hero Overlay Test',
}, []);
console.log(result.slice(0, 300));
" -- "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page"
```

Expected: a `<!-- wp:divi/section` block comment containing a JSON blob with `decoration.background.desktop.value` as an array with two elements.

**Step 6: Export it**

In `module.exports` at the bottom of `divi-builder.js`, add `overlaySection` to the export list:

```js
module.exports = {
  BUILDER_VERSION, CRLF,
  dv, block, placeholder, merge, prune, htmlContent,
  section, overlaySection, row, column,   // ← add overlaySection here
  ...
```

**Step 7: Commit**

```bash
git add "plugins/divi5-tools/skills/landing-page/scripts/divi-builder.js"
git commit -m "feat(builder): add overlaySection() for image + colour overlay backgrounds"
```

---

## Task 4: Update `examples/example-page.js` to demonstrate token API

**Files:**
- Modify: `examples/example-page.js`

**Step 1: Load tokens at the top**

After the existing `require('../scripts/divi-builder')` line, add:

```js
const TOKENS = require('../references/Divi design system JSON/divi-design-system.tokens.js');
```

**Step 2: Replace the hardcoded `T` object with a builder instance**

Currently `example-page.js` uses a plain `T` object of hex values. Show side-by-side usage: keep the `T` object for brand-specific colours, but use `b.colorRef()` for ET system colours. Change the top of the file:

```js
const b = D.createBuilder({ tokens: TOKENS });

// Brand colours (not in ET design system — registered as custom global colours)
const PRIMARY   = b.globalColor('brand-primary',  '#F95E00', 'Brand Primary');
const DARK      = b.globalColor('brand-dark',      '#0D0D12', 'Brand Dark');
const BODY_DARK = b.globalColor('brand-body-dark', '#BBBBBB', 'Brand Body Dark');

// ET design system colours (referenced by label — Divi resolves them server-side)
const WHITE     = b.colorRef('White');
const GRAY_BG   = b.colorRef('Background - Light Gray');
```

Replace at least one usage of the old `T.white` / `T.gray` with these — pick the hero section background as a concrete example.

**Step 3: Add one `overlaySection()` demonstration**

Add a new dark hero section that uses `overlaySection()` — put it as an additional section in the layout (after the existing hero or as a commented-out alternative). Use the image already defined in `HERO_IMG`:

```js
const darkHeroSection = D.overlaySection({
  image: { src: HERO_IMG },
  overlay: { color: b.colorRef('Background Overlay - Dark'), opacity: 0.82, blend: 'multiply' },
  padding: '8vw',
  adminLabel: 'Hero (overlay variant)',
}, [
  D.row({}, [
    D.column({ width: 50 }, [
      D.heading({ text: 'Build faster with tokens', color: WHITE, level: 'h1' }),
    ]),
  ]),
]);
```

Include it in the `sections` array.

**Step 4: Run the generator and validate**

```bash
node "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/examples/example-page.js"
node "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/scripts/validate.js" \
  "/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page/examples/example-landing-page.json"
```

The validate run should now show TOKEN FAILs for any remaining raw hex in the non-overlay sections (expected — this is informational for the plan). The example JSON should include the overlay section's `decoration.background.desktop.value` array.

**Step 5: Commit**

```bash
git add "plugins/divi5-tools/skills/landing-page/examples/example-page.js" \
        "plugins/divi5-tools/skills/landing-page/examples/example-landing-page.json"
git commit -m "docs(example): demonstrate colorRef, variableRef, and overlaySection in example-page.js"
```

---

## Task 5: Update `SKILL.md` to document new API

**Files:**
- Modify: `SKILL.md` in `skills/landing-page/`

Find the existing builder API documentation section. Add a sub-section after the existing `createBuilder()` / `globalColor()` / `preset()` docs:

```markdown
### Token-aware builder (opt-in)

Load the ET design system tokens to replace raw hex with server-resolved variable refs:

```js
const TOKENS = require('./references/Divi design system JSON/divi-design-system.tokens.js');
const b = D.createBuilder({ tokens: TOKENS });

// ET colour by label → resolves to $variable(...)$ string
const white = b.colorRef('White');             // gcid-y43rzvjcdl
const overlay = b.colorRef('Background Overlay - Dark');  // gcid-2ihj6tueev

// ET spacing/type variable by label (when variableRef is populated)
// const h1Size = b.variableRef('H1 Fluid');
```

Both methods **throw** if the label is not found — fail fast rather than silently emit nothing.

### Overlay sections

```js
D.overlaySection({
  image:   { src: 'https://...', parallax: 'off' },
  overlay: { color: b.colorRef('Background Overlay - Dark'), opacity: 0.8, blend: 'multiply' },
  padding: '8vw',
  adminLabel: 'Hero',
}, rows)
```

Emits a `divi/section` with a two-layer background (image bottom, colour top). All other `section()` options (`theatre`, `preset`, etc.) pass through.
```

**Commit:**

```bash
git add "plugins/divi5-tools/skills/landing-page/SKILL.md"
git commit -m "docs(skill): document colorRef, variableRef, and overlaySection API"
```

---

## Verification checklist

| Check | Command | Expected |
|---|---|---|
| Token FAIL fires | `node validate.js examples/example-landing-page.json` | At least one `TOKEN: raw colour` FAIL line |
| Token FAIL silent for unknown hex | Modify a hex to `#DEADBE` — run validate | No TOKEN line for that hex |
| `colorRef()` throws on bad label | See Task 2 smoke-test | `THROWS OK:` |
| `colorRef()` throws without tokens | See Task 2 smoke-test | `NO TOKENS OK:` |
| `createBuilder()` still works without opts | See Task 2 step 5 | `$variable(...)$` returned |
| `overlaySection()` emits array background | See Task 3 smoke-test | JSON with 2-element `value` array |
| `overlaySection()` exported | `node -e "const D=require('./scripts/divi-builder'); console.log(typeof D.overlaySection)"` | `function` |
| Example page generates without error | `node examples/example-page.js` | JSON written, no throw |
| Validate still exits 0 on clean JSON | Create a JSON with no raw hex matching tokens | exit code 0 |

---

## Notes for the implementer

- The token file (`divi-design-system.tokens.js`) uses `colorHex` for the reverse lookup. Some values are `{ derived, resolvesTo }` objects — use `resolvesTo` as the hex. Others are plain strings.
- The `variableRef` map in the token file stores `$variable(...)$` strings. If the token file does not have a `variableValue` map yet (it may not), Phase 3b (variable WARN) will silently skip — that is fine.
- `overlaySection()` is a thin wrapper — any complexity (responsive breakpoints, tablet-specific backgrounds) should be added to `section()` itself, not to `overlaySection()`.
- Never modify the ET token files in `references/` — they are generated from the official Divi 5 design system export. Re-run `scripts/extract-from-export.js` if the design system updates.
