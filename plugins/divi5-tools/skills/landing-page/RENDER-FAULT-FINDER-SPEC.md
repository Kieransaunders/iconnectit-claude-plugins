# Divi 5 Render-Safety Fault Finder — Specification

> Status: **draft** · Owner: divi5-tools/landing-page · Spans two repos (the landing-page skill and the `divi-tools-importer` WordPress plugin).

## 1. Problem & thesis

The landing-page skill generates importable Divi 5 JSON and checks it with `scripts/validate.js`. That validator checks **structure and SEO** — it is blind to whether Divi will actually *render* what you generated.

In one real debugging session, a page **validated green five separate times while being visibly broken**. Divi 5 fails **silently**: it drops a malformed attribute, empties a module that carried inline CSS, or hides a whole row — with no error, anywhere. Every bug we hit lived in the gap between *"validates green"* and *"actually renders"*.

A render-safety fault finder is the validator layer that closes that gap. Its one job: **make Divi's silent render failures loud.** It has two tiers:

- **Tier 1 — static lint (pre-import):** parses the generated JSON and flags shapes Divi mangles on import. Cheap, no running site, runs in the existing generate→validate loop. *Prevents.*
- **Tier 2 — live verify (post-import):** imports the page into a running Divi 5 site and asserts against the **rendered DOM**. Catches render-layer truths — including plugin-side bugs — that are invisible to any static check. *Confirms.*

## 2. Fault catalogue

Every fault below was found in the session. Each maps to a Tier 1 rule (static cause), a Tier 2 assertion (rendered effect), or both.

| # | Fault | What Divi does | Tier 1 rule | Tier 2 assertion |
|---|-------|----------------|-------------|------------------|
| 1 | Custom attrs on `module.advanced.attributes` / key→value map | silently renders **zero** attributes | `RS-ATTR-PATH` ✅auto-fix | `RV-ATTR-COUNT` |
| 2 | Inline `style="…"` in module content | **empties the whole module** on save | `RS-INLINE-STYLE` ⚠flag | `RV-EMPTY-MODULE` |
| 3 | Literal `"` in module content | breaks block-JSON parse → **empties module** | `RS-RAW-QUOTE` ✅auto-fix | `RV-EMPTY-MODULE` |
| 4 | Dark-on-dark / low-contrast text | renders **invisible** | `RS-CONTRAST` ⚠flag | `RV-CONTRAST` |
| 5 | Module renders empty (effect of #2/#3) | blank node in DOM | — | `RV-EMPTY-MODULE` |
| 6 | `data-theatre` count in DOM ≠ JSON (effect of #1) | motion inert | — | `RV-ATTR-COUNT` |
| 7 | Hidden-by-ancestor (DiviTheatre `stagger` `opacity:0`) | whole subtree invisible | — *(plugin bug)* | `RV-HIDDEN-ANCESTOR` |
| 8 | Banned glyphs in copy (em-/en-dash) | taste/style violation | `RS-GLYPH` ✅auto-fix | — |
| — | >1 `<h1>` (theme header/footer injects one) | SEO regression | — | `RV-H1` |
| — | Image missing `alt` after render | a11y/SEO | — | `RV-IMG-ALT` |

The pattern: **Tier 1 prevents the deterministic causes; Tier 2 confirms the render and catches what is structurally invisible** (faults 5–7), including bugs that live in a *plugin* (#7) rather than the generator — a linter could never find those.

## 3. Architecture overview

```
generate  ─►  Tier 1 static lint  ─►  (import draft)  ─►  Tier 2 live verify  ─►  publish
            scripts/render-safety.js                    verify-rendered.js
            (called by validate.js)                     (Playwright, publish-then-revert)
                     │                                            │
                     └── optional Tier 1.5: importer /verify endpoint (server-side, cheap subset)
```

- **Tier 1** is a new `scripts/render-safety.js` module called by `validate.js`, default-on. Findings merge into the existing single report + exit code.
- **Tier 2** is a new `verify-rendered.js` that imports as draft, renders in a headless browser, asserts against the DOM, and always cleans up.
- An **optional server-side `/verify` endpoint** on the importer is a fast "Tier 1.5" pre-screen for the cheap structural assertions (no browser), but cannot do opacity/contrast/runtime checks.

---

## 4. Tier 1 — Static render-safety lint

### Goal & placement

Tier 1 is a **read-only, pre-import static linter**. It parses the *generated* Divi 5 JSON exactly as `validate.js` already does and flags structures that pass the existing structural/SEO validator but get silently mangled at Divi's import/render layer (dropped attributes, modules emptied to blank, broken block-comment parse, invisible text). It never opens a browser — that is Tier 2's job.

**Recommendation: add `scripts/render-safety.js` as a module, called from `validate.js`.** Reasons:

- `validate.js` is already densely single-purpose (structure + SEO + taste). Render-safety adds a colour-resolution engine and a WCAG calculator that would bloat it.
- A separate module is independently unit-testable against fixtures and re-usable by Tier 2 and by `import-to-local`.
- It keeps the diff to `validate.js` tiny: a require, one call, and merging the returned findings into the existing `errors`/`warnings`/`passes` arrays so the **single combined report and single exit code** are preserved.

**Module contract** — `render-safety.js` exports one function that operates on already-parsed data and returns findings, so it does no I/O and never calls `process.exit`:

```js
// scripts/render-safety.js
module.exports = function renderSafety(parsed, opts) {
  // parsed: { contents, tokensByKey, doc }
  // opts:   { fix: false, contrastFail: true, glyphs: '—–' }
  return { errors: [], warnings: [], passes: [], fixes: [] };
};
```

In `validate.js`, after the existing block-walk loop (before the SEO report card), insert:

```js
const RENDER_SAFETY = !args.includes('--no-render-safety'); // default ON
if (RENDER_SAFETY) {
  const rs = require('./render-safety')(
    { contents, tokensByKey, doc },
    { fix: args.includes('--fix'),
      contrastFail: !args.includes('--contrast-warn'),
      glyphs: argValue('--ban-glyphs') }
  );
  errors.push(...rs.errors);
  warnings.push(...rs.warnings);
  passes.push(...rs.passes);
  rsFixes = rs.fixes;
}
```

**Invocation & composition:**

- **Default-on.** These are correctness faults, not opinions, so the linter runs on every `node validate.js layout.json`. Opt *out* with `--no-render-safety`.
- Findings flow into the same `passes`/`warnings`/`errors` arrays and print with the same `PASS`/`WARN`/`FAIL` prefixes. A render-safety FAIL drives the **same exit code 1**.
- Each rule prefixes its message with its stable ID (e.g. `RS-ATTR-PATH:`) the way the taste rule prefixes `TASTE:`.

> Required tweak to `validate.js`: today `parseBlocks` is called per-content and tokens are consumed inline. Capture them into a `tokensByKey` map during the existing loop so `render-safety.js` can re-walk without re-parsing. String-level rules (RS-INLINE-STYLE, RS-RAW-QUOTE, RS-GLYPH) re-scan the raw `content` string directly (so a literal `"` is caught even when it would break `JSON.parse`); structured rules (RS-ATTR-PATH, RS-CONTRAST) use the parsed tokens.

### Input model

The linter walks the same four layers `validate.js` already traverses:

1. **`doc`** — `JSON.parse(...)`. Keys used: `doc.context`, `doc.data`, `doc.presets.module`, `doc.global_colors`.
2. **`data` string → block tree.** `parseBlocks(content)` runs `/<!--\s*(\/?)wp:divi\/([a-z-]+)(\s+(\{[\s\S]*?\}))?\s*(\/?)-->/g`, producing tokens `{ closing, name, attrs, selfClosing }` — exactly what `divi-builder.js` `block()` emits.
3. **Per-block attrs JSON** — `token.attrs`. Canonical paths:
   - custom attributes → `attrs.module.decoration.attributes.desktop.value.attributes` (array; from `theatreAttrs`)
   - heading text → `attrs.title.innerContent.desktop.value`
   - blurb title → `attrs.title.innerContent.desktop.value.text`; blurb body → `attrs.content.innerContent.desktop.value`
   - text html → `attrs.content.innerContent.desktop.value`
   - colours → `attrs.title.decoration.font.font.desktop.value.color`, `attrs.content.decoration.bodyFont.body.font.desktop.value.color`; bg → `attrs.module.decoration.background.desktop.value.color`
   - preset ref → `attrs.modulePreset[0]`
4. **`innerContent` strings** — scanned in the raw `content` string for string-level rules (so a literal `"` is caught before `JSON.parse`), and in resolved values where they survive.

A shared `resolveColors(token, ancestry, doc)` (see RS-CONTRAST) centralises colour logic.

### Rule catalogue

#### RS-ATTR-PATH — custom attributes in the wrong shape
- **Severity:** FAIL (silent zero-render).
- **Detection:** flag if `attrs.module.advanced.attributes` or top-level `advanced.attributes` exists (old location); or if `attrs.module.decoration.attributes.desktop.value` exists but `.attributes` is not an `Array` of `{name, value}` objects (e.g. a key→value map). WARN-only on a missing/empty `targetElement` (Divi defaults it to `'main'`). Correct shape that must not flag: `…decoration.attributes.desktop.value.attributes = Array<{name,value,targetElement}>`.
- **Offending:** `"module":{"advanced":{"attributes":{"data-theatre":"fade-up"}}}`
- **`--fix`:** ✅ auto. Flatten any wrong shape into `{name, value:String(v), targetElement:'main'}`, delete the wrong branch, write the canonical array (identical to `theatreAttrs()` output).

#### RS-INLINE-STYLE — inline `style="…"` in module content
- **Severity:** FAIL (Divi empties the whole module).
- **Detection:** `/\bstyle\s*=\s*("|'|&quot;|&#0?34;)/i` against every `innerContent` value and the raw block body.
- **Offending:** `<p style="color:#fff">Premium motion</p>`
- **`--fix`:** ⚠ flag-only (stripping would drop intended styling). Guidance: move CSS into Divi decoration (`text({ font: {…} })` or a preset).

#### RS-RAW-QUOTE — unescaped `"` in module content
- **Severity:** FAIL (breaks block-comment JSON → empties module).
- **Detection:** scan each content module's innerContent HTML for literal U+0022 `"` (incl. `href="`, `data-*="`). Safe: `&quot;`, `&#34;`, single quotes. The builder's `presetTag` (`&quot;`) and footer `<a href='…'>` must pass.
- **Offending:** `<p>data-theatre="fade-up"</p>`
- **`--fix`:** ✅ auto, narrowly. Within an isolated (post-parse) innerContent value, escape literal `"` → `&quot;` and prefer single quotes for HTML attributes. **Flag-only** (downgrade) when the block's attrs JSON failed to parse — the value boundary can't be located safely.

#### RS-CONTRAST — dark-on-dark / low-contrast text
- **Severity:** FAIL by default; `--contrast-warn` downgrades to WARN.
- **Detection:** resolve effective text colour + effective background, compute WCAG ratio, FAIL below threshold (4.5:1 normal, 3:1 large ≥24px or ≥18.66px bold). See deep-dive.
- **Offending:** a `blurb` with no font override on `column({ background:'#1C1C2B' })` → Divi defaults #333/#666 invisible.
- **`--fix`:** ⚠ flag-only (can't guess brand intent). Optional opt-in `--fix-contrast=white|<hex>` injects a colour — never part of plain `--fix`.

#### RS-GLYPH — banned style/taste glyphs
- **Severity:** FAIL (matches existing TASTE).
- **Detection:** **extends** the existing hard-coded `DASH_RE`. Refactor it into a configurable glyph set owned by `render-safety.js`. Default set = dashes only (so the shipped example's curly apostrophes don't break); `--ban-glyphs "—–…"` overrides.
- **`--fix`:** ✅ auto for unambiguous maps (`—`/`–`→`-`, curly quotes→`'`/`"`, `…`→`...`). Pure substitutions in visible copy; never appear in structural JSON.

### Contrast rule deep-dive (`RS-CONTRAST`)

The only rule needing inheritance resolution. Maintain a `stack` of **token objects** during the walk so each module knows its `column → row → section` chain.

**Resolve effective TEXT colour** (first hit wins): (1) inline font on the module → (2) preset font via `attrs.modulePreset[0]` looked up in `doc.presets.module['divi/<name>'].items[id].attrs` (same font paths) → (3) Divi module defaults (blurb title `#333`, body `#666`; heading/text inherit) → (4) deref `$variable({...})$` via `/"name":"(gcid-[a-z0-9-]+)"/` against `doc.global_colors` (`[id,{color}]`), honouring any `opacity` by alpha-compositing.

**Resolve effective BACKGROUND** (nearest ancestor wins): module bg → column bg → section bg (incl. via section preset, e.g. `secVoid`→`colorVar('void')`) → page default `#ffffff`. Each candidate variable-dereffed.

**Compute** sRGB relative luminance `L = 0.2126R + 0.7152G + 0.0722B` (linearised), ratio `(Lmax+0.05)/(Lmin+0.05)`; large-text threshold from resolved font size/weight.

**Honest edge cases → downgrade FAIL→WARN or skip:** background image/gradient (no single hex) → WARN; translucent/stacked layers → composite best-effort, WARN; unresolvable `gcid-` (already FAILed elsewhere) → skip; hover/active states → out of scope. `--contrast-warn` flips all RS-CONTRAST to WARN globally.

### CLI & report format

| Flag | Effect |
|---|---|
| *(none)* | render-safety runs by default |
| `--no-render-safety` | skip all RS-* rules |
| `--fix` | apply auto-fixable rules, write back |
| `--contrast-warn` | RS-CONTRAST → WARN |
| `--ban-glyphs "—–…"` | override RS-GLYPH set (default: dashes) |

Exit codes unchanged: `process.exit(errors.length ? 1 : 0)`. Sample (matching `validate.js` two-space prefixes):

```
── results ──
  PASS  RS-ATTR-PATH: 6 custom-attribute blocks, all well-formed (module.decoration.attributes[])
  PASS  RS-INLINE-STYLE: no inline style= in module content
  PASS  RS-RAW-QUOTE: no unescaped " in innerContent
  FAIL  RS-CONTRAST: blurb body #666666 on #1C1C2B = 1.42:1 (need 4.5:1) — "Reduced-motion safe…"
  FAIL  RS-ATTR-PATH: section "Intro" attributes at module.advanced.attributes — Divi reads module.decoration.attributes; zero will render
  FAIL  RS-RAW-QUOTE: text module — literal " in innerContent breaks block parse: …data-theatre="fade-up"…
3 error(s), 1 warning(s)
```

### `--fix` semantics & safety

Auto-fix set: `RS-ATTR-PATH`, `RS-RAW-QUOTE` (post-parse only), `RS-GLYPH`. Never auto-fixed: `RS-INLINE-STYLE`, `RS-CONTRAST`. The fixer mutates parsed objects and **re-emits via the builder's own `block()`** (identical escaping), writes to `<name>.fixed.json` by default (`--in-place` to overwrite), and is idempotent. Must never touch `presets`/`global_colors`/`global_variables`/`images`/`canvases`, `builderVersion`, `modulePreset` refs, nesting/order, or the block-comment delimiters — and must leave the file untouched when a block's attrs JSON failed to parse.

### Test fixtures

`scripts/__fixtures__/render-safety/` — one minimal `et_builder` doc per rule, pass + fail: `attr-path.{pass,fail-advanced,fail-map}`, `inline-style.{pass,fail}`, `raw-quote.{pass,fail}`, `contrast.{pass,fail,warn-image,var}`, `glyph.{pass,fail}`, and `fix-roundtrip` (all fixable faults → after `--fix`, re-lint = 0 errors). Use the shipped `example-divitheatre-page.js` output as a whole-page PASS smoke test.

### Limits — defer to Tier 2

Tier 1 reasons about JSON only. It cannot confirm Divi actually accepted an attribute/module on import; cannot do contrast over images/gradients/video/translucent layers; cannot see CSS-cascade or `:hover` colours from the theme; cannot detect modules emptied for other reasons, or responsive-viewport rendering. Those are Tier 2's remit.

---

## 5. Tier 2 — Live render verification

Tier 1 catches malformed blocks before import. But a class of faults passes Tier 1 cleanly and only surfaces **after** Divi has parsed, saved, and rendered the page. Tier 2 imports the candidate into a running Divi 5 site, loads the **rendered** HTML in a headless browser, and runs DOM assertions — turning the manual browser probes from the session into a repeatable gate.

### Goal & flow

```
1. generate     landing-page skill → layout.json (+ seo, schema)
2. static-lint  Tier 1 validate.js → PASS  (else stop)
      │  Tier 2 — verify-rendered.js
3. import       POST /import  { layout, seo, schema, publish:false } → { page_id, slug, status }
4. expose       make rendered DOM reachable (auth strategy — see Transport)
5. render       headless browser navigates, waits for network-idle + DiviTheatre settle
6. assert       run assertions in-page via browser_evaluate → findings
7. report+clean  print report, set exit code, ALWAYS revert page to draft / delete placeholders
```

Step 6 runs **real JS inside the rendered page** — the only place faults 5–7 are observable, because they are produced by Divi's save/parse layer and the DiviTheatre runtime.

### Transport options & recommendation

The verifier needs the rendered HTML of a freshly-imported page. The importer creates pages as **draft**; a draft is only viewable through a nonce'd preview URL requiring an authenticated admin session. That auth requirement is the crux.

| Option | Loads page via | Auth | Verdict |
|---|---|---|---|
| **A. Playwright, publish-then-revert** | public permalink while briefly published | none needed | **Recommended** |
| B. Playwright, draft + cookie/nonce | log in / inject cookie, hit preview URL | scripted wp-login / nonce mgmt | fallback |
| C. Standalone Playwright/node script | same as A/B, no MCP | same | CI |
| D. Server-side `/verify` endpoint | importer renders server-side, returns findings | reuses `X-Divi-Tools-Key` | partial only |

**Recommendation: Option A — publish-then-revert, driven by the Playwright MCP** (and the equivalent standalone script for CI; shared probe code). It sidesteps draft-auth entirely (a published page serves anonymously), gives a faithful render (faults 5–7 need real layout + the DiviTheatre runtime), has a bounded blast radius (published for seconds on staging, then reverted in a `finally`), and reuses the importer's idempotent slug-keyed update for the revert. Trade-off: a brief published window — **staging/LocalWP only**, optionally `noindex` during the window. If even that is unacceptable, fall back to Option B; only the navigation/auth wrapper changes.

### Source-of-truth comparison

Expectations come from the same `layout.json` sent to the importer, parsed once: `expected.theatreCount` and a per-value multiset (walk the block tree counting `data-theatre` attribute entries — **not** a regex over HTML), the H1 text, and every image alt. Bundle into one `expected` object injected as the `browser_evaluate` argument so each probe compares DOM reality against generator intent.

### Assertion catalogue

#### `RV-ATTR-COUNT` — data-theatre reached the DOM (fault #6)
```js
(expected) => {
  const nodes = document.querySelectorAll('[data-theatre]');
  const byValue = {};
  nodes.forEach(n => { const v = n.getAttribute('data-theatre') || '(empty)'; byValue[v] = (byValue[v]||0)+1; });
  return { id:'RV-ATTR-COUNT', expected: expected.theatreCount, found: nodes.length, byValue,
           expectedByValue: expected.theatreByValue, pass: nodes.length === expected.theatreCount };
}
```
PASS iff `found === expected.theatreCount` (optionally require `byValue` deep-equals). `found===0` against a non-zero expectation = "Divi dropped the attributes."

#### `RV-EMPTY-MODULE` — module present but empty (fault #5)
```js
() => {
  const sel = '.et_pb_text, .et_pb_heading, [class*="et_pb_text_"], [class*="et_pb_heading_"]';
  const offenders = [];
  document.querySelectorAll(sel).forEach(el => {
    const txt = (el.textContent||'').replace(/ /g,' ').trim();
    const hasMedia = el.querySelector('img, svg, iframe, video');
    if (txt.length === 0 && !hasMedia) offenders.push({ cls: el.className, html: el.innerHTML.slice(0,80) });
  });
  return { id:'RV-EMPTY-MODULE', emptyCount: offenders.length, offenders, pass: offenders.length === 0 };
}
```
PASS iff no text-bearing module has empty `textContent` and no child media.

#### `RV-HIDDEN-ANCESTOR` — visible itself but hidden by an ancestor (fault #7)
The FOUC rule `[data-theatre]{opacity:0}` hides every tagged element until the runtime clears it. `stagger` animates only its children, so its factory must un-hide its own tagged container; if that clear never runs, the parent stays `opacity:0` and **every descendant is invisible even though each reports `opacity:1` on itself** (opacity multiplies down the tree).
```js
() => {
  function effectiveOpacity(el) {
    let node = el, product = 1, chain = [];
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const o = parseFloat(cs.opacity);
      if (cs.visibility === 'hidden' || cs.display === 'none') {
        chain.push({ tag: node.tagName, reason: cs.display==='none'?'display:none':'visibility:hidden', cls: node.className });
        return { effective: 0, culprit: chain[chain.length-1], chain };
      }
      if (!isNaN(o) && o < 1) { product *= o; if (o === 0) chain.push({ tag: node.tagName, opacity:o, cls: node.className }); }
      node = node.parentElement;
    }
    return { effective: product, culprit: chain[0] || null, chain };
  }
  const targets = new Set();
  document.querySelectorAll('[data-theatre]').forEach(t => { targets.add(t); Array.prototype.forEach.call(t.children, c => targets.add(c)); });
  const offenders = [];
  targets.forEach(el => {
    const self = parseFloat(getComputedStyle(el).opacity);
    const eff = effectiveOpacity(el);
    if (eff.effective < 0.01 && self >= 0.99) offenders.push({ el: el.className, selfOpacity: self, effectiveOpacity: eff.effective, hiddenBy: eff.culprit });
  });
  return { id:'RV-HIDDEN-ANCESTOR', offenders, pass: offenders.length === 0 };
}
```
**Timing/viewport caveat:** DiviTheatre clears opacity asynchronously. The verifier must wait for the engine to settle (network-idle + ~1500ms, past the engine window and the stagger `i*100ms` cascade) and probe at a **desktop viewport ≥768px** so the animated path (not the mobile jump-to-end) is exercised — that path is where the stagger bug lived.

#### `RV-CONTRAST` — computed-style contrast (live confirm of #4)
Walks up for the first non-transparent `backgroundColor`, computes WCAG ratio against `color`, thresholds by rendered font size/weight. (Catches contrast over global-colour inheritance and gradients that static analysis can't.)

#### `RV-H1` — exactly one `<h1>`
PASS iff `document.querySelectorAll('h1').length === 1`. Catches a second h1 injected by Divi global header/footer, absent from the layout JSON.

#### `RV-IMG-ALT` — every content image has alt
PASS iff every `.et_pb_module img` has a non-empty `alt` (decorative `alt=""` allow-listed via `expected`).

### CLI & report

```bash
node verify-rendered.js \
  --layout ./out/page.layout.json --site https://divi-airtable.local --key "$DTI_KEY" \
  [--seo …] [--schema …] [--keep] [--viewport 1440x900] [--settle 1500] [--json report.json]
```
Flow: `GET /ping` (confirm reachable, key valid, `divi5:true`; else exit 3) → parse layout → `POST /import` draft → publish-then-render (Option A) → run probes via `browser_evaluate` with `expected` → **cleanup in `finally`** → report + exit.

Exit codes: `0` all pass · `1` assertion failure · `2` bad usage · `3` environment unmet (ping/key/Divi) · `4` import/render error.

```
Tier 2 — Live render verification
Site: https://divi-airtable.local   Page: /airloop/faq (page_id 412)
  PASS  RV-ATTR-COUNT        4/4 data-theatre attrs in DOM
  FAIL  RV-EMPTY-MODULE      1 module rendered empty
        └ .et_pb_text_3  innerHTML: "<p></p>"  (raw quote stripped on save?)
  FAIL  RV-HIDDEN-ANCESTOR   3 elements hidden by ancestor opacity:0
        └ .et_pb_row_2 children invisible — hiddenBy .et_pb_section_0 [data-theatre] (opacity 0, never cleared)
  PASS  RV-CONTRAST          0 low-contrast text nodes
  PASS  RV-H1                exactly 1 <h1>
  PASS  RV-IMG-ALT           0 images missing alt
2 failed, 4 passed.   Cleanup: page 412 reverted to draft.
```

### Cleanup & safety

Always revert (in `finally`) via a re-import with `publish:false` (idempotent, slug-keyed). Track and optionally delete placeholder parent pages the importer auto-created (read its warnings) — never delete pre-existing pages. Never log the key (read `DTI_KEY` env, send only in `X-Divi-Tools-Key`, never the `dti_key` query param — it leaks into access logs). Back off on HTTP 429. Staging only.

### Optional: server-side `/verify` endpoint (Tier 1.5)

Add a `/verify` route alongside `/import` and `/ping` (reusing `DTI_RestApi::authenticate`). It builds `post_content` like `PageImporter`, renders via `do_blocks()`/`the_content`, parses with `DOMDocument`, and returns the **static-HTML-shape** findings: `RV-ATTR-COUNT`, `RV-EMPTY-MODULE`, `RV-H1`, `RV-IMG-ALT` — no browser, no publish window, reuses key auth. It **cannot** compute effective opacity/visibility (`RV-HIDDEN-ANCESTOR`), contrast (`RV-CONTRAST`), or anything the JS runtime does after load. Best used as a fast pre-screen before the full browser-based Tier 2.

### Mapping table — assertion → session fault

| Assertion | Catches | Fault # | Live-only reason |
|---|---|---|---|
| `RV-EMPTY-MODULE` | module present but empty | 5 | Divi strips inline styles / raw quotes on save |
| `RV-ATTR-COUNT` | DOM `data-theatre` ≠ JSON | 6 | Divi silently drops attrs with wrong schema |
| `RV-HIDDEN-ANCESTOR` | hidden by ancestor opacity:0 | 7 | needs CSS cascade + DiviTheatre runtime |
| `RV-CONTRAST` | fails WCAG vs rendered bg | 4 (confirm) | needs `getComputedStyle` |
| `RV-H1` | not exactly one h1 | — | theme header/footer injects extra h1 |
| `RV-IMG-ALT` | image missing alt | — | confirms alt survived render |

---

## 6. Rollout plan

Each phase ships independently and adds value on its own.

- **Phase 0 — prep.** Refactor `validate.js`: retain parsed tokens in `tokensByKey`; extract the hard-coded `DASH_RE` into a configurable glyph set. (Enables Tier 1 with a tiny diff.)
- **Phase 1 — Tier 1 cheap wins.** `render-safety.js` with `RS-ATTR-PATH`, `RS-INLINE-STYLE`, `RS-RAW-QUOTE`, `RS-GLYPH` + `--fix`. Wire into `validate.js` default-on. Catches faults 1, 2, 3, 8 — three of them auto-fixable. **Highest value, lowest cost.**
- **Phase 2 — Tier 1 contrast.** Add `RS-CONTRAST` with the colour-resolution engine (the one fiddly check). Catches fault 4 statically.
- **Phase 3 — Tier 2 live verify.** `verify-rendered.js`, Option A (publish-then-revert via Playwright), assertions `RV-ATTR-COUNT`, `RV-EMPTY-MODULE`, `RV-HIDDEN-ANCESTOR`, plus `RV-H1`/`RV-IMG-ALT`/`RV-CONTRAST`. Catches faults 5, 6, 7 — including the plugin-side stagger class.
- **Phase 4 — optional `/verify` endpoint.** Server-side Tier 1.5 pre-screen on the importer for the cheap subset.

## 7. Open decisions

1. **Tier 1 default-on vs opt-in** — recommended default-on (correctness, not opinion); opt out with `--no-render-safety`.
2. **RS-CONTRAST FAIL vs WARN default** — recommended FAIL (dark-on-dark ships invisible content) with mandatory WARN downgrades for images/gradients/translucency and a global `--contrast-warn`.
3. **Fold Tier 1 into `validate.js` vs a separate command** — recommended a separate `render-safety.js` module *called by* `validate.js`, preserving one report + one exit code.
4. **Tier 2 transport** — recommended publish-then-revert on staging only; cookie-auth fallback; `/verify` as a complementary pre-screen, not a replacement.
5. **Where Tier 2 runs** — interactive (Playwright MCP) for local dev vs standalone Playwright in CI; shared probe code either way.
