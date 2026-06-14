# Divi 5 Tools

Claude plugin for generating production-ready Divi 5 landing pages as importable JSON.

## What it does

- Generates complete Divi 5 layouts (`et_builder` / `et_builder_layouts` contexts) via a Node builder library — no hand-written escaped JSON
- SEO-optimised by design: enforced single h1, clean heading outline, keyword placement, alt text, companion title/meta/slug and FAQPage schema artefacts
- Deterministic validation with an SEO report card before anything is delivered
- Five aesthetic presets (Organic Tech, Midnight Luxe, Brutalist Signal, Vapor Clinic, Minimal Editorial) with full token systems
- HTML preview approval gate before JSON generation
- One-command import into Local (localwp.com) sites: draft-per-slug, preset/global-colour import via Divi 5 internals, browser preview, publish only on explicit accept

## Usage

Four skills:

    /divi5-tools:landing-page <brief>      Generate an SEO-optimised Divi 5 landing page (headless with a full brief, guided without)
    /divi5-tools:design-review <file.json> Audit any Divi 5 export: structure, SEO report card, design checklist
    /divi5-tools:style-variables <guide>   Convert brand guidelines/design tokens into importable Divi 5 Global Variables JSON
    /divi5-tools:import-to-local <file.json> Import a generated page into a running Local WP site as a draft, preview it, publish on accept

## Output

- `[brand]-landing-page.json` — import via Divi Library (tick "Import Presets")
- `[brand]-seo-meta.json` — title tag, meta description, slug for Yoast/RankMath
- `[brand]-schema.json` — FAQPage + Organization JSON-LD for Theme Options > Integration

## Requirements

Node.js available in the working environment (used by the bundled builder and validator scripts).
