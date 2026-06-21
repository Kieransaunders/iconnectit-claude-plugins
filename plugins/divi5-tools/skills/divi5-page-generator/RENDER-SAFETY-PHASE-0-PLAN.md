---
phase: 0
phase_name: Prep & Emitter Hardening
plan_id: 00-01
wave: 1
depends_on: []
files_modified:
  - scripts/validate.js
  - scripts/divi-builder.js
  - scripts/__fixtures__/render-safety/   (new)
  - scripts/__tests__/phase0.test.js       (new, or run via node assertions)
autonomous: true
status: ready
source: RENDER-FAULT-FINDER-SPEC.md §6 (Phase 0) + agreed emitter hardening
repo: divi5-tools/skills/landing-page
---

# Phase 0 — Prep & Emitter Hardening

## Goal

Make the two cheap structural changes the spec's Phase 0 calls for **and** close the
faults at source in the generator, so Tier 1 (`render-safety.js`, Phase 1) lands as a
tiny diff over a code base that can no longer *emit* faults 1, 3 and 8 in the first place.

Two intents, kept distinct:

1. **Enablement (spec §6 Phase 0).** Refactor `validate.js` so a future
   `render-safety.js` can re-walk parsed tokens without re-parsing, and so the
   hard-coded dash ban becomes a configurable glyph set that module can own. Zero
   change to current validator behaviour.
2. **Emitter hardening (agreed addition).** Guarantee `divi-builder.js` cannot produce
   the deterministic render faults: `theatreAttrs()` becomes the *only* writer of the
   custom-attributes path, and all module HTML content goes through one escaping helper
   whose output is proven to survive Divi's import round-trip.

After Phase 0 the linter is a safety net over generator output, not the only thing
standing between "validates green" and "renders". That is the right order.

## Why this scope (trade-off note)

`block()` already runs every attrs object — including `innerContent` HTML — through
`JSON.stringify` (`divi-builder.js:63`), and `theatreAttrs()` already writes the
canonical `module.decoration.attributes.desktop.value.attributes` array
(`divi-builder.js:111`). So the generator is *mostly* already correct. The residual
risk is the two `attrs:` escape hatches (any caller can hand-merge a wrong-shape
attribute branch) and the unconfirmed exact mechanism of the raw-quote fault. Phase 0
removes the escape-hatch risk and **confirms** the raw-quote mechanism before any
auto-fix is designed in Phase 1 — rather than shipping a fixer against a guessed cause.

---

## Tasks

### T1 — Retain parsed tokens in `tokensByKey` (validate.js)

<read_first>
- scripts/validate.js  (the content loop, lines ~95-194; `parseBlocks`, `contents`, the per-token walk)
- RENDER-FAULT-FINDER-SPEC.md §4 "Required tweak to validate.js" (lines 92-98) and "Input model" (lines 100-115)
</read_first>

<action>
In the existing `for (const { key, content } of contents)` loop, capture the result of
`parseBlocks(content)` into a module-scope map `tokensByKey` keyed by the content `key`
(`tokensByKey[key] = tokens`). Do not change the inline walk or any existing
`err`/`warn`/`pass` call. After the loop, `tokensByKey`, `contents`, and `doc` must be
referenceable as a single bundle (e.g. an object literal `{ doc, contents, tokensByKey }`)
so a future `require('./render-safety')(...)` call can consume them — but do **not** add
the render-safety require in this phase. No behavioural change to validation output.
</action>

<acceptance_criteria>
- `validate.js` contains `tokensByKey` populated inside the existing content loop (one entry per `contents` key).
- Running `node validate.js <example-output.json>` produces byte-identical `── results ──` output to the pre-change version (capture before/after, diff = empty).
- `tokensByKey` is non-empty for the shipped example page (assert in T6 test: `Object.keys(tokensByKey).length >= 1` and the first entry is an array of token objects with `name`/`attrs`).
- No new `require` of `render-safety` is added in this phase.
</acceptance_criteria>

### T2 — Extract `DASH_RE` into a configurable glyph set (validate.js)

<read_first>
- scripts/validate.js  (lines 215-233 — `DASH_RE`, the dash scan, the `TASTE:` err/pass)
- RENDER-FAULT-FINDER-SPEC.md §4 "RS-GLYPH" (lines 143-146)
</read_first>

<action>
Replace the hard-coded `const DASH_RE = /…/gi` with a small configurable structure — a
named glyph set whose **default** is dashes only (`—`, `–`, and their entities), so
current behaviour is identical and the shipped example's curly apostrophes still do not
trip it. Expose the set so it can be overridden by a `--ban-glyphs "—–…"` CLI value
(parse via the existing `argValue` helper) and so `render-safety.js` can import the same
default in Phase 1. Keep the `TASTE:` message and FAIL semantics unchanged when the
default set is used.
</action>

<acceptance_criteria>
- `DASH_RE` literal is gone; replaced by an overridable glyph-set value (e.g. `GLYPH_SET` built from a default-dashes source string).
- With no `--ban-glyphs` flag, `node validate.js <example-output.json>` output is byte-identical to pre-change (same `TASTE:` PASS/FAIL line).
- `node validate.js <fixture-with-ellipsis> --ban-glyphs "…"` FAILs on a `…` that the default run passes (proves override works).
- The default glyph source is exported/exposed for reuse (assert importable in T6 test).
</acceptance_criteria>

### T3 — `theatreAttrs()` as the sole writer of the custom-attributes path (divi-builder.js)

<read_first>
- scripts/divi-builder.js  (`theatreAttrs` lines 96-113; `withTheatre` lines 116-119; `merge` lines 26-37; every module's `attrs = prune(merge(attrs, withTheatre(o)))` line)
- RENDER-FAULT-FINDER-SPEC.md §4 "RS-ATTR-PATH" (lines 119-123)
- memory: divi5-custom-attribute-schema (canonical path is module.decoration.attributes)
</read_first>

<action>
Add a normaliser invoked inside `withTheatre()` (or immediately after each
`merge(attrs, withTheatre(o))`) that inspects the merged attrs for a **wrong-shape**
custom-attributes branch arriving via the `attrs:` escape hatch and either migrates it
to the canonical array or throws a clear build-time error. Detect: (a) any
`module.advanced.attributes`, (b) a top-level `advanced.attributes`, and (c) a
`module.decoration.attributes.desktop.value.attributes` that is present but **not** an
`Array` of `{name,value}` objects (e.g. a key→value map). Migration target is identical
to `theatreAttrs()` output: `{ name, value: String(v), targetElement: 'main' }[]` at
`module.decoration.attributes.desktop.value.attributes`. Default behaviour: **throw**
with the offending path in the message (fail loud at generate time); migration is
acceptable only if it produces byte-identical canonical output. Correct
`theatreAttrs()` output must pass through untouched.
</action>

<acceptance_criteria>
- A module built with `attrs: { module: { advanced: { attributes: { 'data-theatre': 'fade-up' } } } }` either throws at build time with a message naming `module.advanced.attributes`, or emits the canonical array — never the `advanced` shape. (Assert in T6.)
- A module built with `theatre: 'fade-up'` (normal path) emits exactly `module.decoration.attributes.desktop.value.attributes = [{name:'data-theatre',value:'fade-up',targetElement:'main'}]` — unchanged from current behaviour.
- A key→value map at the decoration path is rejected/migrated, never emitted as-is.
- All existing example builds (`examples/`) still assemble without error.
</acceptance_criteria>

### T4 — Confirm raw-quote mechanism, then harden content emission (divi-builder.js)

<read_first>
- scripts/divi-builder.js  (`block` lines 63-69; `dv` lines 56-60; `text` lines 238-258; `heading`; `blurb`; `button`; `placeholder`; `assemble` lines 422-448 — note double-encoding for et_builder)
- RENDER-FAULT-FINDER-SPEC.md §4 "RS-RAW-QUOTE" (lines 131-135) and §2 fault #3
</read_first>

<action>
**Step 1 — confirm (gating).** Before changing emission, reproduce the fault: build a
`text({ html: '<p>data-theatre="fade-up"</p>' })`, run it through `block()` →
`assemble({context:'et_builder'})` → `JSON.stringify`, then JSON.parse back twice and
confirm whether the inner block-comment JSON round-trips. Record the finding (one
paragraph) in this file under "## Findings" — specifically: does the fault originate in
the generator path at all, or only in hand-authored / non-`block()` content? The Phase 1
RS-RAW-QUOTE auto-fix design depends on this answer.

**Step 2 — harden.** Route all module innerContent HTML through one shared
`htmlContent(html)` normaliser used by `text`, `heading` (where it takes HTML),
`blurb`, `button`, `eyebrow`, and the footer link path. The normaliser must make the
emitted HTML robust regardless of the confirmed mechanism: convert double-quoted HTML
attributes to single quotes (matching the existing footer `<a href='…'>` convention the
spec relies on) and escape any stray literal `"` in text nodes to `&quot;`. It must be
idempotent and must not alter `&quot;`, `&#34;`, existing single-quoted attributes, or
the `$variable(...)$` / `presetTag` (`&quot;`) tokens.
</action>

<acceptance_criteria>
- "## Findings" section added below, stating the confirmed origin of fault #3 (generator vs hand-authored) with the round-trip evidence.
- A `text()` containing `<p>He said "hi" and href="x"</p>` emits content that, after the full `assemble`→`JSON.stringify`→`JSON.parse` round-trip, contains no unescaped `"` inside the block-comment JSON and renders as a non-empty `<p>` (assert string shape in T6).
- `htmlContent()` is idempotent: `htmlContent(htmlContent(x)) === htmlContent(x)` for the test inputs.
- `&quot;`, single-quoted attrs, and `$variable(...)$` tokens pass through unchanged.
- Existing `examples/` output still validates green via `validate.js`.
</acceptance_criteria>

### T5 — Share the glyph default across validator and (optional) emitter

<read_first>
- scripts/validate.js  (T2 result — exported glyph default)
- scripts/divi-builder.js  (`htmlContent` from T4)
</read_first>

<action>
Make the dash/glyph default a single source of truth: export it from one place (a tiny
`scripts/glyphs.js` or an export on `validate.js`/`render-safety` precursor) and have
both T2's validator path and — if low-risk — T4's `htmlContent()` reference it, so the
ban list cannot drift between "what the generator avoids emitting" and "what the
validator flags". Do **not** auto-rewrite author copy in the emitter (that risks
mangling intentional glyphs); scope the emitter use to a no-op import + shared constant
for now, with the actual substitution left to the user/validator `--fix` in Phase 1.
</action>

<acceptance_criteria>
- Exactly one definition of the default banned-glyph set in the repo; both `validate.js` and the emitter import it (grep shows a single source string).
- No author-visible copy is silently rewritten by the emitter in this phase (glyph substitution remains a validator/`--fix` concern).
- `node validate.js <example-output.json>` output unchanged from baseline.
</acceptance_criteria>

### T6 — Fixtures + regression verification (BLOCKING)

<read_first>
- scripts/validate.js, scripts/divi-builder.js (post-T1..T5)
- RENDER-FAULT-FINDER-SPEC.md §4 "Test fixtures" (lines 187-189)
</read_first>

<action>
Create `scripts/__fixtures__/render-safety/` seed fixtures used by this phase and reused
in Phase 1: `attr-path.{pass,fail-advanced,fail-map}`, `raw-quote.{pass,fail}`,
`glyph.{pass,fail}`. Add a small node test (`scripts/__tests__/phase0.test.js` or inline
assertions runnable with `node`) covering: tokensByKey population (T1), glyph override
(T2), attr-path guard throw/migrate (T3), raw-quote round-trip (T4), single-source glyph
(T5). Capture a baseline `validate.js` report on the shipped example **before** any edits
and assert the post-edit report is byte-identical (the core regression guarantee).
</action>

<acceptance_criteria>
- `node scripts/__tests__/phase0.test.js` exits 0 with all assertions passing.
- Baseline-vs-post diff of `validate.js` output on the example page is empty.
- Fixtures exist at the paths above and are valid `et_builder` docs.
- A one-line how-to-run note is added to this file under "## Verification".
</acceptance_criteria>

---

## must_haves (goal-backward verification)

1. `validate.js` exposes `tokensByKey` for a future `render-safety.js`, with **zero**
   change to current PASS/WARN/FAIL output on the shipped example.
2. The dash ban is a configurable, overridable, single-source glyph set; default run
   behaviour is unchanged.
3. `theatreAttrs()` is the only path that can emit custom attributes; the wrong shape
   (`advanced.attributes` or key→value map) is migrated or thrown at build time, never
   silently emitted.
4. The exact mechanism of fault #3 (raw quote) is **confirmed and recorded**, and module
   content is emitted through one escaping helper proven to survive the import round-trip.
5. The shipped example page still validates green; all `examples/` still assemble.

## Out of scope (deferred to later phases)

- `render-safety.js` itself and the RS-* rules (Phase 1).
- `RS-CONTRAST` colour-resolution engine (Phase 2).
- Any live/headless verification, `verify-rendered.js`, `/verify` endpoint (Phases 3-4).
- Wiring `render-safety` into `validate.js` (Phase 1 — Phase 0 only makes it cheap).

## Findings

### T4 Step 1 — confirmed origin of fault #3 (raw quote)

**The fault does NOT originate in the generator path.** Reproduced via
`.tmp/t4-repro.js`: building `text({ html })` → `block()` → `assemble({context:'et_builder'})`
→ `JSON.stringify` → `JSON.parse` recovers the original innerContent value
byte-for-byte in every case, including `<p>He said "hi" and href="x"</p>` and
`<p>data-theatre="fade-up"</p>`.

Why it round-trips: `block()` runs the whole attrs object (including
`innerContent.desktop.value` HTML) through `JSON.stringify`, which escapes
every literal `"` inside the HTML value as `\"` *inside the block-comment
JSON*. That block-comment JSON is then a value inside the outer `data["1"]`
string, so the outer `JSON.stringify` (in user code) escapes those `\"`
sequences again to `\\\"`. Divi's import path is the inverse:
`json_decode($data[1])` (recovers the comment string) → block-parse →
`json_decode(attrs)` (recovers the original HTML with its literal `"`).
Standard, symmetric, lossless.

**Therefore fault #3 originates only in hand-authored content** — a `data`
string written without going through `block()`, where a literal `"` inside
the comment JSON breaks the strict `json_decode` and Divi silently empties
the module.

**Implication for Phase 1 RS-RAW-QUOTE:** the rule's *detection* must run at
the **raw content string** level (so a literal `"` that would break the
comment parser is caught even when `parseBlocks` would yield `attrs:null`).
The `--fix` must operate only on isolated post-parse innerContent values
(where the value boundary is known unambiguously) — flag-only when the
attrs JSON failed to parse.

The T4 Step 2 emitter hardening (`htmlContent()`) is therefore defence in
depth: it makes the recovered innerContent value itself free of any `"` so
Phase 1's RS-RAW-QUOTE has nothing to flag on generator-emitted output, and
it normalises to the existing `<a href='…'>` single-quote convention the
spec relies on.

## Verification

How to run the Phase 0 regression:

```bash
cd plugins/divi5-tools/skills/landing-page
node scripts/__tests__/phase0.test.js
# → "70 passed, 0 failed", exit 0
```

What the suite checks (70 assertions across 6 sections):

- **T1** — `validate.js` source declares `tokensByKey = {}` and populates
  `tokensByKey[key] = tokens` inside the existing content loop; no
  `require('./render-safety')` was added in this phase.
- **T2** — `glyphs.DEFAULT_GLYPH_SOURCE` is dashes-only; default regex
  matches em-dash/en-dash literals and their HTML entity forms but not the
  ASCII hyphen or ellipsis; `--ban-glyphs "…"` override adds the ellipsis
  to the set and drops the default entity forms (override = literals only).
- **T3** — canonical `theatreAttrs()` output passes through untouched as
  `Array<{name,value,targetElement:'main'}>`; `module.advanced.attributes`
  and top-level `advanced.attributes` throw with the offending path in the
  message; a key→value map at the canonical path is migrated to the
  canonical array; an array of non-canonical objects throws.
- **T4** — `htmlContent()` converts double-quoted HTML attrs to
  single-quoted, escapes text-node `"` to `&quot;`, preserves `&quot;`,
  `&#34;`, single-quoted attrs and `$variable({...})$` tokens, and is
  idempotent on a battery of inputs; `text()` with a literal `"` round-trips
  through `assemble` → `JSON.stringify` → `JSON.parse` with no literal `"`
  in the recovered value.
- **T5** — exactly one definition of the default banned-glyph set (in
  `scripts/glyphs.js`); both `validate.js` and `divi-builder.js` import it;
  the emitter imports the constant only (no `buildGlyphRe()` call —
  emitter stays no-op on glyphs in Phase 0).
- **T6** — the shipped example page (`examples/divitheatre-landing-page.json`)
  is regenerated and its validator report is **byte-identical** to the
  captured baseline (`14 PASS, 0 errors, 0 warnings`); all 7 seed fixtures
  exist at their expected paths and are valid `et_builder` docs.

Baseline capture (run before any Phase 0 edits):

```bash
node examples/example-divitheatre-page.js
node scripts/validate.js examples/divitheatre-landing-page.json \
  --keyword "Divi 5 animation plugin" --meta examples/divitheatre-seo-meta.json \
  > /tmp/phase0-baseline.txt
```

External baseline mode (skips the embedded snapshot):

```bash
PHASE0_BASELINE=/tmp/phase0-baseline.txt node scripts/__tests__/phase0.test.js
```

Regenerate the seed fixtures (rarely needed — only when the builder's
structural conventions change):

```bash
node scripts/__fixtures__/render-safety/generate.js
```
