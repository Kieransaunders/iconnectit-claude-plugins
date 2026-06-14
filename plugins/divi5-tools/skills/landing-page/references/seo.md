# SEO Rules for Generated Landing Pages

## Brief inputs

Every brief must capture: primary keyword, 2–3 secondary keywords, search intent (transactional / commercial / informational), and location (if local SEO applies). If missing, ask — or in headless mode, derive from the offer and audience.

## Heading semantics (enforced by validator)

- Exactly **one h1** — the hero headline, primary keyword front-loaded where natural.
- Section headings = **h2**, one secondary keyword each where it reads naturally.
- Card/blurb titles = **h3**. Never skip levels (h2 → h4 fails the outline check).
- Decorative elements (step numbers "01", eyebrows, stat figures) are **text modules**, never headings.

## Copy rules

- Primary keyword in: h1, first ~100 words of body copy, ≥1 h2, title tag, meta description, slug.
- Write benefit-led, specific copy. Ban superlative soup ("world-class", "cutting-edge") unless backed by a number or fact.
- Body line length ≤75 chars (maxWidth 700–800px on text rows); ≥16px body on mobile.
- Anchor text describes the destination ("Book a free consultation"), never "click here" / "learn more" alone.
- FAQ questions = real long-tail queries phrased as users search them ("How much does X cost in the UK?"). These target People Also Ask and feed FAQPage schema.

## Companion artefacts (the layout JSON cannot carry page meta)

### `[brand]-seo-meta.json`
```json
{
  "keyword": "primary keyword",
  "title": "Keyword First | Benefit — Brand (≤60 chars)",
  "description": "≤155 chars, includes keyword and a CTA.",
  "slug": "keyword-slug"
}
```
User applies via Yoast/RankMath — or the Local WP add-on writes these to post meta via WP-CLI.

### `[brand]-schema.json`
JSON-LD for Divi > Theme Options > Integration > head:
- **FAQPage** — generated from the exact FAQ accordion content (must match, or rich results are at risk).
- **Organization** or **LocalBusiness** (with NAP + geo when location given).
- **BreadcrumbList** if the page sits in a hierarchy.

## Local SEO variant (when location is given)

- Location in h1 or title tag, and in ≥1 h2.
- NAP (name, address, phone) in the footer as crawlable text.
- Map module in Contact section; LocalBusiness schema with geo coordinates.

## Performance (Core Web Vitals = ranking input)

- Max **two** Google Font families, ≤3 weights each.
- No sliders or autoplay video in the hero by default — static hero, fast LCP.
- Images: real dimensions, descriptive file names, alt text always (builder enforces).
- Prefer system-font fallbacks in body where the aesthetic allows.

## Validator mapping

`validate.js` checks: single h1, no outline skips, alt text, keyword in h1/h2/opening copy (`--keyword`), title/description lengths (`--meta`). Everything above that's mechanical is enforced; the copy rules are your job during generation.
