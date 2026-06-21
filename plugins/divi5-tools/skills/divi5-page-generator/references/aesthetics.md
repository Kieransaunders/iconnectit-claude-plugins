# Aesthetic Presets + Design System

Single source of truth — supersedes the token sets previously duplicated across cinematic-landing and ui-ux-pro-max.

> **Anti-slop guardrails (see `references/taste.md`).** Pick the preset that fits the *brief*, never
> a default reach. Specifically: don't choose **Vapor Clinic** just because the brief says "tech"
> (its Plasma `#7B61FF` is the AI-purple tell), and don't choose **Organic Tech** just because it
> says "wellness" or "artisan" (its warm cream/clay is the premium-consumer cliché family). `Inter`
> is fine as a neutral *body* font but is discouraged as a *display/heading* font; `Fraunces` and
> `Instrument Serif` are banned as default drama serifs. Em-dashes are banned in all page copy.

## The 5 presets

### A — Organic Tech (Clinical Boutique)
- **Identity:** research lab meets luxury magazine
- **Palette:** Moss `#2E4036` (dark base), Clay `#CC5833` (accent), Cream `#F2F0E9` (light bg), Charcoal `#1A1A1A` (text)
- **Fonts:** Plus Jakarta Sans (headings, 700) / Source Sans 3 (body) / Cormorant Garamond Italic (drama)
- **Flow:** Dark hero → Cream about → White features → Cream process → Clay CTA → Dark footer
- **Image mood:** organic textures, forest, laboratory glassware
- **Use only when earned:** cream + clay + charcoal is the default AI reach for "artisan / wellness /
  premium-consumer" briefs, which makes those brands look identical. The moss base keeps it off the
  pure beige+brass cliché, but if you've shipped this palette recently, rotate the accent (forest +
  amber, terracotta + slate, or olive + brick) rather than defaulting to clay again. The Cormorant
  drama serif is a *justified* serif here (genuine luxury-magazine identity), not a default reach.

### B — Midnight Luxe (Dark Editorial)
- **Identity:** private members' club meets watchmaker's atelier
- **Palette:** Obsidian `#0D0D12`, Champagne `#C9A84C`, Ivory `#FAF8F5`, Slate `#2A2A35`
- **Fonts:** Inter tight (headings) / Inter (body) / Playfair Display Italic (drama)
- **Flow:** Dark hero → Ivory about → Light gray features → Ivory process → Champagne CTA → Dark footer
- **Image mood:** dark marble, gold accents, architectural shadow

### C — Brutalist Signal (Raw Precision)
- **Identity:** control room for the future — pure information density
- **Palette:** Paper `#E8E4DD`, Signal Red `#E63B2E`, Off-white `#F5F3EE`, Black `#111111`
- **Fonts:** Space Grotesk (headings) / Inter (body) / DM Serif Display Italic (drama)
- **Flow:** Paper hero → White features → Off-white process → Red CTA → Black footer
- **Image mood:** concrete, brutalist architecture, industrial

### D — Vapor Clinic (Neon Biotech)
- **Identity:** genome lab inside a Tokyo nightclub
- **Palette:** Deep Void `#0A0A14`, Plasma `#7B61FF`, Ghost `#F0EFF4`, Graphite `#18181B`
- **Fonts:** Sora (headings) / DM Sans (body) / Newsreader Italic (drama)
- **Flow:** Dark hero → Ghost about → White features → Ghost process → Plasma CTA → Dark footer
- **Image mood:** neon gradients, lab glass, night architecture
- **Use only when earned:** Plasma `#7B61FF` is the textbook AI-purple glow. Reach for this preset
  only when the brief genuinely wants neon-biotech energy. If purple isn't justified, swap Plasma for
  a different high-contrast accent (electric blue, acid lime, hot magenta) and keep the dark base.

### E — Minimal Editorial (Clean Authority)
- **Identity:** Kinfolk magazine meets Swiss design studio
- **Palette:** White `#FFFFFF`, Near-Black `#171717`, Light Gray `#F5F5F5`, accent per brand (default `#dc2626`)
- **Fonts:** Outfit (headings) / Inter (body) — no drama font; impact through scale
- **Flow:** White hero → Gray about → White features → Gray process → Dark CTA → Near-black footer
- **Image mood:** minimal, architectural, studio photography

**Custom brand colours:** map them into the system — identify primary accent and dark base, derive light backgrounds and text greys. Keep the chosen preset's fonts and flow.

## Style selection by business type

| Business type | Recommended preset | Colour direction |
|---------------|-------------------|------------------|
| Tech/SaaS | Minimal Editorial, Brutalist Signal | Blue/purple accent, dark hero |
| Beauty/Wellness | Organic Tech | Earthy tones, soft backgrounds |
| Finance/Legal | Midnight Luxe | Navy/gold, conservative palette |
| Creative/Design/Agency | Brutalist Signal | Monochrome + one bold accent |
| Healthcare | Minimal Editorial | Blue/green, clean whites |
| E-commerce | Minimal Editorial | Brand-specific accent |
| Restaurant/Food | Organic Tech | Warm tones, rich backgrounds |
| Real Estate | Midnight Luxe | Dark/gold or navy/white |
| Education | Minimal Editorial | Friendly blues/greens |
| Biotech/Web3/Gaming | Vapor Clinic | Neon accent on deep dark |

## Extended font pairings (beyond the preset defaults)

| Style | Heading | Body | Drama/Accent |
|-------|---------|------|--------------|
| Modern Corporate | Poppins | Inter | — |
| Elegant Serif | Playfair Display | Lora | — |
| Bold Geometric | Sora | DM Sans | Newsreader Italic |
| Warm Humanist | Nunito | Source Sans 3 | — |
| Tech Forward | Space Grotesk | IBM Plex Sans | IBM Plex Mono |
| Luxury Minimal | Cormorant Garamond | Montserrat | — |

Still max two families per page — the drama font is used once or twice (hero italic word), loaded as a single weight.

## Typography hierarchy

| Role | Size desktop | Size phone | Weight | Line height | Notes |
|------|-------------|-----------|--------|-------------|-------|
| Hero h1 | 56–72px | 32–40px | 700–800 | 1.05–1.1em | 3–4x body size — cinematic scale |
| Section h2 | 36–44px | 24–32px | 700 | 1.2–1.3em | |
| Card h3 | 22–28px | 20–24px | 600–700 | 1.3em | |
| Eyebrow | 12–13px | same | 600 | — | uppercase, letterSpacing 2–3px, accent colour, `text()` not `heading()` |
| Body | 16–18px | ≥16px | 400 | 1.7–1.8em | |
| Data/mono | 13px | same | 400 | — | IBM Plex Mono / JetBrains Mono |

Max two font families per page (SEO/CWV rule).

## Colour application

- **Accent**: CTAs, eyebrows, icons, active states — sparingly.
- **Text**: never pure black — `#2D2D2D` headings, `#555–#666` body, `#999` secondary.
- **On dark**: `#BBB–#CCC` body; pure white headings only.
- **Backgrounds alternate** every section. Never two same-coloured sections adjacent.

### Text colour per background

| Section background | Heading | Body | Muted/caption |
|--------------------|---------|------|---------------|
| White | #1A1A1A | #444444 | #888888 |
| Light gray | #1A1A1A | #444444 | #888888 |
| Dark | #FFFFFF | #CCCCCC | #999999 |
| Accent | #FFFFFF | #E8E8E8 | #BBBBBB |

### Section flow patterns

- **A — Classic alternating:** Dark hero → White about → Gray features → White process → Gray testimonials → Accent CTA → Dark footer
- **B — Dark anchored:** Dark hero → White features → Dark stats → Gray services → Accent CTA → White FAQ → Dark footer
- **C — Light editorial:** White hero (oversized type) → Gray about → White features → Dark CTA → Gray testimonials → Dark footer

## Spacing rhythm

| Element | Desktop | Phone |
|---------|---------|-------|
| Hero padding | 7–8em | 4em |
| Content section | 6–7em | 3.5–4em |
| CTA band | 5em | 3em |
| Footer | 4em | 3em |
| Card internal | 2em | 1.5em |
| Column gap | 30px | stacked |
| Text row maxWidth | 700–800px | 100% |
| Card row maxWidth | 1200px | 100% |

## Components

- **Cards:** use only when elevation communicates hierarchy. Prefer image-led tiles (photo + caption) over icon blurbs. When cards are used: contrasting bg, consistent radius, 2em padding.
- **Buttons:** exactly two styles — Primary (filled) and Ghost (transparent / text link). Pick one radius system (pill `999px`, soft `12–16px`, or sharp) and hold it. Invert primary on accent backgrounds.
- **Hero:** static (no slider). **Default: asymmetric split** — left-aligned copy + right image (see `layout-patterns.md`). Centred stack only for manifesto/editorial briefs with low VARIANCE.

## Section anatomy (layout families, not a template)

Pick sections from the brief. Each section uses a **different layout family** (see `layout-patterns.md`).
Quality bar: [floria-top.png](floria-top.png), [floria-bottom.png](floria-bottom.png).

Suggested arc (swap families — never repeat the same structure):

Hero **split or editorial** → About **split narrative** → Features **image gallery or bento** (not 3 equal icon blurbs) → Process **split with numbered steps** (numbers are `text()`, not headings) → Testimonials **staggered cards** → Pricing **vertical stack or emphasised middle tier** → CTA band **full-width photo or accent** → FAQ **single column** → Footer **dark anchor** (NAP if local).
