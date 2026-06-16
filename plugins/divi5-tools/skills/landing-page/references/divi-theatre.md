# DiviTheatre Motion Presets (Optional)

> DiviTheatre is a separate WordPress plugin that adds Theatre.js-powered cinematic animations
> to Divi 5. The landing-page generator supports it as an OPTIONAL motion layer. The user MUST
> be asked before any `data-theatre` attributes are emitted. Never add motion without consent.
>
> Repository: ask the user for the download/install URL when they say they want DiviTheatre.

---

## Consent gate (mandatory)

Before generating any `data-theatre` attributes, ask the user:

> **"Do you have DiviTheatre installed? It adds cinematic animations (fade-up, stagger, parallax,
> hero-reveal) to any Divi 5 element. Options: Yes (I'll add motion), No but I want it (I'll note
> where to get it), No (static page only)."**

- **Yes:** read this file, map the MOTION dial to presets, emit `data-theatre` attributes via
  `D.theatreAttrs()` or the `theatre:` / `theatreOpts:` shortcut on any module function.
- **No but I want it:** generate a static page. In the delivery summary, note:
  *"This page is static. To add cinematic motion, install DiviTheatre and add data-theatre
  attributes to these elements: [list]."*
- **No:** static only. Never emit `data-theatre`.

---

## Preset catalogue

| Preset | What it does | Recommended trigger | Best on |
|---|---|---|---|
| `fade-up` | Fade in + translate up 50px | `onScroll` | Text modules, headings, sections |
| `fade-left` | Fade in + slide from left | `onScroll` | Images, columns |
| `fade-right` | Fade in + slide from right | `onScroll` | Images, columns |
| `scale-in` | Scale 0.9 to 1 + fade | `onScroll` | Cards, images, blurb modules |
| `stagger` | Each child fades up, 100ms offset | `onScroll` | Rows containing multiple columns |
| `parallax-scroll` | Y-axis drift based on scroll | self-managed | Hero images, background sections |
| `hover-grow` | Scale to 1.08 on hover, reverse on leave | self-managed | Buttons, CTAs, cards |
| `hero-reveal` | Choreographed: bg fade, headline, text, CTA | `onLoad` | Hero sections |
| `pin:product-reveal` | **Pinned scene** — section pins while a media element scales and content panels reveal in sequence, scrubbed by scroll (Apple-product-page style) | self-managed (scroll-scrubbed) | A whole section with one media element + 2–3 panels |

`pin:product-reveal` is the only `pin:` (pinned-scene) preset. It is the heaviest, most cinematic effect — treat it as a section-level set piece, not a per-element flourish. See [Pinned scenes](#pinned-scenes-pin-category) below.

---

## Trigger options

Set via `theatreOpts` on any module, or as data attributes in Divi's Advanced panel.

| Option | Value | Description |
|---|---|---|
| `trigger` | `onScroll` (default) | Play when element enters viewport (IntersectionObserver, threshold 0.15) |
| `trigger` | `onLoad` | Play on page load |
| `trigger` | `onClick` | Play when element is clicked (once) |
| `delay` | milliseconds | Delay before animation starts |
| `duration` | milliseconds | Override preset duration (ignored by parallax-scroll and hero-reveal) |
| `mobile` | `true` | Override the <768px mobile skip (use sparingly) |

Trigger, delay and duration do **not** apply to `pin:` presets — pinned scenes are scroll-scrubbed (the playhead is bound to scroll position), so they are self-managed. The only option a pin scene reads is `distance` (see below).

---

## Pinned scenes (`pin:` category)

A pinned scene tags a **whole section** (or container). On scroll the section pins in place while a composed timeline scrubs forward; scrolling back up reverses it symmetrically. The flagship preset is `pin:product-reveal`: a media element holds and scales up while content panels reveal in sequence.

### Authoring a pinned scene

Put `data-theatre="pin:product-reveal"` on the **section**, then mark its children by role:

| Attribute | On | Purpose |
|---|---|---|
| `data-theatre="pin:product-reveal"` | the section/container | declares the pinned scene |
| `data-theatre-distance` | the same section | runway length — how long it stays pinned. **Default `150vh`.** vh only (e.g. `200vh`). |
| `data-theatre-part="media"` | one child (image/column) | the element that holds + scales |
| `data-theatre-part="panel"` | 2–3 children | the content blocks that reveal in sequence |

If no `data-theatre-part` markers are present, DOM order is used: first child = media, the rest = panels. **Panels are capped at 3** — a 4th `panel` child is silently ignored (v1 limitation).

There are two code-free authoring paths in Divi 5:
1. **Raw attributes** — add the attributes above in Advanced → Attributes on the section and each child.
2. **Pinned Scene wrapper module** — a DiviTheatre Divi 5 module that emits the same `data-theatre` / `data-theatre-distance` attributes for you (DiviTheatre Phase 05-03). Prefer this once shipped; it is the same engine underneath.

### Builder emission

```javascript
// section carries the pin preset + runway; children carry their part role
D.section({ adminLabel: 'Product reveal', theatre: 'pin:product-reveal', theatreOpts: { distance: '200vh' } }, [
  D.row({ structure: 'equal-columns_1' }, [
    D.column({}, [
      D.image({ src: '...', alt: 'Product', theatrePart: 'media' }),
      D.text({ html: '<h2>Panel one</h2>', theatrePart: 'panel' }),
      D.text({ html: '<p>Panel two</p>',  theatrePart: 'panel' }),
      D.text({ html: '<p>Panel three</p>', theatrePart: 'panel' }),
    ]),
  ]),
]);
```

The builder allowlists the preset name and the part role, and validates `distance` against `/^\d+vh$/` — a typo throws at generate time rather than shipping a dead attribute.

### Behaviour you can rely on (handled by the engine)

- **Mobile (≤768px) and `prefers-reduced-motion: reduce`:** the section does **not** pin. It jumps straight to the end state (media at final scale, panels visible) — no runway, no scroll-jacking, no rAF loop. Never promise pinning on mobile.
- **Performance:** IntersectionObserver-gated `requestAnimationFrame`, zero scroll listeners; the loop is idle while the section is off-screen, and torn down on `pagehide`.
- **FOUC:** the section and its children are visible from first paint.

### Gotcha — sticky needs a clean ancestor chain

The pin uses `position: sticky` on an inner wrapper. **Any ancestor with `overflow: hidden` silently kills sticky** and the section will scroll past without pinning. If a generated layout wraps the pin section in something that clips overflow, the scene won't pin. Keep pin sections as direct children of the page root where possible.

### Collision guard

Never put Divi's own native sticky (`decoration.sticky`) on the same block as a `pin:` attribute — two pinning systems fight. The validator FAILs on this (see `validate.js`).

---

## MOTION dial mapping

The taste layer (`taste.md`) sets a MOTION dial (1 to 10). When DiviTheatre is installed, map it to presets:

| MOTION dial | Recommended presets |
|---|---|
| 1 to 3 (static) | None. Ship clean static layout. |
| 4 to 5 (subtle) | `fade-up` on section content, `fade-left` on images |
| 6 to 7 (fluid) | `fade-up` + `stagger` on rows, `scale-in` on cards, `hover-grow` on primary CTA |
| 8 to 10 (cinematic) | `hero-reveal` on hero section, `stagger` on feature rows, `parallax-scroll` on images, `hover-grow` on all CTAs |

**Pinned scenes (`pin:product-reveal`)** sit at the very top of the dial — only offer at **MOTION ≥ 7**, and only when there's a genuine product/feature reveal to choreograph. It's a section-level set piece, not decoration. At most one per page; on a trust-first or content-dense page, drop it. It is mobile-disabled by design (jumps to end state ≤768px), so never rely on it carrying the mobile experience.

**Rule:** motion must be motivated (taste.md). Each animation should communicate hierarchy, storytelling, feedback, or state transition. If you cannot justify it in one sentence, drop the animation.

---

## Builder usage

```javascript
const D = require('./scripts/divi-builder');

// Option 1: inline shortcut on any module (cleanest)
D.section({ adminLabel: 'Hero', theatre: 'hero-reveal', theatreOpts: { trigger: 'onLoad' } }, [ ...rows ]);
D.heading({ text: 'Headline', level: 'h2', theatre: 'fade-up', theatreOpts: { trigger: 'onScroll', delay: 200 } });
D.button({ text: 'Get Started', url: '#', theatre: 'hover-grow' });

// Option 2: explicit attrs (when you need more control)
D.text({ html: '<p>Body</p>', attrs: D.theatreAttrs('fade-up', { trigger: 'onScroll' }) });
```

Both produce the same `module.decoration.attributes.desktop.value.attributes` structure (an array of
`{name, value, targetElement}`) that Divi 5 renders as HTML data attributes on the module wrapper.
(Not `module.advanced.attributes` — that path renders nothing.)

---

## Safety guarantees (handled by DiviTheatre engine)

- **Reduced motion:** all presets jump to final visible state when `prefers-reduced-motion: reduce` matches. No element is left hidden.
- **Mobile:** all presets skip on viewports <768px (elements jump to final state). Override per-element with `data-theatre-mobile="true"`.
- **Performance:** `parallax-scroll` uses `requestAnimationFrame` + `IntersectionObserver`. Zero scroll event listeners.
- **Divi conflict:** the engine strips Divi's `et_pb_animation` classes before Theatre.js writes styles.

---

## Out of scope (future presets)

- Horizontal scroll hijack
- Three.js / 3D objects
- Marquee / infinite text bands
- Magnetic pointer physics
- In-Visual-Builder dropdown UI (Phase 4 of DiviTheatre roadmap)

If the MOTION dial is high but these are needed, lower the dial and ship clean static layout with strong composition. Half-built motion is worse than none.
