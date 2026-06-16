# Roadmap: Divi 5 Render-Safety Fault Finder

## Overview

Five phases take the landing-page generator from "validates green but renders broken" to a
two-tier render-safety net with a hardened emitter. Phase 0 makes the cheap structural
changes and kills the deterministic faults at source. Phase 1 is the highest-value,
lowest-cost slice — the four cheap static rules, three auto-fixable. Phase 2 adds the one
fiddly static check (contrast). Phase 3 adds live DOM verification for the faults no linter
can see. Phase 4 is an optional server-side pre-screen. Each phase ships independently.

## Phases

**Phase Numbering:**
- Phase 0 is enabling prep (per spec §6); Phases 1–4 are the rollout proper.

- [ ] **Phase 0: Prep & Emitter Hardening** - `validate.js` token retention + glyph-set refactor, and emitter hardening so the generator cannot emit faults 1/3/8
- [ ] **Phase 1: Tier 1 Cheap Wins** - `render-safety.js` with RS-ATTR-PATH, RS-INLINE-STYLE, RS-RAW-QUOTE, RS-GLYPH + `--fix`, wired into `validate.js`
- [ ] **Phase 2: Tier 1 Contrast** - RS-CONTRAST colour-resolution engine + WCAG ratio
- [ ] **Phase 3: Tier 2 Live Verify** - `verify-rendered.js` (publish-then-revert) with the RV-* DOM assertions
- [ ] **Phase 4: Optional /verify Endpoint** - server-side Tier 1.5 pre-screen on the importer

## Phase Details

### Phase 0: Prep & Emitter Hardening
**Goal**: `validate.js` exposes parsed tokens and a configurable glyph set for a future `render-safety.js` (zero behaviour change), and `divi-builder.js` cannot emit the deterministic render faults — `theatreAttrs()` is the sole writer of the attributes path and content goes through one proven escaping helper.
**Depends on**: Nothing (first phase)
**Requirements**: PREP-01, PREP-02, HARD-01, HARD-02
**Success Criteria** (what must be TRUE):
  1. `validate.js` populates `tokensByKey` in the existing loop; `node validate.js <example>` output is byte-identical to before
  2. `DASH_RE` is replaced by an overridable, single-source glyph set; default run unchanged; `--ban-glyphs "…"` proven to override
  3. A module built with a wrong-shape custom-attributes branch is migrated or throws at build time; the normal `theatre:` path is unchanged
  4. The fault #3 mechanism is recorded in the plan's Findings; a `"`-containing paragraph round-trips without an empty module, proven by a test
  5. The shipped example still validates green; all `examples/` still assemble
**Plans**: 1 plan
Plans:
- [ ] 00-01-PLAN.md — prep (tokensByKey + glyph set) + emitter hardening (theatreAttrs sole writer, content escaping) + fixtures/regression

### Phase 1: Tier 1 Cheap Wins
**Goal**: `node validate.js` statically flags faults 1, 2, 3, 8 with one combined report and exit code, three of them auto-fixable via `--fix`.
**Depends on**: Phase 0
**Requirements**: RS-ATTR, RS-STYLE, RS-QUOTE, RS-GLYPH, RS-FIX, RS-WIRE
**Success Criteria** (what must be TRUE):
  1. `render-safety.js` exports one pure function `(parsed, opts) => { errors, warnings, passes, fixes }` with no I/O and no `process.exit`
  2. RS-ATTR-PATH, RS-INLINE-STYLE, RS-RAW-QUOTE, RS-GLYPH each FAIL on their fail-fixture and PASS on their pass-fixture
  3. `--fix` auto-fixes RS-ATTR-PATH, RS-RAW-QUOTE (post-parse), RS-GLYPH; re-lint of the fixed file = 0 errors; never touches presets/colors/delimiters; leaves file untouched on unparseable attrs
  4. Wired into `validate.js` default-on; `--no-render-safety` skips; findings merge into one report; a render-safety FAIL exits 1
**Plans**: TBD
**UI hint**: no

### Phase 2: Tier 1 Contrast
**Goal**: `node validate.js` statically catches dark-on-dark / low-contrast text by resolving effective colour through presets, global-colour vars, and ancestor inheritance.
**Depends on**: Phase 1
**Requirements**: RS-CONTRAST
**Success Criteria** (what must be TRUE):
  1. `resolveColors(token, ancestry, doc)` resolves text + background through inline → preset → defaults → global-colour var, nearest-ancestor background
  2. WCAG ratio computed with correct thresholds (4.5:1 normal, 3:1 large); fail-fixture FAILs (or WARNs under WARN-first), pass-fixture passes
  3. Image/gradient/translucent backgrounds downgrade to WARN, never a false FAIL; `--contrast-warn` flips all RS-CONTRAST to WARN
**Plans**: TBD
**UI hint**: no

### Phase 3: Tier 2 Live Verify
**Goal**: `verify-rendered.js` imports a candidate to a running Divi 5 site, renders it headless, and asserts against the DOM — catching faults 5, 6, 7 including the plugin-side stagger bug.
**Depends on**: Phase 1 (shares expectation-extraction; Phase 2 not required)
**Requirements**: RV-ATTR-COUNT, RV-EMPTY-MODULE, RV-HIDDEN-ANCESTOR, RV-CONTRAST, RV-H1, RV-IMG-ALT, RV-TRANSPORT
**Success Criteria** (what must be TRUE):
  1. Imports as draft, publishes-then-reverts on staging, renders headless, asserts, and always cleans up in a `finally`
  2. RV-ATTR-COUNT, RV-EMPTY-MODULE, RV-HIDDEN-ANCESTOR, RV-H1, RV-IMG-ALT, RV-CONTRAST each pass/fail correctly against known-good and known-broken pages
  3. RV-HIDDEN-ANCESTOR waits on a deterministic settle signal (not a magic timeout) at a desktop viewport ≥768px
  4. Exit codes per spec (0 pass / 1 assertion fail / 2 usage / 3 env / 4 import-render); key never logged
**Plans**: TBD
**UI hint**: no

**Pre-condition (research before planning):** Confirm the divi-tools-importer exposes the `/import` + `/ping` contract the spec assumes, and that DiviTheatre emits (or can emit) a settle signal for RV-HIDDEN-ANCESTOR. See spec §5.

### Phase 4: Optional /verify Endpoint
**Goal**: A server-side `/verify` route on the importer returns the cheap static-HTML-shape findings with no browser, as a fast pre-screen.
**Depends on**: Phase 3 (shares assertion semantics)
**Requirements**: VERIFY-EP
**Success Criteria** (what must be TRUE):
  1. `/verify` reuses `DTI_RestApi::authenticate`, builds `post_content` like `PageImporter`, renders via `do_blocks()`, parses with `DOMDocument`
  2. Returns RV-ATTR-COUNT, RV-EMPTY-MODULE, RV-H1, RV-IMG-ALT; explicitly does not attempt opacity/contrast/runtime checks
**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Prep & Emitter Hardening | 0/1 | Planned (ready to execute) | - |
| 1. Tier 1 Cheap Wins | 0/TBD | Not started | - |
| 2. Tier 1 Contrast | 0/TBD | Not started | - |
| 3. Tier 2 Live Verify | 0/TBD | Not started | - |
| 4. Optional /verify Endpoint | 0/TBD | Not started | - |
