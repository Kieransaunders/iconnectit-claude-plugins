# Requirements: Divi 5 Render-Safety Fault Finder

**Source:** `skills/landing-page/RENDER-FAULT-FINDER-SPEC.md`
**Milestone:** v1.0

Each requirement maps to a fault in the spec's §2 catalogue and a phase in §6.

## Phase 0 — Prep & Emitter Hardening

- **PREP-01** — `validate.js` captures `parseBlocks` output into a `tokensByKey` map during the existing content walk, with zero change to current PASS/WARN/FAIL output. Enables `render-safety.js` to re-walk without re-parsing.
- **PREP-02** — The hard-coded `DASH_RE` is replaced by a configurable glyph set (default = dashes only), overridable via `--ban-glyphs`, exported as a single source of truth for reuse by `render-safety.js`.
- **HARD-01** — `theatreAttrs()` is the sole writer of `module.decoration.attributes`; wrong shapes arriving via the `attrs:` escape hatch (`module.advanced.attributes`, top-level `advanced.attributes`, or a key→value map) are migrated to the canonical array or thrown at build time — never silently emitted. (Hardens fault #1 at source.)
- **HARD-02** — The exact mechanism of fault #3 (raw `"` empties module) is confirmed and recorded; module innerContent HTML is emitted through one shared, idempotent escaping helper proven to survive the `assemble`→stringify→parse import round-trip. (Hardens fault #3 at source.)

## Phase 1 — Tier 1 Cheap Wins

- **RS-ATTR** — RS-ATTR-PATH: FAIL when custom attributes are in the wrong shape (silent zero-render). Auto-fixable.
- **RS-STYLE** — RS-INLINE-STYLE: FAIL on inline `style="…"` in module content (Divi empties the module). Flag-only.
- **RS-QUOTE** — RS-RAW-QUOTE: FAIL on unescaped `"` in module content (breaks block-JSON → empties module). Auto-fixable post-parse only.
- **RS-GLYPH** — RS-GLYPH: FAIL on banned glyphs (em/en dash by default). Auto-fixable. Extends PREP-02's glyph set.
- **RS-FIX** — `--fix` applies the auto-fixable rules, re-emits via `block()`, writes `<name>.fixed.json`, idempotent, with the spec's safety guarantees.
- **RS-WIRE** — `render-safety.js` is a pure function called by `validate.js`, default-on (`--no-render-safety` to skip), merging into one report + one exit code.

## Phase 2 — Tier 1 Contrast

- **RS-CONTRAST** — Resolve effective text + background colour (inline → preset → defaults → global-colour var, nearest-ancestor background), compute WCAG ratio, threshold by font size/weight. WARN-first (recommended), `--contrast-warn` global override; honest downgrades for images/gradients/translucency.

## Phase 3 — Tier 2 Live Verify

- **RV-ATTR-COUNT** — DOM `[data-theatre]` count equals JSON expectation (fault #6).
- **RV-EMPTY-MODULE** — No text-bearing module renders empty (faults #2/#3/#5).
- **RV-HIDDEN-ANCESTOR** — No tagged element is hidden by an ancestor `opacity:0` it reports `opacity:1` itself (fault #7, plugin-side stagger bug). Requires settle signal + desktop viewport.
- **RV-CONTRAST** — Computed-style WCAG contrast against rendered background (live confirm of #4).
- **RV-H1** — Exactly one `<h1>` after render (theme header/footer can inject a second).
- **RV-IMG-ALT** — Every content image has non-empty `alt` after render.
- **RV-TRANSPORT** — Option A publish-then-revert on staging only, always clean up in `finally`, never log the key, back off on 429.

## Phase 4 — Optional `/verify` Endpoint (Tier 1.5)

- **VERIFY-EP** — Server-side `/verify` route on the importer (reusing `DTI_RestApi::authenticate`) returns the static-HTML-shape findings (RV-ATTR-COUNT, RV-EMPTY-MODULE, RV-H1, RV-IMG-ALT) with no browser. Pre-screen, not a replacement for Tier 2.

## Definition of Done (milestone v1.0)

- Generator cannot emit faults #1, #3, #8 (Phase 0 guarantees).
- `node validate.js` flags faults #1–#4 and #8 statically with one report + exit code (Phases 1–2).
- `verify-rendered.js` confirms faults #5–#7 against the rendered DOM on staging (Phase 3).
- Every requirement above is covered by at least one plan and verified.
