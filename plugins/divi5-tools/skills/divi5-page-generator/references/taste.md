# Taste — Anti-Slop Design Judgement for Divi 5

> Ported and adapted from the Taste Skill (`design-taste-frontend`, MIT, tasteskill.dev).
> The original targets React/Next/Tailwind. This file translates its *design intent* into
> Divi 5 builder + JSON terms. The validator checks structure and SEO; **this file is the
> taste layer the validator cannot see.** Used by both the `landing-page` and `design-review` skills.

The rule is always: **read the brief first, then pull only what fits.** None of this fires
automatically. Most AI-built pages look templated because the model jumps to a default look
instead of reading the room.

---

## 0. Design Read (before any HTML/JSON)

State one line before building:

> **"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning toward \<aesthetic preset>."**

Signals to read: page kind (SaaS / agency / local service / portfolio / editorial); vibe words
the client used ("minimal", "premium", "trust-first", "playful"); reference URLs or brands;
audience (B2B buyer vs design-conscious consumer vs someone scanning on a phone); existing brand
assets (logo, colour, type); quiet constraints (accessibility, public-sector, regulated — these
**override** aesthetic preference).

If the brief is genuinely ambiguous, ask **one** question, not a dump. If you can infer
confidently, declare the read and proceed.

### Anti-default discipline (the LLM tells to design *past*)
Do not default-reach for: AI purple/violet glow gradients, centred hero on a dark mesh, three
equal feature cards, glassmorphism on everything, `Inter` body + near-black, warm
beige+brass+espresso "artisan" palettes. These are the defaults every AI ships. Reach past them
deliberately based on the read.

> **Note on the bundled presets (`references/aesthetics.md`):** two of them lead with these exact
> tells — **Vapor Clinic's** Plasma `#7B61FF` is the banned AI-purple, and **Organic Tech's**
> cream+clay+charcoal is the banned premium-consumer warm-craft family. They are fine *when the
> brief genuinely calls for them*, but never as a default reach. Don't pick Vapor Clinic just
> because the brief says "tech", or Organic Tech just because it says "wellness".

---

## 1. The three dials → Divi mechanics

After the read, set three dials (1–10). They drive every layout, motion and spacing decision.

| Dial | Low (1–3) | High (8–10) | Divi 5 lever |
|---|---|---|---|
| **VARIANCE** | symmetric, centred, equal columns | asymmetric splits, offset columns, large empty zones | column `flexType` ratios (`16_24`/`8_24` not always `12_24`), row `maxWidth`, off-centre `moduleAlignment` |
| **MOTION** | static, hover only | scroll reveal, sticky | Divi animation presets + sticky options — **keep restrained**; Divi motion is limited, half-built motion is worse than none. **Optional:** when DiviTheatre is installed (user-confirmed), map this dial to real Theatre.js presets via [divi-theatre.md](divi-theatre.md) |
| **DENSITY** | airy, big section padding | tight, hairline dividers | section padding (`em`), row `gap`, `maxWidth` |

Sensible landing-page baseline: **VARIANCE 7 / MOTION 4 / DENSITY 4**. Trust-first / public-sector:
drop VARIANCE to 3–4. Agency/creative: push VARIANCE to 9.

---

## 2. Typography (Divi heading + text modules)

- **Hierarchy by weight + colour, not just raw scale.** Hero h1 noticeably larger *and* heavier
  than h2 than body (h1 ≈ 3–4× body). One h1 per page; sections h2; card titles h3; no skipped levels.
  Decorative text (step numbers, eyebrows) is a `text()` module, never a `heading()`.
- **Max two font families.** Body 16–18px desktop, ≥16px phone, line-height 1.7–1.8.
  Phone heading sizes ~35% smaller than desktop (set the phone breakpoint explicitly).
- **`Inter` as the default body font is discouraged.** It is the single most-tested AI tell.
  Acceptable when the brief asks for neutral/standard/Linear-style, or it's public-sector/accessibility-first.
  Otherwise prefer Geist, Outfit, Plus Jakarta Sans, Satoshi, Space Grotesk, Sora.
- **Serif discipline.** Serif only for genuinely editorial / luxury / heritage briefs, and never
  as "this feels creative". **`Fraunces` and `Instrument Serif` are banned as defaults** (the two
  LLM-favourite display serifs — note Vapor Clinic ships Instrument Serif Italic, Organic Tech
  ships Cormorant; only keep them if the brand justifies it). To emphasise a word in a headline,
  use italic/bold of the *same* family — never inject a random serif word into a sans headline.
- **Eyebrow restraint (the #1 violated rule).** An eyebrow is the small uppercase wide-tracking
  label above a headline. **Max one eyebrow per three sections** (hero counts as one). Most sections
  need none — the headline alone is enough. Do not put an eyebrow above every section header.

---

## 3. Colour (global colours + presets)

- **Max one accent, locked for the whole page.** Define it as a `builder.globalColor()` and use the
  `$variable()$` reference everywhere. A warm-grey site does not get a blue CTA in section 7.
  Saturation under ~80% unless the brand is genuinely vivid.
- **No pure black text** (`#000`) — floor `#1A1A1A`; body on light `#444`–`#666`. **No pure white
  body on dark** — body `#BBB`–`#CCC`, `#FFF` for headings only.
- **No AI-purple glow / neon gradients** as default. Neutral base (zinc/slate/stone equivalents) +
  one high-contrast accent.
- **Theme alternation is fine *as a locked composition*.** Divi flows that go dark hero → light
  about → dark footer are allowed — that is a deliberate "colour-block" rhythm, not the banned
  random mid-page inversion — **provided the accent stays identical across every section and every
  block keeps WCAG contrast.** What's broken is a single unexplained section flipping theme, or the
  accent drifting between sections.
- **Shape lock.** Pick one corner-radius scale and hold it (all-sharp, all-soft ~12–16px, or a
  documented rule like "buttons pill, cards 16px, inputs 8px"). Round buttons in a square layout is broken.

---

## 4. Hero discipline (hard rules)

- **Hero fits the first viewport.** Headline ≤ 2 lines desktop. Subtext ≤ 20 words AND ≤ 4 lines.
  Primary CTA visible without scroll. If copy overflows, cut copy or drop font scale — never let
  the CTA fall below the fold.
- **Plan font size and asset size together.** A 4-line hero headline is a font-size error, not a
  copy-length error. Default hero heading range is moderate, not `text-8xl`-equivalent giant.
- **Hero top padding cap** ≈ 6em desktop. More and the content floats halfway down and reads as a bug.
- **Max 4 text elements in the hero:** (1) eyebrow OR brand strip OR neither, (2) headline,
  (3) subtext, (4) CTAs (1 primary + max 1 secondary). **Banned in the hero:** trust micro-strip
  ("Used by teams at…"), pricing teaser, feature bullet list, avatar social-proof row, tiny tagline
  under the CTAs. All of those move to dedicated sections below.
- **"Trusted by" logo wall lives UNDER the hero**, never inside it, and uses real logo marks
  (or a generated SVG monogram for invented brands), not plain text wordmarks, and **no category
  label under each logo**.

---

## 5. Layout diversification (rows, columns, sections)

- **Anti-centre bias** when VARIANCE > 4: prefer split (50/50), left-content/right-asset, or
  asymmetric whitespace over a centred stack. Centred is fine for editorial/manifesto/launch heroes.
- **No three equal feature cards.** The generic 3-identical-column feature row is the most common
  tell. Use a 2-column zig-zag, an asymmetric grid, or grouped tiles instead.
- **Section-layout-repetition ban.** A layout family appears at most once. An 8-section page uses at
  least **4 different layout families**. "Selected work" must not look like "What we do".
- **Zigzag cap.** Max 2 consecutive image+text split sections. The 3rd in a row is a fail — break
  it with a full-width band, a vertical-stack section, or a different family.
- **Split-header ban.** "Big left headline + small right explainer paragraph" as a section header
  is banned as default. Stack headline over body (`maxWidth` ~65ch) instead. Use the split only when
  the right column carries a real visual/interactive element.
- **Tile grids: exact cell count, real background variety.** N items → N cells, no empty filler
  tile. At least 2–3 cells in any multi-cell grid get real visual variation (image, tasteful
  gradient — not AI-purple, tint), never all text-on-same-bg cards.
- **Spacing rhythm.** Hero padding ~7–8em desktop / ~4em phone; content sections ~5–7em / ~3.5–4em.
  Text rows constrained ~700–800px `maxWidth`; card rows ≤ ~1200px. Consistent column gaps (~30px).
  Cards earn their elevation: background contrast vs section, radius, ~2em internal padding — otherwise
  group with a `border-t`/divider or whitespace instead of a card.

---

## 6. Responsive (mandatory, Divi breakpoints)

- Rows wrap on `phone`/`phoneWide` (`flexWrap: wrap`).
- Non-full-width columns become `flexType: 24_24` on `phone`/`phoneWide`.
- Section padding reduces ~40% on phone.
- Only include breakpoints that differ from desktop.
- Declare the mobile collapse per section — never assume "it'll just work".

---

## 7. Buttons, components, states

- **Exactly two button styles** (primary filled, ghost/outline), inverted correctly on accent
  backgrounds. **Button text must be readable against its fill** (no white-on-white; WCAG AA 4.5:1
  body, 3:1 large). Ghost buttons over photos need a scrim or stroke.
- **CTA label fits one line** at desktop (≤ 3 words for primary, ideally 1–2). A wrapping CTA is broken.
- **No duplicate CTA intent.** "Get in touch" + "Let's talk" + "Start a project" on the same page =
  one intent, three labels. Pick one label and use it in nav, hero and footer.
- **Forms:** label *above* input, helper/error text present, never placeholder-as-label. Inputs,
  placeholders, focus rings and labels all pass AA contrast against the section.
- Blurb/icon cards: icon in accent, bold title, muted body. `adminLabel` set on every section.

---

## 8. Content density and copy

- Per section default: short headline (≤ 8 words) + short sub-paragraph (≤ 25 words) + one asset
  OR one CTA. More must be justified by the section's job.
- **No data-dump sections.** A 10–30 row spec/award/pricing table on a marketing page is the wrong
  layout. Use top 3–5 highlights + "view full list", grouped chunks, a card-per-item grid, tabs, or
  a carousel. A long list with a hairline under every row is the laziest possible choice.
- **Copy self-audit before ship.** Re-read every visible string (headlines, eyebrows, button labels,
  body, captions, alt, footer). Rewrite anything grammatically broken, with unclear referents, or
  that reads like AI trying to sound thoughtful (forced wordplay, mock-craftsman labels). Boring and
  clear beats cute and wrong.
- **No fake-precise numbers.** `92%`, `4.1×`, `5.8mm` are banned unless they come from the brief/real
  data or are explicitly marked as sample. Don't fake engineering precision the brand doesn't claim.
- **Quotes/testimonials:** ≤ 3 lines of body, real typographic quotes or none, attribution = name +
  role (+ company), never name-only.

---

## 9. Images (Divi image + background modules)

Landing pages are visual products. A page of text modules and `<div>`-style fake panels is slop.

- **Use real or generated imagery** for hero, product/lifestyle shots, texture backgrounds. Every
  image needs descriptive alt (the builder enforces this). If no image is available, leave a clearly
  labelled placeholder slot and tell the user which images the page needs — do **not** fake it.
- **No fake product UI built from text/blurb modules** (fake dashboards, fake terminals, fake task
  lists). Use a real screenshot, a generated image, or skip the preview.
- Even a minimal/editorial page needs 2–3 real images. Pure text is not minimalism, it's incomplete.

---

## 10. AI tells — banned by default (content & decoration)

Treat each as a hard ban unless the brief explicitly calls for it:

- **Em-dash (`—`) and en-dash-as-separator (`–`): completely banned, everywhere visible** — headlines,
  eyebrows, pills, body, quotes, attribution, captions, button text, alt text. Use a normal hyphen
  `-`. This is the #1 typographic tell; the phrasing is binary, not "use sparingly". (See §11.)
- **No section-number eyebrows** (`00 / INDEX`, `001 · Capabilities`, `06 · how it works`).
- **No generic step labels** ("Stage 1 / Step 2 / Phase 03"). The step content is the label.
- **No scroll cues** (`Scroll`, `↓ scroll`, `Scroll to explore`, animated mouse icons).
- **No locale / city / time / weather strips** ("Lisbon 14:23 · 18°C") unless the brand is genuinely
  place- or timezone-relevant. A single contact address in the footer is fine.
- **No decorative status dots** before nav items / list rows / badges unless they convey real state.
- **The middle-dot `·` is rationed** — max one per metadata line, not the default separator for everything.
- **No "Quietly trusted by" / "From the field" / "Field notes"** performative-craftsman labels. Use
  plain functional labels ("Testimonials", "Latest writing") or none.
- **No version labels in the hero** (`V0.6`, `BETA`, `EARLY ACCESS`) unless the brief is a launch.
- **No version footers** (`v1.4.2`, `Build 0048`, `last sync 4s ago`) on marketing pages.
- **No pills/labels overlaid on images**, **no photo-credit captions as decoration** (`Frame XII · 35mm`).
- **No generic names / brands** ("John Doe", "Acme", "Nexus", "SmartFlow"); **no filler verbs**
  ("Elevate", "Seamless", "Unleash", "Revolutionize", "Next-Gen").

### 10.A Visual and typographic tells

- **No neon / outer glows** by default. Use inner borders or subtle tinted shadows.
- **No pure black (`#000000`) text** — floor at `#1A1A1A` on light; use zinc/charcoal off-blacks.
- **No pure white (`#FFFFFF`) body text on dark** — headings may be `#FFFFFF`; body should be `#BBBBBB`-`#CCCCCC`.
- **Avoid `Inter` as the default display font** (see §2). It is the single most-tested AI tell.
- **No oversized H1s** that rely only on raw scale. Control hierarchy with weight and colour.
- **No `<br>`-broken-and-italicized headlines** as a default "design move" (`for thirty<br>*years.*`).
- **No vertical rotated text** ("INDEX OF WORK, 2018 - 2026" rotated 90°) unless the brief is explicitly agency/Awwwards and it serves real composition.
- **No crosshair / hairline grid lines** drawn purely as decoration.

### 10.B Content and data tells (the "Jane Doe" effect)

- **No generic names.** "John Doe", "Sarah Chan", "Jack Su" → use creative, realistic, locale-appropriate names.
- **No generic avatars.** No SVG "egg" or generic user icons.
- **No fake-perfect numbers.** `99.99%`, `50%`, `1234567` read as AI defaults. Use organic, messy data where real data is unavailable, or mark samples explicitly.
- **No startup-slop brand names.** "Acme", "Nexus", "SmartFlow", "Cloudly" → invent contextual, premium names that sound real.
- **No fake-precise engineering specs.** `92%`, `4.1×`, `5.8 mm`, `13.4 lb` are banned unless they come from the brief/real data or are explicitly marked as sample.
- **No micro-meta-sentences under eyebrows.** Sentences like *"Each of these is a feature we ship today, not a roadmap promise."* under a section heading are clutter.
- **No "Brand · No. 01"-style sub-eyebrows** or "Marrow · No. 01 · The 6-quart" micro-meta lines.

### 10.C Production-test tells — decoration and layout

- **No decoration text strip at hero bottom** (`BRAND. MOTION. SPATIAL.`, `DESIGN · BUILD · SHIP`).
- **No floating top-right sub-text in section headings.** A tiny paragraph floating in the top-right corner of a section header is a Tell; stack explainer text under the headline or use a real two-column header.
- **No `border-t` + `border-b` on every row** of long lists or spec tables. Use grouped chunks, card grids, or sparse dividers (see §8).
- **No scoring/progress bars with filled background tracks** as comparison visuals on marketing pages.
- **No "Reservation 412 of 800"-style live-stock counters** unless the brief is a real limited-run waitlist.
- **No generic step labels** ("Stage 1 / Step 2 / Phase 03"). Use the verb-noun directly (`Install`, `Configure`, `Ship`).
- **No pills/labels/tags overlaid on images** (`Brand · 02`, `Field notes - journal`).
- **No photo-credit captions as decoration** under stock/picsum images (`Field study no. 12 · Ines Caetano`).

---

## 11. Em-dash ban (mechanical, enforceable)

Em-dash (`—`) and en-dash used as a separator (`–`) are forbidden in any user-visible string. Only
permitted dash is the regular hyphen `-` (compound words, ranges like `2018-2026`, `€40-80k`) and a
minus sign in maths. A single `—` or `–` in visible copy fails the pre-flight check and must be
rewritten: two sentences with a period, a comma, parentheses, or a colon.

> **Recommended:** add this as a hard FAIL in `scripts/validate.js` (scan heading/text/button/alt
> strings for `—` and `–`). It is the one taste rule that can be checked deterministically.

---

## 12. Out of scope

This taste layer is for marketing / landing / about / portfolio surfaces. It does **not** improve
dashboards, dense data tables, multi-step wizards, or admin UI. If the brief is one of those, say so
and only apply the marketing-surface parts.

---

## 13. Positive layout patterns (what good looks like)

Anti-slop rules alone do not produce Floria-tier pages. Before building, read
**[layout-patterns.md](layout-patterns.md)** and study the bundled reference screenshots
**[floria-top.png](floria-top.png)** / **[floria-bottom.png](floria-bottom.png)** (Taste Skill examples).

Minimum composition bar for a standard landing page:

- **Split or left-aligned hero** with a real hero image — not a centred text stack on flat colour.
- **≥ 4 different layout families** across the page (split hero, image gallery, bento grid, full-width
  CTA band, staggered testimonials, vertical FAQ, etc.).
- **Image-led sections** where the brief has products, portfolio, or lifestyle content — photos carry
  the colour; don't rely on icon blurbs in identical white boxes.
- **Varied section headers** — left-aligned for split/gallery sections; centred only for manifesto bands.

If the HTML preview could be mistaken for a default Divi demo (centred hero, three equal blurbs, eyebrow
on every section), it fails the taste gate even when the anti-slop checklist passes.

---

## 14. Taste pre-flight (run before declaring done)

Mechanical boxes — if any fails, the page is not done:

- [ ] **Design Read** one-liner stated; dials chosen from the brief, not silent baseline.
- [ ] **Zero em-dashes / en-dash separators** anywhere visible.
- [ ] **One accent colour** via global-colour reference across all sections; **one radius scale**.
- [ ] **Theme rhythm intentional**: any dark↔light alternation is a locked composition with constant
      accent + AA contrast, no stray single-section inversion.
- [ ] **Hero**: ≤ 2-line headline, ≤ 20-word subtext, CTA above the fold, ≤ 4 text elements, top
      padding ≤ ~6em, no trust strip / pricing teaser / tagline inside it.
- [ ] **Eyebrow count** ≤ ceil(sections ÷ 3); hero counts as one.
- [ ] **Layout variety** (see layout-patterns.md + Floria refs): split/left hero with image; ≥ 4 layout
      families; no 3 consecutive zigzag splits; **no three-equal icon-blurb cards**; no split-header;
      tiles have exact cell count + real background variety.
- [ ] **One CTA label per intent**; CTA fits one line; button text passes contrast.
- [ ] **Typography**: ≤ 2 families; `Inter`/serif used only with justification; not Fraunces/Instrument
      Serif by default; phone heading sizes set.
- [ ] **Colour**: no pure `#000`/`#fff` text; no default AI-purple/neon; accent used sparingly.
- [ ] **Real images** with alt; no fake UI built from text/blurb modules; placeholders flagged to user.
- [ ] **Copy self-audit** done; no fake-precise numbers, generic names, or filler verbs.
- [ ] **Responsive**: rows wrap on phone, non-full columns `24_24` on phone, section padding reduced.
- [ ] **No AI tells** from §10 (section-number eyebrows, scroll cues, locale strips, decorative dots,
      version labels/footers, performative labels).

---

*Source: Taste Skill v2 (`design-taste-frontend`), MIT © Leonxlnx, tasteskill.dev — adapted for Divi 5.*
