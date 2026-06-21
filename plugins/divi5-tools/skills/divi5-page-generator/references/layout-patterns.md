# Layout Patterns — Taste-Quality Divi 5

> **Quality bar:** study [floria-top.png](floria-top.png) and [floria-bottom.png](floria-bottom.png) before
> every build. Those pages were made with the Taste Skill (React). Divi cannot replicate GSAP scroll
> hijacks or magnetic physics — but it **can** hit the same visual tier: asymmetric splits, image-led
> sections, editorial type, one accent, varied layout families, real photography.

The taste layer (`taste.md`) says what **not** to do. This file says what **to** do — translated into
Divi 5 rows, columns, and modules.

---

## 1. Layout families (pick ≥4 per page)

Each section must use a **different family**. Never repeat the same structure twice.

| Family | When | Divi structure |
|--------|------|----------------|
| **A — Asymmetric split hero** | Default for VARIANCE ≥ 5 | `row` 40/60 or 50/50: text column left-aligned + `image` column (large, can bleed visually) |
| **B — Image-led gallery** | Products, portfolio, features with visuals | 2–3 columns of `image` + caption `text` below — **not** icon blurbs |
| **C — Split narrative** | About, process, story | 50/50: photo or tinted column + stacked headline/body/steps |
| **D — Bento / asymmetric grid** | Archives, categories, mixed offerings | CSS grid row (`gridColumnCount: 3`, mixed widths) or uneven `flexType` (16_24 + 8_24 + 8_24) with **full-bleed images** in cells |
| **E — Full-width band** | CTA, manifesto, quote | Single column, `maxWidth` 700–900px, optional section background image + dark overlay |
| **F — Staggered cards** | Testimonials, social proof | 2–3 columns with **different** card backgrounds/heights — not three identical white boxes |
| **G — Vertical stack** | FAQ, pricing table, simple lists | Single column, constrained width, no cards unless earned |
| **H — Stats strip** | Metrics | 3–4 `number-counter` in one row, no card wrappers, hairline or whitespace separation |

**Banned as a layout family:** three equal icon-blurb cards in a row. That is the generic AI default
`taste.md` and Floria both reject.

---

## 2. Floria patterns → Divi recipes

### Split hero (Floria top)

```
section (dark bg, padding top ~6em max)
  row (alignItems: center, maxWidth ~1400px)
    column flexType 12_24 — left-aligned:
      eyebrow (optional, ONE per page start) — text left
      h1 — left, large, italic word in SAME family if emphasis needed
      text body — left, maxWidth ~480px, ≤20 words
      button primary + ghost/link secondary
    column flexType 12_24:
      image — tall portrait, moody product/lifestyle photo, descriptive alt
```

- **Left-align** hero copy (`textAlign: 'left'` on heading/text presets). Centred hero is only for
  manifesto/editorial briefs with VARIANCE ≤ 4.
- Hero image is **required** for premium-consumer / creative / agency briefs. Text + flat colour is a placeholder.

### Image-led gallery (Floria "Curated Assemblages")

```
section (dark)
  row — header: h2 left + text link right (two columns 16_24 + 8_24)
  row — 3 columns flexType 8_24:
    column: image (tall aspect) + text caption row (title left, price/meta right)
```

Use real `image()` modules with alt text. Caption is `text()`, not `blurb()`.

### Process split (Floria "Architecture of Nature")

```
section (dark)
  row (alignItems: center)
    column 12_24: image (flowers/product) OR tinted bg
    column 12_24:
      h2
      short text
      3× (text step number as text() + h3 title + body) — NOT "Stage 1" labels
```

Max 2 consecutive image+text splits (zigzag cap). Break the third with a full-width band or bento grid.

### Bento archive grid (Floria "The Archives")

Use grid row or mixed flexTypes. Every cell = one real image + overlay title. N items → N cells.

```javascript
D.row({
  structure: 'equal-columns_1',
  attrs: {
    module: {
      decoration: {
        layout: {
          desktop: { value: { display: 'grid', gridColumnCount: '3', gridColumnWidths: 'equal', columnGap: '24px', rowGap: '24px' } },
          phone: { value: { gridColumnCount: '1' } },
        },
      },
    },
  },
}, [ /* columns with image + heading overlay via attrs if needed */ ]);
```

At least 2–3 cells use photography; don't ship all text-on-same-bg tiles.

### Testimonials stagger (Floria "Clarity.")

Prefer 2–3 columns with **varied** card styling (different bg shades, not identical white cards). Quote
≤ 3 lines. No em-dashes in quotes.

### Photo CTA band (Floria newsletter)

```
section — background image + dark colour overlay (see module-reference.md)
  row maxWidth ~900px
    column: h2 white + signup/button row
```

Rounded pill button (`radius: '999px'`) when shape lock says "pill buttons".

### Footer anchor (Floria bottom)

Dark section, large wordmark heading, 3 link columns, legal line. No version strings, no locale strips.

---

## 3. Typography moves that read "designed"

- **One display family + one body family.** Drama via scale/weight/italic in the **same** family — not a random serif injected into sans (Floria uses serif only for the "Clarity." editorial moment when the brief earns it).
- **Left-aligned section headers** for split/gallery sections. Centred h2 only for manifesto/full-width bands.
- **Eyebrows:** max one per three sections. Floria uses one in the hero ("STUDIO & ARCHIVE") — not above every h2.
- **Button shape lock:** pick pill (`999px`) OR soft (`12–16px`) OR sharp — apply everywhere.

---

## 4. Colour moves (Floria tier)

- **Dark editorial:** near-black `#0A0A0A`–`#111`, off-white body `#CCC`, pure white headings only.
- **One accent** locked via `globalColor()` — Floria uses white buttons on dark, not a second accent colour fighting the photography.
- **Photography carries colour.** Don't compensate for grey layouts with AI-purple gradients. Generate or source moody, on-brand photos.

---

## 5. HTML preview must demonstrate these patterns

Stage 2 HTML is the design spec. Before approval, confirm the preview matches at least:

1. Split or left-aligned hero with a real hero image
2. ≥ 4 layout families from the table above
3. No three-equal-blurb row
4. Real `<img>` tags with alt (picsum seed URLs acceptable in preview)
5. Visual tier in the same league as the Floria references — if it looks like a Divi demo template, iterate

---

## 6. Divi limitations (honest)

| Taste Skill (React) | Divi 5 native | With DiviTheatre (optional, user-consented) |
|---------------------|-------------------|---|
| Scroll-reveal stagger | Divi animation presets (basic) | `data-theatre="stagger"` |
| Parallax scroll | Divi scroll effects (4-position) | `data-theatre="parallax-scroll"` |
| Magnetic hover | Not available | `data-theatre="hover-grow"` |
| Hero choreography | Not available | `data-theatre="hero-reveal"` |
| Fade-up entrance | Divi animation fade | `data-theatre="fade-up"` (higher fidelity) |
| Scale-in entrance | Divi animation zoom | `data-theatre="scale-in"` (higher fidelity) |
| GSAP sticky stack | Skip | Not yet (future DiviTheatre preset) |
| Horizontal scroll hijack | Skip | Not yet (future DiviTheatre preset) |
| Marquee | Skip or single text row | Not yet (future DiviTheatre preset) |
| `backdrop-filter` glass | Solid fills + border, or overlays | Still limited (Divi module constraint) |

If MOTION dial is high but neither Divi native nor DiviTheatre can deliver, **lower the dial**
and ship clean static layout with strong composition. Half-built motion is worse than none.

> **DiviTheatre consent gate:** only add `data-theatre` attributes when the user has explicitly
> confirmed DiviTheatre is installed. See [divi-theatre.md](divi-theatre.md).

---

*Floria examples © Taste Skill / Leonxlnx (MIT) — bundled as visual quality bar for this skill.*
