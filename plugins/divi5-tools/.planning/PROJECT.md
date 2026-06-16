# Divi 5 Render-Safety Fault Finder

## What This Is

A validation layer for the `divi5-tools` landing-page generator that closes the gap
between "validates green" and "actually renders". The existing `scripts/validate.js`
checks structure and SEO but is blind to the render layer — Divi 5 fails silently,
dropping malformed attributes, emptying modules that carried inline CSS, or hiding whole
rows with no error anywhere. This project makes those silent render failures loud, in two
tiers, and hardens the generator so it cannot emit the deterministic faults at source.

Spans two code areas in this repo: the **landing-page skill** (`skills/landing-page/`,
the generator + validator) and the **divi-tools-importer plugin**
(`plugin/divi-tools-importer/`, the live-verify transport and optional `/verify` endpoint).

## Core Value

A page that passes validation is a page that actually renders — no silently dropped
attributes, emptied modules, or invisible text — and the generator cannot produce the
known deterministic faults in the first place.

## Requirements

### Validated

(None yet)

### Active

**Phase 0 — Prep & emitter hardening:**
- [ ] `validate.js` retains parsed tokens in a `tokensByKey` map for re-walk without re-parse (PREP-01)
- [ ] Hard-coded `DASH_RE` extracted into a configurable, overridable, single-source glyph set (PREP-02)
- [ ] `theatreAttrs()` is the only writer of the custom-attributes path; wrong shapes migrated/thrown at build time (HARD-01)
- [ ] Raw-quote mechanism confirmed; module content emitted through one escaping helper proven to survive import round-trip (HARD-02)

**Phase 1 — Tier 1 cheap wins:**
- [ ] `render-safety.js` module with RS-ATTR-PATH, RS-INLINE-STYLE, RS-RAW-QUOTE, RS-GLYPH + `--fix`, wired into `validate.js` default-on (RS-ATTR, RS-STYLE, RS-QUOTE, RS-GLYPH, RS-FIX)

**Phase 2 — Tier 1 contrast:**
- [ ] RS-CONTRAST colour-resolution engine (preset → global-colour var → ancestor inheritance) + WCAG ratio (RS-CONTRAST)

**Phase 3 — Tier 2 live verify:**
- [ ] `verify-rendered.js` (publish-then-revert via headless browser) with RV-ATTR-COUNT, RV-EMPTY-MODULE, RV-HIDDEN-ANCESTOR, RV-H1, RV-IMG-ALT, RV-CONTRAST (RV-*)

**Phase 4 — Optional `/verify` endpoint (Tier 1.5):**
- [ ] Server-side `/verify` route on the importer for the cheap structural subset (VERIFY-EP)

### Out of Scope

- Contrast over images/gradients/video/translucent layers as a hard FAIL — forced WARN downgrades (honest limit, spec §4)
- `:hover`/`:active` state contrast — out of scope
- Pointing Tier 2 Option A (publish-then-revert) at a production site — staging/LocalWP only
- Replacing `validate.js`'s structural/SEO checks — render-safety is additive

## Context

- **The trigger.** In one debugging session a page validated green five separate times while visibly broken. Every fault lived in the gap between "validates green" and "actually renders". The full fault catalogue and tier design live in `skills/landing-page/RENDER-FAULT-FINDER-SPEC.md`.
- **Two tiers.** Tier 1 = static lint (pre-import, cheap, no running site, *prevents*). Tier 2 = live verify (post-import, headless browser DOM assertions, *confirms* — including plugin-side bugs a linter could never find, e.g. the DiviTheatre `stagger` opacity bug).
- **Generator is mostly already correct.** `block()` JSON-stringifies all attrs incl. innerContent; `theatreAttrs()` already writes the canonical `module.decoration.attributes` path. Residual risk is the `attrs:` escape hatches and the unconfirmed exact mechanism of the raw-quote fault — both addressed in Phase 0.
- **Sibling project.** DiviTheatre (the animation plugin whose `data-theatre` attributes this validator protects) is a separate GSD project in its own repo.

## Constraints

- **Tier 1 is pure JS-over-JSON.** No browser, no I/O in the rule module — `render-safety.js` exports one pure function `(parsed, opts) => { errors, warnings, passes, fixes }` and never calls `process.exit`.
- **One report, one exit code.** Render-safety findings merge into `validate.js`'s existing `errors`/`warnings`/`passes` arrays; a render-safety FAIL drives the same exit code 1.
- **Default-on, opt-out.** RS-* rules run on every `node validate.js`; opt out with `--no-render-safety`.
- **`--fix` safety.** Auto-fix only RS-ATTR-PATH, RS-RAW-QUOTE (post-parse only), RS-GLYPH. Never auto-fix RS-INLINE-STYLE or RS-CONTRAST. Re-emit via the builder's own `block()`; never touch presets/global_colors/images/delimiters; leave file untouched when a block's attrs JSON failed to parse.
- **Tier 2 transport.** Option A (publish-then-revert) on staging/LocalWP only; always clean up in a `finally`; never log the key; back off on HTTP 429.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate `render-safety.js` module called by `validate.js` (not folded in) | Keeps validate.js single-purpose; independently unit-testable; reusable by Tier 2 and import-to-local; tiny diff | — Pending (Phase 1) |
| Harden the emitter in Phase 0, not just lint it | Faults 1/3/8 are generator bugs; fixing at source makes the lint a net rather than load-bearing | — Pending (Phase 0) |
| Confirm raw-quote mechanism before designing its auto-fix | `block()` already JSON-escapes; the exact failure path must be proven, not guessed | — Pending (Phase 0) |
| RS-CONTRAST ships WARN-first, promote to FAIL later | Resolver can't see image/gradient backgrounds; measure false-positive rate before blocking | — Open decision (recommended deviation from spec §7.2) |
| Tier 2 Option A publish-then-revert, staging only | Sidesteps draft-auth; faithful render incl. runtime; bounded blast radius | — Pending (Phase 3) |
| Phase 0 numbered 0 (not 1) | Matches spec §6 rollout; it is enabling prep, shippable on its own | ✓ |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-06-15 after initialization (hand-scaffolded from RENDER-FAULT-FINDER-SPEC.md)*
