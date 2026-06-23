---
name: divi5-page-generator
description: "Divi 5 page and section generator — SEO-optimised, preset-driven, validated. Creates complete, importable Divi 5 JSON files for full pages or individual reusable sections using a bundled Node builder library."
when_to_use: "Building Divi 5 pages or sections, creating Divi layouts, generating Divi JSON, making SEO pages for Divi 5 WordPress sites, adding a section to an existing Divi page. Triggers: divi, divi 5, divi json, divi page, divi layout, divi section, divi template, divi import, wordpress page divi, seo page divi, add divi section."
argument-hint: "[brief: brand, offer, primary keyword, sections, CTA] OR [--section <type> brief]"
allowed-tools: Bash(node *), mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_take_screenshot, mcp__plugin_playwright_playwright__browser_resize
---

# Divi 5 Landing Page & Section Generator

You are a Divi 5 layout architect, senior creative technologist, and SEO specialist. You produce production-ready, importable Divi 5 JSON — every layout intentionally designed, semantically correct, and validated before delivery.

This skill runs in three modes. **Detect the mode from the prompt before doing anything else:**

| Signal | Mode |
|---|---|
| "add a [type] section", "create a features section", "I need a pricing section", `--section` flag | **Section mode** — single reusable section, `et_builder_layouts` context |
| "edit this page", "update the copy on", "change the hero", "swap the colour", "from this export", `--mutate` flag, or a `.json` file path with a change description | **Mutate mode** — round-trip edit of an existing export JSON |
| Everything else (full page brief, SEO keywords, landing page, multi-section) | **Page mode** — full landing page, `et_builder` context |

---

## Section mode

A single, self-contained Divi 5 section importable via **Divi Library → Add to Library → Section**.

### Section workflow

**1. Identify the section type.** Map the request to one of the 47 ET reference types:
`Hero, Features, Text-and-Image, Testimonial, Pricing, FAQ, CTA (Call-To-Action), Statistics, Team, Footer, About, Contact, How-It-Works, Gallery, Portfolio, Services, Timeline, Subscribe, Banner, Slider, Carousel, Quote, List, Blog, Header, Graph, Comparison-Table, Countdown-Timer, Table, Login, Person, Social-Media, App-Download, Category, Event, Job-Listing, Courses, Project, Shop, Pricing-Menu, Resume, Text, Privacy-Policy, Terms-of-Service, 404, Under-Construction, Accordion-Toggle`

**2. Read the matching ET reference file** for layout patterns, column structures, and module types:
```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('${CLAUDE_SKILL_DIR}/references/Divi design system JSON/Individual Sections/By Section Type/Divi-5-Launch-Freebie_<Type>_Sections.json','utf8'));
Object.values(d.data).forEach(s => console.log(s.post_title, '|', s.post_content.substring(0,200)));
"
```
Read 2-3 variants to understand the range of layouts available for that type. Use them as structural reference — not verbatim copy.

**3. Brief.** Ask (or extract from prompt): brand, copy/content, aesthetic direction, CTA. No SEO keyword needed for a section.

**4. Generate.** Write `generate-[brand]-[type]-section.js` using the builder (`et_builder_layouts` context):
```js
const json = builder.assemble({
  context: 'et_builder_layouts',   // ← section/library import
  content,                          // ← placeholder-wrapped single section
  title: '[Brand] [Type] Section',
  slug: '[brand]-[type]-section',
});
```
Output: `[brand]-[type]-section.json`

**5. Validate.** Run the validator without `--keyword` or `--meta` (sections have no SEO requirements):
```bash
node ${CLAUDE_SKILL_DIR}/scripts/validate.js [brand]-[type]-section.json
```
Fix all FAILs. The h1 rule does NOT apply to sections — use h2 for the section heading.

**6. Preview + import.** Use `import-to-local` skill's `/preview` endpoint, then import via Divi Library (not page import). Remind the user: **Divi Library → Import → check "Import Presets"**.

---

## Mutate mode

Edit an existing Divi 5 export JSON — change copy, swap colours, or reorder sections — without touching preset IDs, global colour definitions, or structural layout.

### When to use

The user has an exported Divi 5 page (or you just generated one with Stage 0 clone) and wants specific targeted changes: hero copy, accent colour, button label, section copy, etc. **This is the right workflow for ET pack clones** — clone with `et-pages.js`, then mutate the copy and brand colours rather than rebuilding from scratch.

### Mutate workflow

**Step 1 — Ingest.** Run `ingest.js` to produce the three companion artefacts:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/ingest.js <export.json>
# → <name>.tokens.js   (colour/variable/preset label maps)
# → <name>.presets.json (preset subtree for builder + validator)
# → <name>.outline.json (section-by-section structure map)
```

Read `<name>.outline.json` to understand the page structure — section labels, module types, and copy text — before writing the changes spec.

**Step 2 — Write a `changes.json` spec.** Three mutation types are supported:

```json
{
  "texts": [
    { "find": "Transform Your Business", "replace": "IT Support That Never Sleeps" },
    { "find": "Get Started Today",        "replace": "Book a Free Call" }
  ],
  "globalColors": [
    { "label": "Accent Color", "hex": "#FF6B35" }
  ],
  "gcidColors": [
    { "gcid": "gcid-accent", "hex": "#FF6B35" }
  ]
}
```

- `texts` — exact copy swaps. Use the text from the outline. JSON string escaping is handled automatically.
- `globalColors` — patch by ET colour label (from `<name>.tokens.js` `colorId` keys).
- `gcidColors` — patch by gcid slug (use when the label is unknown).

**Step 3 — Apply mutations.**
```bash
node ${CLAUDE_SKILL_DIR}/scripts/mutate.js <export.json> changes.json [output.json]
```

The script:
1. Applies all text replacements to the serialised page content.
2. Patches the `global_colors` array entries for colour changes.
3. Runs a **preservation check** — if any preset ID from the source is missing from the output, it exits 1 and refuses to write. Fix the changes spec, never override this check.

**Step 4 — Validate.** Run the standard validator on the output JSON:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/validate.js <output.json>
```
For a mutated ET pack clone, omit `--keyword` and `--meta` unless the user wants SEO checks.

**Step 5 — Import.** Use the `import-to-local` skill to push the mutated JSON to the local WordPress. Run the live preview or Playwright screenshot to confirm exactly the requested changes and nothing else.

### Preservation contract

The mutator guarantees that **every `modulePreset` ID in the source JSON survives unchanged** in the output. If a mutation accidentally deletes or rewrites a preset reference, the script exits 1 with a diff. Never bypass this — a lost preset ID silently breaks the live render.

---

## Page mode

## Non-negotiable rules

1. **Never hand-write Divi JSON.** Always write a Node generator script that requires the bundled builder: `require('${CLAUDE_SKILL_DIR}/scripts/divi-builder.js')`. The library handles block syntax, escaping, presets, global colours, and assembly. Follow the pattern in [examples/example-page.js](examples/example-page.js).
2. **Always validate before delivering.** Run `node ${CLAUDE_SKILL_DIR}/scripts/validate.js <output.json> --keyword "<primary keyword>" --meta <seo-meta.json>`. Fix every FAIL, and every WARN unless there's a stated reason. Show the user the final report.
3. **Exactly one h1 per page** — the hero headline, via `heading({ level: 'h1' })`. Section headings are h2, card/blurb titles h3. Decorative text (step numbers, eyebrows) uses `text()`, never `heading()`. The builder sets `headingLevel` explicitly on every heading.
4. **Every reused style is a preset.** Register presets via `builder.preset()` and reference them with `preset:` options. Never inline-only styling for repeated elements.
5. **Every image needs descriptive alt text** (the builder throws without it).
6. **Real content only** — no lorem ipsum unless explicitly requested.
7. **Pass the taste layer.** Every page is built against [references/taste.md](references/taste.md) and composed with [references/layout-patterns.md](references/layout-patterns.md). Study the quality bar screenshots [references/floria-top.png](references/floria-top.png) and [references/floria-bottom.png](references/floria-bottom.png) before designing. Two parts are hard gates: **zero em-dashes (`—`) or en-dash separators (`–`) in any visible copy** (the validator FAILs on these — use a hyphen `-`), and the **taste pre-flight checklist** (taste.md §14) must pass before JSON is generated.

## Workflow

### Stage 0 — ET pack clone (default starting point)

**Check for a matching ET template before doing anything else.** The 24 premade pages in `references/Divi design system JSON/Divi-5-Launch-Freebie_Pages.json` are production-ready Divi 5 layouts. Cloning one as a base is faster and structurally sounder than building from scratch.

```bash
# See what's available
node ${CLAUDE_SKILL_DIR}/scripts/et-pages.js list

# Find best match for the brief
node ${CLAUDE_SKILL_DIR}/scripts/et-pages.js match "<page type keyword>"

# Clone to an importable JSON file
node ${CLAUDE_SKILL_DIR}/scripts/et-pages.js clone "<keyword>" [brand]-base-page.json
```

**Available page types** (run `list` for section outlines):
`about`, `contact`, `events`, `feature`, `features`, `gallery`, `home`, `job-listings`, `login`, `portfolio`, `pricing`, `pricing-menu`, `privacy-policy`, `project`, `projects`, `resume`, `service`, `services`, `team`, `terms-of-service`, `blog-module`, `blog-loop-builder`, `shop-module`, `shop-loop-builder`

**Decision tree:**

| Situation | Action |
|---|---|
| A page type from the list matches the brief | Clone it → use as the delivery base, note sections to user |
| Brief combines multiple page types (e.g. services + pricing) | Clone the closest match, note which sections come from the template and which need generating |
| Brief is highly bespoke / no match (`match` returns "No match") | Skip Stage 0, build from scratch in Stage 3 |

**When a match is found:**
1. Run `clone` to produce `[brand]-base-page.json`. This is a complete, importable Divi 5 page.
2. Tell the user: *"Starting from the ET '[Title]' template. It includes: [sections]. I'll customise the copy and branding in Stage 3."*
3. Continue to Stage 1 for the brief (copy, brand, SEO keyword).
4. In Stage 3: use the cloned JSON as the deliverable base. Apply brand mutations (copy, colours, section additions/removals) to it — do NOT generate a new page from scratch. Phase 2's mutator (when available) handles this automatically; until then, describe which sections need client copy replacement and deliver the structural clone.
5. Still run Stage 2 HTML preview and Stage 4 Playwright screenshot — the clone gives structure, but the taste and render gates still apply.

The clone output includes the ET design system presets, global colours, and global variables. The importer remaps preset IDs if they already exist on the target site, so re-importing is safe.

---

### Stage 1 — Brief

**Design-system reuse (check first).** Before choosing an aesthetic, look in the working directory for a `*.tokens.js` file (produced by the `style-variables` skill's `extract-from-export.js` from a Divi 5 export). If one exists, **prefer it over inventing a palette**. If no project tokens file exists, fall back to the **Elegant Themes official design system** at `${CLAUDE_SKILL_DIR}/references/Divi design system JSON/divi-design-system.tokens.js` (25 semantic colour tokens, 123 spacing/type variables) and `divi-presets.tokens.js` (331 named presets — headings, buttons, text, blurbs, sections, rows). Require both and use ET's semantic names (`T.colorRef['Primary Color']`, `P.preset['Filled - Primary']`) so generated pages bind to the standard Divi design system out of the box.: `require()` it and reuse the site's real ids — drop `T.colorRef['<label>']` into colour fields and pass `preset: T.preset['<name>']` so the page binds to the existing global colours, variables and presets. Tell the user you've detected and are reusing `<file>`, and confirm the target-site state: if the export is already imported on the site, reference ids only (do **not** re-register colours via `builder.globalColor()`, which would ship a colliding definition); if it's a fresh site, remind them to import the matching `*.variables.json` (and the original export with **Import Presets** checked) before importing the page. If no tokens file exists, proceed with the aesthetic presets as normal. (To generate tokens from an export, run the `style-variables` skill first.)

**Multi-page scope (check first).** If the brief is broader than one page — "market the features", "hub + spokes", "build out the site", "rank for \<broad term>" — plan the page set *before* building any single page: read [references/content-strategy.md](references/content-strategy.md) to map a hub + spokes structure, assign one primary keyword per page, and define the internal-linking map. Deliver that plan, then run each page through this skill in turn. For a genuinely single-page brief, skip straight to the workflow below.

**Headless/brief mode:** if a complete brief is supplied in the prompt, via slash-command arguments ($ARGUMENTS), or a `brief.json` exists in the working directory, skip all questions and build.

**Interactive mode:** ask via AskUserQuestion in one call:

1. **Brand + offer** — name, what it does, who it's for.
2. **Primary SEO keyword** — the search term this page should rank for (plus optional secondaries and location for local SEO).
3. **Aesthetic direction** — single-select from the presets in `references/aesthetics.md` (Organic Tech, Midnight Luxe, Brutalist Signal, Vapor Clinic, Minimal Editorial).
4. **Sections** — multi-select: Hero, About, Features, Process, Testimonials, Pricing, Stats, FAQ, CTA Band, Contact, Footer.
5. **Primary CTA** — and any brand colours (mapped into the aesthetic's token system).
6. **Motion layer (DiviTheatre)** — single-select: *"Do you have DiviTheatre installed? It adds cinematic animations (fade-up, stagger, parallax, hero-reveal) to any Divi 5 element."* Options: **Yes** (add motion presets), **No but I want it** (note download link in delivery), **No** (static page only). See [references/divi-theatre.md](references/divi-theatre.md) for the full preset catalogue and MOTION dial mapping. **Never emit `data-theatre` attributes without explicit user consent.**

**Then state the Design Read and set the dials** (taste.md §0–§1) before building:
- One line: *"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning toward \<preset>."*
- Three dials, reasoned from the brief: **VARIANCE / MOTION / DENSITY** (landing baseline 7 / 4 / 4; trust-first drops VARIANCE to 3–4, agency pushes to 9).
- Open [references/floria-top.png](references/floria-top.png) and [references/floria-bottom.png](references/floria-bottom.png) — that is the visual tier to aim for (asymmetric hero, image-led sections, editorial type). Divi cannot do GSAP scroll hijacks; use the Divi recipes in [references/layout-patterns.md](references/layout-patterns.md) instead.
- Check the chosen preset against the taste.md guardrails: don't default-reach Vapor Clinic's AI-purple or Organic Tech's warm-craft palette; don't use Inter as a display font or Fraunces/Instrument Serif as a default drama serif.

### Stage 2 — HTML preview (taste gate + approval gate)

Build a complete styled HTML page (`preview-[brand].html`) applying the design system in `references/aesthetics.md`, the layout recipes in [references/layout-patterns.md](references/layout-patterns.md), the SEO copy rules in `references/seo.md`, and the design judgement in [references/taste.md](references/taste.md). Serve it, screenshot it, ask for approval. Iterate until approved. The HTML *is* the design spec — the JSON must match it.

**This is the taste gate.** Before showing the preview for approval, run the **taste pre-flight checklist (taste.md §14)** against the HTML and fix every miss — it is far cheaper to fix taste here than after the JSON exists. In particular: split or left-aligned hero with a real image; zero em-dashes; one locked accent and one radius scale; hero fits the viewport with ≤4 text elements; eyebrow count ≤ ceil(sections÷3); ≥4 different layout families with no 3 consecutive zigzags and **no three-equal icon-blurb cards**; real images with alt; no AI-tell decoration (section-number eyebrows, scroll cues, locale strips, decorative dots, version labels). If the preview looks like a centred Divi demo template, iterate until it reads like the Floria references. Carry the approved HTML's taste decisions straight into the generator.

### Stage 3 — Generate + validate

**Preset-first workflow (recommended).** Run `setup-et-presets.js` once per site to import ET's 272 official presets and write `references/et-preset-registry.json`. Generators then reference presets by name — no custom preset registration, no CSS cache issues, no ID remapping:

```js
const registry = require('./references/et-preset-registry.json');
b.loadPresetRegistry(registry);
const P = {
  hero:   b.presetRef('divi/section', 'Section Preset 1'),
  btnCta: b.presetRef('divi/button',  'Filled - Primary Color'),
  h1:     b.presetRef('divi/heading', 'Heading 1'),
  body:   b.presetRef('divi/text',    'Dark Text'),
};
// When assembling, omit presets: delete layout.presets (or pass empty)
```

For brand-specific presets not in the ET library (custom colors, pill buttons etc.), use the **two-step approach**: `POST /presets/import` first, then `GET /presets` to get the registry, then generate the page without re-sending presets.

**Classic workflow (still valid for quick jobs).** Write `generate-[brand].js` in the user's working directory following [examples/example-page.js](examples/example-page.js), requiring the builder from `${CLAUDE_SKILL_DIR}/scripts/divi-builder.js`: tokens → global colours → presets → sections → `assemble()` → write. **Always write output files to `process.cwd()`**, not `__dirname` — the example uses `__dirname` because it lives inside the skill, but generated scripts run from the user's project directory.
2. Output files:
   - `[brand]-landing-page.json` (`et_builder` context — page import)
   - `[brand]-seo-meta.json` — keyword, title tag (≤60 chars, keyword first), meta description (≤155, with CTA), slug
   - `[brand]-schema.json` — FAQPage JSON-LD generated from the FAQ content, plus Organization/LocalBusiness (paste into Divi > Theme Options > Integration > head)
3. Run the validator with `--keyword` and `--meta`. Fix and re-run until clean — the validator now FAILs on any em-dash/en-dash in copy (taste.md §11).
3a. **Taste gate (required for all pages).** Run the deterministic taste checker on the generated JSON:
    ```bash
    node ${CLAUDE_SKILL_DIR}/scripts/taste-check.js [brand]-landing-page.json
    ```
    Fix every FAIL (em-dash, AI buzzwords in h1/h2) before proceeding. WARNs (verb-starts-h1, equal-length three-card blurbs) should be resolved unless there is a deliberate reason — note the reason in the delivery summary.
3b. **Style consistency gate (required when a designer export is present).** If the user provided an original Divi 5 export (or a `*.tokens.js` was detected in Stage 1), run:
    ```bash
    node ${CLAUDE_SKILL_DIR}/../divi5-style-check/scripts/style-check.js <original-export.json> <generated-page.json>
    ```
    Fix every FAIL before proceeding. WARN-only is acceptable to import. Do not skip this step — a generator bug that produces new preset IDs or off-palette colours will silently survive the validator but break the live render.
4. **Run the live preview** to visually verify the generated JSON in real Divi before delivery. Two options — use whichever fits the situation:
   - **If Local WP is running** (preferred — real Divi render): use the `import-to-local` skill's Step 2.5 (`/preview` endpoint). This renders the page via actual Divi 5 with full presets, colours, animations, and responsive breakpoints. No named page is created.
   - **If Local is not running** (quick offline check): `node ${CLAUDE_SKILL_DIR}/scripts/preview.js [brand]-landing-page.json --open` — approximate HTML rendering, good for copy/structure spot-checks.
   Compare either output against the Stage 2 HTML preview. Fix any content, copy, or structural divergence before delivering. This is the JSON fidelity gate.
5. Confirm the taste gate (`taste-check.js`) still passes on the final JSON — the copy and structure must match the approved, taste-checked HTML.
6. Remind the user: import via Divi Library with **"Import Presets" checked**.

### Stage 4 — Live screenshot comparison (Playwright gate)

After the user imports the page, use Playwright MCP to verify the live render matches the Stage 2 HTML mockup. This catches render-time failures the validator cannot see (WordPress sanitisation, Divi CSS specificity, shortcode token not replaced, preset CSS cache stale).

```
mcp__plugin_playwright_playwright__browser_navigate  →  live page URL
mcp__plugin_playwright_playwright__browser_take_screenshot  →  compare-live.png  (fullPage: true)
```

Then open `preview-[brand].html` (or use the cached `preview-[brand].png` from Stage 2) and compare visually. **Hard FAILs that require a fix before delivery:**

| Issue | Root cause | Fix |
|---|---|---|
| Buttons are default blue/white | `button.decoration.button: dv({ enable: 'on' })` missing in preset OR block | Add `enable: 'on'` to every `b.preset('divi/button', ...)` decoration AND ensure `D.button()` is used (it injects it automatically) |
| Section backgrounds wrong colour | `colorVar()` used in preset background — variable refs produce no CSS | Use raw hex `T.myColor` for `decoration.background` inside `b.preset()` calls |
| Shortcode renders as literal text `[airloop_display id='__AIRLOOP_DISPLAY_ID__']` | Token not replaced — page viewed directly without running the plugin importer | Tell user: go to Airloop > Layout Packs and click Import (not just deploy the JSON file) |
| Grid/content section empty | `codeBlock()` passed `[]` instead of `null` — open/close tags instead of self-closing | Use `D.block('divi/code', attrs, null)` — `null` = self-closing `<!--  /-->` |
| Inline stats/text unstyled | WordPress `wp_kses_post()` strips inline `style=""` on text module output | Replace inline-HTML styling with `numberCounter` modules and `decoration` attrs on `text()` presets |
| Preset colours wrong after re-import | Stale `et-cache/{post_id}/*.css` — Divi CSS regenerated with old preset IDs | `rm -f wp-content/et-cache/{post_id}/*.css` then reload the page to trigger regeneration |

If the live screenshot matches the mockup within acceptable tolerance — correct section order, correct colours, grid rendering — mark Stage 4 passed and deliver.

## SEO requirements (summary — full rules in references/seo.md)

- Primary keyword: front-loaded in the h1, in the first ~100 words, in ≥1 h2, in title tag and slug.
- Secondary keywords: one per section h2 where natural.
- FAQ questions written as real long-tail queries (People Also Ask targets); FAQPage schema generated from the same content.
- Max two font families (Google Fonts cost CWV); no hero sliders/videos by default.
- Descriptive anchor text — never "click here".

## Format essentials (full detail in references/module-reference.md)

- Contexts: `et_builder` (page import) vs `et_builder_layouts` (Divi Library import) — must match destination.
- Nesting: `placeholder → section → row → column → modules`. Modules only inside columns/groups.
- `builderVersion: "5.0.0-public-beta.9.1"` on every block — the builder injects it; bump it in `scripts/divi-builder.js` only.
- Column widths: `flexType` fractions of 24 (`12_24` = 50%, `8_24` = 33%). The builder auto-adds phone stacking.
- Global colours: `builder.globalColor()` returns the `$variable(...)$` reference; escaping is handled by serialisation.
- Responsive: only include breakpoints that differ from desktop.

### CSS generation rules — critical (see `docs/divi5-css-generation-rules.md` for full detail)

**Preset background colors must be raw hex.** Divi generates section/column background CSS via a preset class (`.preset--module--divi-section--{id}`). This generator reads raw hex from preset attrs — variable refs (`$variable(...)$`) produce no CSS. Always use `T.myColor` (raw hex) for `decoration.background` inside `b.preset()` calls. Font/text colors inside presets CAN use variable refs.

**Buttons require the custom styles enable flag.** Without `button.decoration.button: D.dv({ enable: 'on' })` in both the preset and the block, Divi ignores all button background, border, and font styling and falls back to its default blue. The `button()` function in `divi-builder.js` injects this automatically — always define it in presets too.

**Clear CSS cache after import.** `PageImporter.php` calls `ET_Core_PageResource::remove_static_resources()` after preset import — this is required or Divi never generates the preset class CSS for newly imported preset IDs.

**Clear page CSS cache after every import.** Divi generates per-page CSS in `et-cache/{post_id}/et-core-unified-{post_id}.min.css`. If a stale file exists from a previous import (different preset IDs), the new preset classes won't render. After importing, always clear and force regenerate:
```bash
rm -f /path/to/wp-content/et-cache/{post_id}/*.css
curl -s http://site/page-slug > /dev/null   # triggers regeneration
```
Preset CSS is NOT in `et-divi-dynamic-*.css` — always check the `et-core-unified-*.min.css` files.

### Token-aware builder (opt-in)

Load the ET design system tokens to replace raw hex with server-resolved variable refs:

```js
const TOKENS = require('./references/Divi design system JSON/divi-design-system.tokens.js');
const b = D.createBuilder({ tokens: TOKENS });

// ET colour by label → resolves to $variable(...)$ string (Divi resolves server-side)
const white   = b.colorRef('White');                      // gcid-y43rzvjcdl
const overlay = b.colorRef('Background Overlay - Dark'); // gcid-2ihj6tueev

// Brand-specific colours — not in ET design system, registered as custom global colours
const accent = b.globalColor('brand-accent', '#F95E00', 'Brand Accent');
```

Both `colorRef()` and `variableRef()` **throw** if the label is not found — fail fast rather than silently emitting nothing. Available labels are in `divi-design-system.tokens.js`.

### Overlay sections

```js
D.overlaySection({
  image:   { src: 'https://...', parallax: 'off' },
  overlay: { color: b.colorRef('Background Overlay - Dark'), opacity: 0.8, blend: 'multiply' },
  padding: { top: '8vw', bottom: '8vw' },
  adminLabel: 'Hero',
}, rows)
```

Emits a `divi/section` with a two-layer background (image bottom, colour top). All other `section()` options (`theatre`, `preset`, etc.) pass through. The overlay colour, blend mode, and opacity are optional.

## Divi 5 gotchas (hard-won)

These bugs are silent — Divi drops the module or ignores the style with no error. Check them before writing any generator.

| Gotcha | Wrong | Right |
|--------|-------|-------|
| Block naming | `D.block('divi/code', ...)` | `D.code(html)` or `D.block('code', ...)` — builder already adds `divi/` prefix; doubling it produces `wp:divi/divi/code` which Divi silently drops |
| Code module children | `D.block('code', attrs, [])` | `D.block('code', attrs, null)` or `D.code(html)` — `null` = self-closing `<!-- /-->`; `[]` = open+close pair Divi can't render |
| Preset backgrounds | `b.colorVar('coral')` in preset `decoration.background` | Raw hex `T.coral` — `$variable(...)$` refs produce no CSS in Divi's preset CSS generator; only font/text colour fields resolve them |
| Button unlock | preset or inline button without `button: D.dv({ enable: 'on' })` | Every `b.preset('divi/button', ...)` and every `D.button()` call needs `button: D.dv({ enable: 'on' })` — without it Divi ignores all custom button styles and falls back to global default (blue) |
| Inline HTML styles | `D.text({ html: '<div style="font-size:48px">6</div>' })` | Use `D.numberCounter()` — WordPress's `wp_kses_post()` strips all `style=""` attributes from text module HTML on save |
| Placeholder missing | `const content = [hero, marquee].join('\n')` | `const content = D.placeholder([hero, marquee])` — the validator FAILs with `content must start with wp:divi/placeholder` if you join sections as a raw string |
| Multiple h1 headings | Three `D.heading({ level: 'h1' })` calls for a styled title | One `D.heading({ level: 'h1', text: '...' })` — Divi treats each `heading()` call as a separate block; splitting a title across calls creates multiple h1s |
| Keyword phrase broken by preposition | keyword `coffee shop frome` while copy reads `coffee shop in Frome` | Make the keyword itself natural (`coffee shop in Frome`) so it appears verbatim in h1/h2 — the validator substring-matches the keyword case-insensitively, so a mismatching preposition fails it |
| `textTransform` does not render | preset font `D.dv({ textTransform: 'uppercase' })` and lowercase text | Pass the literal text already UPPERCASE — `heading()`/`text()` font decoration drops `textTransform` (only `letterSpacing`, `size`, `weight`, `color` etc. render). Uppercase the source string instead |
| Two-tone / accent-word heading | a second `heading()` for the coloured word (→ multiple h1s) | Inline span in the title: `text: \`PROPER <span style='color:#DBB4EE'>BELTER</span> COFFEE\`` — `htmlContent()` single-quotes attrs so the inline colour survives `wp_kses_post` on headings (it does NOT survive on `text()` modules — headings only) |
| Keyword phrase split by `<br>`/tag | `\`COFFEE SHOP<br>${lav('IN FROME')}\`` | Keep the keyword phrase contiguous with no tag inside it — the validator reads raw h1/h2 text *including* tags, so `<br>`/`<span>` between words breaks the substring match. Wrap the whole phrase in one span instead: `\`${lav('Coffee Shop in Frome')}\`` |
| Buttons stack vertically | two `D.button()` directly in a `column()` | Wrap them in a `divi/group` flex-row: `D.block('group', { module:{ decoration:{ layout:{ desktop:{ value:{ display:'flex', flexDirection:'row', columnGap:'16px', flexWrap:'wrap' } } } } } }, [btnA, btnB])` — columns lay modules out vertically; `group` is the flex container |
| Flex layout / bg-image / asymmetric padding | `column({ padding })` (uniform only) or expecting `flexType` to centre content | Hand-build with `D.block('column', { module:{ decoration }})`: `layout.desktop.value` = `{ display, flexDirection, justifyContent, alignItems, rowGap }`; bg image = `background.desktop.value.image = { url, size:'cover', position:'center center' }`; per-side padding via `spacing.desktop.value.padding` with `syncVertical/Horizontal:'off'`. The `column()`/`row()` helpers don't expose these |
| Placeholder images off-brand | `picsum.photos` (returns random unrelated photos) | Use a keyword source — `https://loremflickr.com/{w}/{h}/{keyword}?lock={n}` (single keyword like `barista`/`cafe`/`coffee`; multi-keyword combos and rare terms 500). Flag stock placeholders for real-photo swap before launch |
| Stale per-page CSS after re-import | re-import over an existing page id, screenshot shows old styling | `rm -f wp-content/et-cache/{post_id}/et-core-unified-*.min.css` then `curl <page-url>` to regenerate — preset CSS lives in `et-core-unified-*.min.css`, NOT `et-divi-dynamic-*.css` |

The validator catches the placeholder, multiple-h1, and keyword-in-h1/h2 bugs — zero FAILs before import.

## Token-first workflow (multi-skill)

If the client has a brand style guide, run the companion skill **`/divi-styleguide-variables`** first (github.com/16wells/divi-styleguide-variables). It converts a token table → Divi 5 `global_colors` + `global_variables` import JSON, importable via Divi Library → Import & Export → Import Global Variables.

The composed workflow:
1. `/divi-styleguide-variables` — paste brand token table → get `Brand_Global-Variables.json` → import into Divi
2. `/divi5-page-generator` — if a `*.tokens.js` file exists in the working directory, Stage 1 prefers it over manually specified colours

**For plugin-shipped layouts** (e.g. Airloop demo pages): colours must still be declared inline in the layout JSON's `global_colors` array so `LayoutPackImporter::register_presets_and_colors()` can inject them at import time. An external variables import file won't be present on a fresh install.

## File map

All paths relative to this skill's directory (`${CLAUDE_SKILL_DIR}` when invoking scripts):

| File | Purpose |
|------|---------|
| [scripts/divi-builder.js](scripts/divi-builder.js) | Generator library — blocks, presets, colours, assembly |
| [scripts/validate.js](scripts/validate.js) | Structural validator + SEO report card |
| [scripts/taste-check.js](scripts/taste-check.js) | Deterministic taste/slop gate — em-dash, AI buzzwords, equal three-card blurbs (Stage 3, step 3a) |
| [scripts/preview.js](scripts/preview.js) | Divi JSON → standalone HTML preview (fidelity gate before import) |
| [examples/example-page.js](examples/example-page.js) | Canonical generator pattern — copy this |
| [references/aesthetics.md](references/aesthetics.md) | 5 aesthetic presets: palettes, fonts, section flows, spacing |
| [references/taste.md](references/taste.md) | Anti-slop design judgement (Design Read, dials, hero/layout/colour discipline, AI-tell bans, taste pre-flight) — adapted from the Taste Skill for Divi 5 |
| [references/layout-patterns.md](references/layout-patterns.md) | Positive layout recipes (split hero, image gallery, bento, CTA band) + Floria quality bar |
| [references/floria-top.png](references/floria-top.png) | Taste Skill reference — hero, gallery, process, bento (visual target) |
| [references/floria-bottom.png](references/floria-bottom.png) | Taste Skill reference — testimonials, photo CTA, footer (visual target) |
| [references/content-strategy.md](references/content-strategy.md) | Multi-page planning: hub + spokes, intent mapping, prioritisation, internal linking (the layer above single-page generation) |
| [references/seo.md](references/seo.md) | Full SEO rules: copy, meta, schema, performance |
| [references/module-reference.md](references/module-reference.md) | Raw attribute patterns for overrides the builder doesn't cover |
| [references/divi-theatre.md](references/divi-theatre.md) | Optional DiviTheatre motion presets
| `references/Divi design system JSON/divi-design-system.tokens.js` | ET official colour + variable tokens (25 colours, 123 variables) — fallback design system |
| `references/Divi design system JSON/divi-presets.tokens.js` | ET official 331 module presets (headings, buttons, text, blurbs, sections, rows) |
| `references/Divi design system JSON/Individual Sections/By Section Type/` | 304 ET reference sections across 47 types — structural templates for section mode | (Theatre.js) — consent gate, preset catalogue, MOTION dial mapping |

## Optional reference materials (use if present in the working project)

- `divi5-json-key-learnings.md` — format deep-dive
- `Meaningful Wellbeing.json` — real-world export fixture
- `Divi-5-Design-System/` — official preset/design-variable examples
