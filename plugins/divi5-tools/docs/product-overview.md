# Divi 5 AI Page Generator — Technical Overview & Product Opportunity

*Written 2026-06-21. Based on the landing-page skill, divi-tools-importer plugin, and learnings from the Rub You Well build.*

---

## What It Is

An AI-powered Divi 5 page generator that takes a brand brief and produces a production-ready, importable Divi 5 page — complete with correct section structure, typography, brand presets, SEO metadata, and FAQ schema — in a single conversational session.

The output is a `.json` file that can be imported directly into any Divi 5 WordPress site via the companion plugin, rendering pixel-accurately on the first page load.

---

## System Architecture

The system has three layers that work in sequence:

```
BRIEF → [AI Skill Layer] → JSON → [Import Plugin] → [Divi 5 WordPress Site]
```

### Layer 1 — The AI Skill (`skills/landing-page/`)

The Claude skill that orchestrates the entire generation pipeline. It is a set of instructions, constraints, and referenced assets that guides the AI through a structured workflow.

**Key stages:**
1. **Brief** — extracts brand, keyword, aesthetic, sections, CTA from conversation
2. **HTML preview** — builds a full styled HTML mock served locally; user approves before any Divi JSON is generated
3. **Generation** — writes a Node.js generator script that uses the builder library
4. **Validation** — runs an automated validator; must pass before delivery
5. **Import** — pushes JSON to the live WordPress site via the REST API

**Taste system** (`references/taste.md`, `references/aesthetics.md`):
Five pre-built aesthetic palettes (Organic Tech, Midnight Luxe, Brutalist Signal, Vapor Clinic, Minimal Editorial) with explicit guardrails — typography rules, layout dials (VARIANCE / MOTION / DENSITY), anti-patterns, and a pre-flight checklist. The AI is trained to self-check against the Floria reference screenshots before delivery.

**Design system integration** (`references/Divi design system JSON/`):
ET's official design system is bundled — 272 named presets, 331 named preset tokens, global variables, and theme-builder templates. The generator can reference these by name rather than hardcoding IDs, making outputs portable across any site that has the standard Divi design system installed.

---

### Layer 2 — The Builder Library (`scripts/divi-builder.js`)

A 784-line Node.js module that is the technical core of the system. It abstracts Divi 5's internal block JSON format behind a clean API.

**What it handles:**
- Block serialisation — generates valid `<!-- wp:divi/section {...} -->` comment blocks with correct JSON escaping
- Responsive breakpoints — automatically generates `phone` and `phoneWide` variants for column widths, wrapping, padding
- Preset system — `b.preset()` to define, `b.presetRef()` to reference from a pre-imported registry, `applyPreset()` to merge preset attrs as inline base
- Global colours — `b.globalColor()` returns `$variable(...)$` refs; `b.colorRef()` / `b.variableRef()` resolve ET design system tokens
- Page assembly — `b.assemble()` wraps everything in the correct `et_builder` context envelope with preset, global_colors, and global_variables payloads
- DiviTheatre motion — `data-theatre` attributes for cinematic animations (optional, requires plugin)

**Module API (illustrative):**
```js
const D = require('./scripts/divi-builder.js');
const b = D.createBuilder({ tokens: TOKENS });

D.section({ preset: P.secCream, padding: { top: '90px', bottom: '90px' } }, [
  D.row({ structure: 'equal-columns_2', maxWidth: '1200px' }, [
    D.column({ flexType: '12_24' }, [
      D.heading({ text: 'Hero headline', level: 'h1', preset: P.heroH1 }),
      D.button({ text: 'Book Now', url: '#book', preset: P.btnPrimary }),
    ]),
    D.column({ flexType: '12_24' }, [
      D.image({ src: '...', alt: '...' }),
    ]),
  ]),
]);
```

---

### Layer 3 — The Import Plugin (`plugin/divi-tools-importer/`)

A WordPress REST API plugin that bridges the AI output to a live Divi 5 site. It handles the non-trivial parts of pushing JSON into Divi's internal data model correctly.

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/wp-json/divi-tools/v1/import` | Import page (layout + SEO + publish flag) |
| GET | `/wp-json/divi-tools/v1/export?slug=<slug>` | Export page with presets + global colors |
| POST | `/wp-json/divi-tools/v1/presets/import` | Import a preset pack independently |
| GET | `/wp-json/divi-tools/v1/presets` | List all presets as name→id map |

**Key implementation details:**
- **Direct DB write** — bypasses `wp_kses_post()` and `balanceTags()` which corrupt block comment delimiters containing JSON. Uses `$wpdb->update()` directly.
- **Preset import** — calls Divi's internal `GlobalPreset::process_presets_for_import()` to get stable IDs, then `save_data()` to trigger CSS regeneration
- **Global colour import** — calls `GlobalData::set_global_colors()` to register `gcid-*` colour slots resolvable by `$variable(...)$` refs
- **CSS cache clearing** — after every import, automatically deletes `et-cache/{post_id}/*.css` so stale preset class CSS is regenerated on next page load (hard-won lesson: Divi's own cache-clear API does NOT clear per-page CSS)
- **SEO writing** — detects and writes to Yoast or RankMath if present
- **Auth** — `X-Divi-Tools-Key` header only; no query param (prevents access log leaks)

---

### Layer 4 — The Validator (`scripts/validate.js`)

A 418-line automated quality gate that runs before any JSON is delivered. Catches structural, SEO, and aesthetic issues that would silently fail in Divi.

**Checks (selected):**
- Exactly one `h1` per page
- Primary keyword present in h1, title tag, first 100 words, and ≥1 h2
- Title tag ≤60 chars, meta description ≤155 chars
- Zero em-dashes or en-dashes in visible copy
- No raw hex in non-background preset paths (ET token enforcement)
- Preset-first mode detection — skips ID checks when presets are pre-imported
- `builderVersion` present on every block
- Correct `et_builder` context

---

## Critical Technical Learnings

These are non-obvious behaviours of Divi 5 discovered during real import/render cycles:

1. **Preset background CSS requires raw hex** — `$variable()$` refs in `decoration.background` inside preset definitions produce no CSS. Divi's preset class generator only reads raw hex. Font/text colors inside presets can use variable refs.

2. **Button custom styles require an enable toggle** — `button.decoration.button.desktop.value.enable: 'on'` must be present or Divi ignores all background, border, and font styling and falls back to default blue.

3. **Preset CSS lives in `et-core-unified-{id}.min.css`** — NOT in `et-divi-dynamic-{id}.css`. The dynamic file contains inline/computed CSS only. This was the source of hours of debugging.

4. **Per-page CSS cache is not cleared by Divi's global cache API** — `ET_Core_PageResource::remove_static_resources()` clears the builder-level cache but not `et-cache/{post_id}/`. The plugin now handles this automatically.

5. **Preset-first workflow eliminates ID drift** — importing presets separately before the page gives stable IDs. Classic import-everything creates new IDs on every run, causing accumulation of hundreds of orphan presets.

---

## The Preset-First Workflow

The recommended production workflow for brand-specific pages:

```
Step 1: generate-brand-presets.js
  → POST /presets/import  (registers brand colors, button shapes, typography)
  → GET  /presets         (fetch name→id registry)
  → write brand-registry.json

Step 2: generate-brand-page.js
  → loadPresetRegistry(registry)
  → presetRef('divi/section', 'Brand Section – Cream')
  → assemble() + delete layout.presets
  → write brand-landing-page.json

Step 3: POST /import
  → Plugin imports content only (no presets re-sent)
  → Clears per-page CSS cache automatically
  → Page loads with correct CSS on first visit
```

---

## Product Opportunity

### What the product would be

**"Divi AI" — a managed AI page generator for Divi 5 agencies and freelancers.**

An agency that builds Divi sites for clients could use this as a white-label service:
- Give it a brief → get a polished, importable landing page in minutes
- Designs match the client's brand (custom preset pack)
- SEO-ready out of the box (metadata, schema, keyword placement)
- Import directly to any site via the companion plugin

### Possible product shapes

#### A. SaaS web app
A web UI where users fill in a brief form (brand, keyword, aesthetic, sections, CTA). Backend runs the Claude skill + builder, streams the HTML preview, accepts approval, generates JSON, and pushes to the connected WordPress site via the plugin. 

**Revenue:** subscription (e.g. £49/mo for 5 pages/month, £99/mo for unlimited).

#### B. WordPress plugin — "Divi AI Pages"
Install and activate on any Divi 5 site. A Divi admin panel screen with a brief form. The plugin calls a cloud API (Claude + skill + builder hosted by you) and imports the result directly, no manual JSON handling.

**Revenue:** plugin licence (e.g. £99/year/site, or tiered by page count). Marketable on Elegant Themes marketplace, Envato, own site.

#### C. Agency tool (internal or white-label)
A CLI or dashboard tool for a specific agency. Not for general sale. Reduces page-build time from days to hours. Competitive advantage.

#### D. Claude.ai skill / MCP server
Package the builder and plugin as an MCP server so any Claude conversation can call `generate_divi_page(brief)` and `import_to_site(json, site_url, key)`. Distribute via the Claude MCP marketplace.

---

### What needs to be built to productise

| Component | Current state | What's needed |
|-----------|--------------|---------------|
| Builder library | ✅ Complete, tested | Package as npm module, version it |
| Validator | ✅ Working | Expose as API endpoint or npm |
| Import plugin | ✅ Working REST API | Add multi-site support, licence gating, usage tracking |
| AI skill/prompt | ✅ Working in Claude Code | Wrap as an API call (Claude API + system prompt) |
| Preset management | ✅ Preset-first workflow | Add preset deduplication, named packs, version control |
| HTML preview | ✅ Local file | Move to a web renderer (iframe with hosted CSS) |
| Brief UI | ❌ None | Form UI (React or plain HTML) |
| Auth / multi-user | ❌ None | User accounts, site connections, API key management |
| Billing | ❌ None | Stripe subscription or per-page credits |
| Site connection | ❌ Manual key | OAuth-style "connect your site" flow in the plugin |
| Image sourcing | Partial (Unsplash URLs) | Unsplash / Pexels API integration, client asset upload |

### Fastest path to an MVP

1. **Expose the skill as a Claude API call** — take the SKILL.md system prompt, wrap it in a Claude API conversation, add a JSON output mode. ~1 week.
2. **Build a minimal brief form** — single HTML page with 6 fields (brand, keyword, aesthetic dropdown, sections checkboxes, CTA, colours). Submits to a server that runs the Claude call. ~1 week.
3. **Return the import JSON + a one-click install link** for the plugin. User installs the plugin, pastes their site URL, clicks import. ~3 days.
4. **Add payment gate** — Stripe Checkout before generation. £25/page or £49/mo. ~1 week.

Total: ~1 month to a chargeable MVP. No AI infrastructure to maintain — all via Claude API.

### Differentiation vs existing page builders / AI tools

| Capability | This system | Framer AI | Divi AI (if it existed) | Generic AI |
|------------|-------------|-----------|------------------------|------------|
| Outputs real Divi 5 JSON | ✅ | ❌ | — | ❌ |
| Works with existing Divi site | ✅ | ❌ (separate platform) | — | ❌ |
| Preserves brand presets | ✅ | partial | — | ❌ |
| SEO validated | ✅ | basic | — | ❌ |
| Import preserves CSS fidelity | ✅ (after solving cache issues) | N/A | — | N/A |
| Taste/aesthetic system | ✅ (5 palettes + guardrails) | basic | — | ❌ |
| FAQPage schema output | ✅ | ❌ | — | sometimes |

The key moat: **the technical knowledge of Divi 5's internal format** (preset-first workflow, CSS cache clearing, enable toggle, raw hex requirement, block comment syntax). This took weeks of reverse engineering to get right. Any competitor starting from scratch faces the same learning curve.

---

## Open Questions Before Building

1. **Market size** — how many agencies/freelancers use Divi 5 and would pay for AI page generation? ET claims 1M+ Divi users; Divi 5 is still in public beta as of mid-2026.
2. **ET relationship** — would Elegant Themes see this as competitive or complementary? A partnership/listing on their marketplace would be the fastest distribution channel.
3. **Claude API cost per page** — a full page generation including HTML preview, iteration, and JSON output likely uses 50k–150k tokens. At Claude Sonnet pricing (~$3/M input, $15/M output) that's roughly $0.50–$2.00 per page. Needs to be priced accordingly.
4. **Preset portability** — the preset-first workflow requires the plugin to be installed. Is there a no-plugin option (e.g. export as a Divi Layout JSON with presets bundled)? Yes — the classic workflow still works, just with the CSS cache caveat.
5. **Divi 5 stability** — block format is versioned (`builderVersion: "5.0.0-public-beta.9.1"`). Breaking changes in the format would require builder updates. Risk mitigated by the builder abstraction layer.
