# Divi 5 Generator — From "kinda works" to amazing (from new OR existing page)

**Date:** 2026-06-22
**Status:** Draft — awaiting pick of starting phase
**Scope:** Make the generator reliably produce pages that render identically to the approved mockup, AND add a round-trip "edit an existing exported page" workflow.

---

## Phase -1 — Rebuild stale zip + remove confusing duplicate (BLOCKER)

**Status confirmed 2026-06-22.** The canonical source at `plugins/divi5-tools/plugin/divi-tools-importer/` is **already v1.2.0** and byte-identical to the installed plugin (synced via `deploy.sh`). All 9 src files including `LibraryImporter`, `PagePreviewer`, `PageExporter`, `PresetManager` are present, and `PageImporter` has all the critical fixes (CSS cache flush, `$wpdb->update` bypass, `clear_page_css_cache()`, page template meta).

The actual problems are bookkeeping, not missing fixes:

1. **`divi-tools-importer.zip` is stale** — built 2026-06-14 from v1.0.0 source, before the v1.2.0 work landed on 2026-06-19. Anyone installing fresh gets the broken version.
2. **`divi-tools-importer/` at repo root is a stale duplicate** of the canonical source. v1.0.0, 5 src files, no fixes. Confusing orphan that misleads anyone (it misled the initial diagnosis).

**Actions:**

1. Delete the stale duplicate directory `divi-tools-importer/` at repo root.
2. Rebuild the zip from the correct source: `bash plugins/divi5-tools/plugin/build-zip.sh`.
3. Verify the new zip: `Version: 1.2.0`, 15 files (not 11), includes the 4 endpoints' source files.
4. Commit with `chore(importer): rebuild zip from v1.2.0 source, drop stale repo-root duplicate`.

**Exit criteria:** `unzip -p divi-tools-importer.zip divi-tools-importer/divi-tools-importer.php | grep Version` shows `1.2.0`. `unzip -l divi-tools-importer.zip | grep -c LibraryImporter` returns 1. Repo root no longer has a `divi-tools-importer/` directory.

**Why this is Phase -1, not Phase 1:** the broken zip is the actual delivery channel to new sites. Until it's rebuilt, every clean install is broken regardless of what the generator does.

> **Update (later, 2026-06-22):** the committed zip was removed entirely — the Claude Code plugin installer rejects packages with a nested `.zip` ("nested zips not allowed"), which blocked fresh plugin installs. The importer now ships as unpacked source under `plugin/divi-tools-importer/` and the zip is **built on demand** (`skills/import-to-local/scripts/build-plugin-zip.sh`). The "commit the rebuilt zip" step above no longer applies; the version/contents checks still do, run against the freshly built zip.

---

## What's actually breaking today (evidence)

Pages are landing in WordPress with default-blue buttons and missing styles. Root causes, traced in code:

| # | Symptom | Root cause | Evidence |
|---|---|---|---|
| 1 | Buttons render default blue | Preset-first mode ships `modulePreset: ['id']` with no inline attrs; if the preset pack isn't already imported on the site, no CSS is generated for the button | `divi-builder.js:710-718` `presetRef()` returns `{id, attrs: null}`; comment at `:736` admits "preset registry is VB-only" |
| 2 | `colorRef('Label')` blows up builds | Throws on any unknown label, so the AI either bails or avoids the API | `divi-builder.js:677, 684` |
| 3 | Pages pass validation with phantom preset IDs | "Preset-first mode" trusts any ID when `presets.module` is empty | `validate.js:249-253` |
| 4 | Raw hex in font/border colour FAILs even when variable refs wouldn't render there either | Validator's ET-token scan strips only `background` and `button` paths | `validate.js:319-321` |
| 5 | No way to start from an existing page | Only `divi5-style-check` exists (compares two exports); no export→mutate→import flow | `skills/` has no ingest/extract step |
| 6 | Render-time failures slip through | `/preview` endpoint exists but the skill calls it "preferred", not required | `SKILL.md:135-138` |

The builder itself hasn't changed since `66229c5`. The regressions come from the **constraints** (validator + token API) getting tighter without the **safety nets** (preset inlining, render smoke-test) getting stronger.

---

## Design principle for the rewrite

> **A page that validates must render.** Validation that passes while the live render is broken is a bug in the validator, not a success.

Every phase below either (a) makes a silent failure loud, (b) makes the generator unable to emit a known-broken pattern, or (c) adds a round-trip capability we don't have.

---

## Phase 1 — Stop the bleeding (button/style regressions)

**Goal:** every page generated today renders with the buttons and colours the AI specified, with no extra manual steps.

### 1A. Inline preset attrs by default; preset-first as opt-in
- Change `applyPreset()` (`divi-builder.js:70`) so when preset attrs exist they are ALWAYS merged in as base (current behaviour for `b.preset()`); when a preset is referenced from the site registry via `presetRef()`, fetch its attrs from the registry and inline them too.
- Add `b.loadPresetRegistry(registry, { withAttrs: true })` that pulls attrs from `GET /wp-json/divi-tools/v1/presets` (extend importer to return attrs, not just IDs — see 1D).
- Without `withAttrs`, `presetRef()` THROWS — loud failure beats silent default-blue.

### 1B. Make `colorRef()` / `variableRef()` fall back, not throw
- Unknown label → `console.warn` + return the raw hex fallback from `tokens.colorHex[label]` if present, else `undefined`.
- Add `b.color(labelOrHex)` unified accessor: accepts a label, a hex, or a `gcid-*` slug; returns the right form for the field. The AI never has to pick the right API.
- Keep the validator's ET-token FAIL — but only fire it when the raw hex is in a path where variable refs actually resolve (font, text, link, icon, divider). Skip border/box-shadow until proven.

### 1C. Validator: kill the silent preset-first bypass
- `validate.js:249-253`: in preset-first mode, require a loaded registry on disk (`references/et-preset-registry.json` or the `*.presets.json` next to the page). Cross-check every `modulePreset` ID against it. FAIL on unknown ID.
- Same change for `gcid-*` references: in preset-first mode, require a `*.variables.json` next to the page; FAIL on undefined gcid.

### 1D. Importer: return preset attrs
- `divi-tools-importer/src/RestApi.php`: extend `GET /presets` to include each preset's attrs (already stored in `et_preset` post content). Needs a capability check; redact anything sensitive.
- Lets `loadPresetRegistry(..., { withAttrs: true })` work without shipping a separate file.

**Exit criteria:** Generating the existing `iConnectITHomepage` from scratch produces a page whose live screenshot matches the mockup, with no manual "remember to import presets first" step.

---

## Phase 2 — Round-trip: edit an existing exported page (NEW capability)

**Goal:** user drops a Divi 5 export JSON (theirs or a client's), the skill lets them say "change the hero copy, swap the accent colour, add a FAQ section" and re-imports.

### 2A. `divi5-ingest` skill (new)
- Reads an export JSON → produces three artefacts alongside it:
  - `<name>.tokens.js` — colours, variables, type scale (extend the existing `style-variables` extractor)
  - `<name>.presets.json` — preset ID → { name, attrs } map (uses 1D)
  - `<name>.outline.json` — section-by-section outline (adminLabel, module types, copy)
- The tokens + presets files become first-class inputs to the generator (Stage 1 of the SKILL already half-supports this — finish the wiring).

### 2B. `divi5-page-mutator` skill (new) — or a `--mutate` mode in the existing skill
- Takes an exported page + a change spec ("replace accent #X with #Y", "rewrite hero copy to ...", "insert FAQ section before footer").
- Loads the page through the builder IN REVERSE: parse block comments → rebuild builder calls → apply mutations → re-emit.
- This is the half that needs the most design work: a parser from block-comment JSON → builder call tree. The validator already parses blocks (`validate.js:97-110`); reuse that and add a materialiser that walks the token stream emitting `D.section(...)`, `D.button(...)`, etc.

### 2C. Preservation contract
- Mutations MUST preserve every preset ID, gcid, and post_meta that existed in the source unless explicitly changed. Add a "preservation diff" to the validator: source vs mutated, FAIL on any unintentional ID change.
- This is the trust contract for the whole "from existing page" pitch.

**Exit criteria:** Take the bundled `Divi-5-Launch-Freebie_Pages.json`, change its hero copy and accent colour via natural language, re-import, and the live render shows exactly those two changes and nothing else.

---

## Phase 3 — Taste + quality bar (the "amazing" part)

**Goal:** generated pages look like the Floria references, not Divi demos. Today this is enforced by the SKILL prompt only — it needs teeth.

### 3A. HTML-preview taste gate becomes deterministic
- Codify `taste.md §14` pre-flight as a `taste-check.js` that scans `preview-*.html`: hero layout, em-dash ban (already in validator), three-equal-card detection, eyebrow count, AI-tell decoration patterns.
- Run it automatically in Stage 2; FAIL blocks JSON generation.

### 3B. Visual regression gate (Stage 4) gets automated
- Playwright screenshot of live page → diff against Stage 2 mockup screenshot with a tuned tolerance (ignore text-aa, focus on layout/colour blocks).
- Output a numeric fidelity score; below threshold = block delivery.

### 3C. Section library upgrade
- Today: 304 ET reference sections used as "structural inspiration" only.
- Upgrade: extract the 10 best per type into builder-ready `D.section(...)` partials in `references/section-library/`. Generator picks by section type instead of inventing from scratch.

**Exit criteria:** generate 3 pages from brief (services, agency, SaaS) → all three pass taste-check, score >0.85 on visual diff, and a designer reviewer can't tell whichDivi demo they came from.

---

## Phase 4 — Safety net (silent failures become loud)

**Goal:** any future regression surfaces before the user sees it.

### 4A. Hard render smoke-test gate
- SKILL.md: promote `/preview` from "preferred" to REQUIRED. Skill won't deliver JSON until preview renders without server-side errors.
- Catch: shortcode tokens not replaced, modules emptied by kses, preset CSS missing.

### 4B. Self-test fixture suite
- `scripts/__tests__/` with one fixture per known past bug: doubled `divi/` prefix, code module with `[]`, button without `enable:'on'`, raw hex matching ET token, em-dash in copy, phantom preset ID.
- Each fixture = a JSON snippet + expected validator verdict. CI-runnable, no WordPress required.

### 4C. Bundled example pages regressed
- `iConnectITHomepage`, `pet-rescue`, `rub-you-well` checked into `__tests__/` as golden outputs. Generator changes that break them fail the suite.

**Exit criteria:** `npm test` from `plugins/divi5-tools` runs the suite green; introducing any of the six past bugs fails a named test.

---

## Recommended order

| Phase | Why first | Effort | Risk if skipped |
|---|---|---|---|
| **1** Stop the bleeding | Users see broken pages TODAY | M | Users lose trust, stop using it |
| **4A** Render smoke-test gate | Catches everything Phase 1 doesn't | S | Future regressions slip again |
| **2** Round-trip existing page | The new "amazing" capability | L | Skill stays new-page-only |
| **3** Taste + visual gate | Pushes quality from "ok" to "amazing" | L | Pages work but look generic |
| **4B/4C** Test suite | Locks in everything above | M | Bugs creep back |

Phase 1 + 4A is a coherent "make today not broken" release. Phase 2 is the next major version. Phase 3 is the polish release.

---

## Open questions (need your call before I start)

1. **Preset strategy.** Do you want to (a) require the ET preset pack to be imported on every site first (preset-first, leaner pages), or (b) ship presets inline with every page (bigger JSON, zero setup)? Today it's a hybrid and that's the bug.
2. **Mutator scope.** For Phase 2, do you want full "edit anything" (heavy), or start with a constrained change-set (copy, colours, swap section order, add/remove sections)? The constrained version is ~half the work and covers 90% of requests.
3. **Where does the design bar live?** Codifying taste (Phase 3A) means writing rules about what "good" looks like. Are you OK with the Floria references as the hard bar, or do you want a different target?
4. **Backwards compatibility.** The validator changes in Phase 1C will FAIL some pages that currently pass. OK to ship as a breaking change (with migration notes), or do you want a `--legacy` flag for one release?
