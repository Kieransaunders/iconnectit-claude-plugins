# Divi 5 Tools

Claude Code skills for generating production-ready Divi 5 pages as importable JSON — SEO-optimised, preset-driven, validated before delivery.

## Skills

| Skill | What it does |
|-------|-------------|
| `/divi5-tools:divi5-page-generator` | Generate a complete Divi 5 page from a brief — full SEO, presets, HTML preview gate, validated JSON |
| `/divi5-tools:divi5-extract-style` | Extract the design system from an existing Divi export OR convert brand guidelines into Divi 5 Global Variables |
| `/divi5-tools:divi5-style-check` | **QA gate** — compare a generated page JSON against the original designer export to verify preset, colour, and font inheritance before import |
| `/divi5-tools:design-review` | Audit any Divi 5 export: structure, SEO, design checklist. Also **spec compliance mode**: compare an imported page against the original brief or mockup |
| `/divi5-tools:import-to-local` | Import a generated page into a running Local WP site — draft, preview, publish on accept |

---

## Full workflow with QA gates

Every generated page passes through two QA gates before delivery:

```
/divi5-tools:divi5-extract-style  →  ClientBrand.tokens.js
         ↓
/divi5-tools:divi5-page-generator →  new-page.json
         ↓
/divi5-tools:divi5-style-check  original-export.json  new-page.json
         ↓  (must be CONSISTENT before proceeding)
/divi5-tools:import-to-local    →  live WordPress page
         ↓
Export from Divi  →  exported-page.json
         ↓
/divi5-tools:design-review  exported-page.json  --spec brief.md
         ↓  (must be COMPLIANT before delivery)
✓ Deliver
```

**Gate 1 — `/divi5-style-check`** (pre-import, JSON level): verifies the generated page actually reuses the designer's preset IDs, palette colours, and fonts — not new IDs the generator invented. Exits CONSISTENT or INCONSISTENT.

**Gate 2 — `/design-review --spec`** (post-import, content level): verifies the live page delivers what the brief specified — correct sections, CTAs, copy, section order. Exits COMPLIANT or NON-COMPLIANT.

Both gates are required when a designer export and brief are present. Skipping them risks importing a page that silently diverges from the design system or misses required content.

---

## Which workflow do I need?

### "I have an existing Divi page / design and want new pages in the same style"

The designer exports their homepage (or any page) as Divi JSON, then:

```
Step 1 — extract the design system
/divi5-tools:divi5-extract-style homepage-export.json

  Outputs: ClientBrand.tokens.js  (preset IDs + colour refs)
           ClientBrand.variables.json  (importable global variables for a fresh site)

Step 2 — generate new pages using those exact presets
/divi5-tools:divi5-page-generator
  "Build an About Us page for [brand] — use ./ClientBrand.tokens.js for the design system"

  The generator reads the tokens file and references the designer's existing preset IDs
  instead of creating new ones — pages inherit the live site design system automatically.

Step 3 — verify style inheritance before import (required)
/divi5-tools:divi5-style-check homepage-export.json about-us-page.json

  Must return CONSISTENT. Fix any FAILs in the generator script and regenerate.

Step 4 — import and verify spec compliance
/divi5-tools:import-to-local about-us-page.json
  → export the live page from Divi
/divi5-tools:design-review exported-about-us.json --spec brief.md
```

**On an existing site** (the designer's export is already imported there): nothing extra to import — the page binds to presets that already exist on the site.

**On a fresh site**: import `ClientBrand.variables.json` first (Divi Library → Import Global Variables), then import the designer's original export with "Import Presets" checked, then import the generated pages.

---

### "I need a style guide and pages generated from scratch"

No existing Divi design. Start from a brand brief or design token table:

```
Step 1 — convert brand guidelines into Divi 5 global variables (optional but recommended)
/divi5-tools:divi5-extract-style
  "Convert these brand tokens into Divi 5 variables: Primary #1A2744, Accent #F97316,
   heading font Space Grotesk, body Inter, button radius 6px"

  Outputs: Brand_Global-Variables.json  — import via Divi Library → Import Global Variables

Step 2 — generate the page
/divi5-tools:divi5-page-generator
  "Build a landing page for [brand], keyword [keyword], sections: Hero, Features, CTA"

  The skill picks up the tokens file automatically if present in the working directory.

Step 3 — spec compliance check after import
/divi5-tools:design-review generated-page.json --spec brief.md
```

No designer export = no style-check gate needed (there's nothing to compare against).

---

### "I just want a page with no existing design"

Skip Step 1 and the style-check gate entirely:

```
/divi5-tools:divi5-page-generator
  "Build a landing page for Westcountry Pet Rescue, keyword 'adopt a rescue dog Devon',
   sections: Hero, Stats, Directory, How It Works, CTA, Footer"
```

The skill will ask for brand colours and aesthetic direction, build an HTML preview for approval, then generate validated JSON with fresh presets. Run `/design-review --spec` post-import if a written brief exists.

---

## Output files

| File | Purpose |
|------|---------|
| `[brand]-page.json` | Import via Divi Library (tick "Import Presets") or via plugin Layout Pack importer |
| `[brand]-seo-meta.json` | Title tag, meta description, slug — paste into Yoast / RankMath |
| `[brand]-schema.json` | FAQPage + Organization JSON-LD — paste into Divi Theme Options → Integration → head |
| `[brand].tokens.js` | Reusable token map (preset IDs, colour refs) for generating additional pages |
| `[brand].variables.json` | Importable Divi Global Variables for seeding a fresh site |

## User flow diagram

See [docs/user-flow.md](docs/user-flow.md) for a full Mermaid flowchart covering all three starting points (existing design / brand guide / from scratch), both QA gates, and fix loops.

## Installation

### The Claude Code plugin

```
/plugin marketplace add Kieransaunders/iconnectit-claude-plugins
/plugin install divi5-tools@iconnectit-claude-plugins
```

Restart Claude Code and the skills are available as `/divi5-tools:<skill>`. Node.js must be on your PATH — the builder and validator scripts use it.

### The WordPress importer plugin

`import-to-local` pushes pages into WordPress through the **Divi Tools Importer** plugin. Build the installable zip any time:

```
/divi5-tools:help
```

That writes `divi-tools-importer.zip` to `~/Downloads`. In WordPress: **Plugins → Add New → Upload Plugin → Activate**, then copy your site URL and API key from **Settings → Divi Tools Importer**. _(Coming soon to the WordPress.org plugin directory — then it's a one-click install.)_

---

## For developers

See [DEVELOPMENT.md](DEVELOPMENT.md) for project structure, environment setup, build/deploy flows, and current development state.
