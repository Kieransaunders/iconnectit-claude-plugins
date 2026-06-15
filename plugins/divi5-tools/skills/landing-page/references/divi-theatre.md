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

---

## MOTION dial mapping

The taste layer (`taste.md`) sets a MOTION dial (1 to 10). When DiviTheatre is installed, map it to presets:

| MOTION dial | Recommended presets |
|---|---|
| 1 to 3 (static) | None. Ship clean static layout. |
| 4 to 5 (subtle) | `fade-up` on section content, `fade-left` on images |
| 6 to 7 (fluid) | `fade-up` + `stagger` on rows, `scale-in` on cards, `hover-grow` on primary CTA |
| 8 to 10 (cinematic) | `hero-reveal` on hero section, `stagger` on feature rows, `parallax-scroll` on images, `hover-grow` on all CTAs |

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

Both produce the same `module.advanced.attributes.desktop.value` structure that Divi 5 renders as
HTML data attributes on the module wrapper.

---

## Safety guarantees (handled by DiviTheatre engine)

- **Reduced motion:** all presets jump to final visible state when `prefers-reduced-motion: reduce` matches. No element is left hidden.
- **Mobile:** all presets skip on viewports <768px (elements jump to final state). Override per-element with `data-theatre-mobile="true"`.
- **Performance:** `parallax-scroll` uses `requestAnimationFrame` + `IntersectionObserver`. Zero scroll event listeners.
- **Divi conflict:** the engine strips Divi's `et_pb_animation` classes before Theatre.js writes styles.

---

## Out of scope (future presets)

- GSAP-style sticky-stack sections
- Horizontal scroll hijack
- Three.js / 3D objects
- Marquee / infinite text bands
- Magnetic pointer physics
- In-Visual-Builder dropdown UI (Phase 4 of DiviTheatre roadmap)

If the MOTION dial is high but these are needed, lower the dial and ship clean static layout with strong composition. Half-built motion is worse than none.
