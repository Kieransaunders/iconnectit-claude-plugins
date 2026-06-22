#!/usr/bin/env node
/**
 * example-divitheatre-page.js — worked example of the OPTIONAL DiviTheatre motion layer.
 *
 * A self-demonstrating landing page for the DiviTheatre plugin: it both describes
 * and runs DiviTheatre, showcasing all 8 presets (hero-reveal, fade-up, fade-left,
 * fade-right, scale-in, stagger, parallax-scroll, hover-grow), each card labelled
 * with the exact data-theatre attribute that powers it. See references/divi-theatre.md.
 *
 * Demonstrates:
 *   - the theatre:/theatreOpts: shortcut on section/row/column/heading/text/button
 *   - styling through Divi decoration, NOT inline style="…" (inline CSS — and any
 *     literal " in module content — get stripped to empty on Divi import)
 *
 * Run:      node example-divitheatre-page.js
 *           → writes divitheatre-landing-page.json + -seo-meta.json + -schema.json (git-ignored output)
 * Validate: node ../scripts/validate.js divitheatre-landing-page.json \
 *             --keyword "Divi 5 animation plugin" --meta divitheatre-seo-meta.json
 *
 * Motion only renders if the DiviTheatre plugin is active on the target site;
 * without it the page is still valid and the data-theatre attributes sit inert.
 *
 * Aesthetic: Vapor Clinic (Deep Void / Plasma / Ghost), Sora + DM Sans.
 *
 * NOTE: this file lives inside the skill, so it requires the builder relatively.
 * A generator in the USER'S project should require it via the absolute skill path:
 * require('${CLAUDE_SKILL_DIR}/scripts/divi-builder.js')
 */

'use strict';

const fs = require('fs');
const path = require('path');

const D = require('../scripts/divi-builder');

// ─── 1. Design tokens (Vapor Clinic) ────────────────────────────────────────
const T = {
  void: '#0A0A14',        // deep dark base
  graphite: '#131320',    // secondary dark
  plasma: '#7B61FF',      // accent
  plasma2: '#A78BFA',     // accent light (gradient/hover)
  ghost: '#F0EFF4',       // light bg
  card: '#1C1C2B',        // feature-card surface (one step lighter than the dark sections)
  white: '#FFFFFF',
  ink: '#16161D',         // heading on light
  bodyLight: '#4A4A57',   // body on light
  bodyDark: '#B9B9C9',    // body on dark
  muted: '#6E6E80',
  headingFont: 'Sora',
  bodyFont: 'DM Sans',
  dramaFont: 'Instrument Serif',
};
const KW = 'Divi 5 animation plugin';

// ─── 2. Builder + global colours ────────────────────────────────────────────
const b = D.createBuilder();
const cPlasma = b.globalColor('plasma', T.plasma, 'Plasma Accent');
const cVoid   = b.globalColor('void', T.void, 'Deep Void');
const cGhost  = b.globalColor('ghost', T.ghost, 'Ghost Light');
const cWhite  = b.globalColor('white', T.white, 'Pure White');

// ─── 3. Presets ─────────────────────────────────────────────────────────────
const P = {
  // Sections
  secVoid: b.preset('divi/section', 'Section - Void', {
    module: { decoration: { background: D.dv({ color: b.colorVar('void') }), spacing: D.dv({ padding: { top: '8em', bottom: '8em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  secGraphite: b.preset('divi/section', 'Section - Graphite', {
    module: { decoration: { background: D.dv({ color: T.graphite }), spacing: D.dv({ padding: { top: '7em', bottom: '7em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  secGhost: b.preset('divi/section', 'Section - Ghost', {
    module: { decoration: { background: D.dv({ color: b.colorVar('ghost') }), spacing: D.dv({ padding: { top: '7em', bottom: '7em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  secWhite: b.preset('divi/section', 'Section - White', {
    module: { decoration: { background: D.dv({ color: T.white }), spacing: D.dv({ padding: { top: '7em', bottom: '7em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  secPlasma: b.preset('divi/section', 'Section - Plasma CTA', {
    module: { decoration: { background: D.dv({ color: b.colorVar('plasma') }), spacing: D.dv({ padding: { top: '6em', bottom: '6em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  secFooter: b.preset('divi/section', 'Section - Footer', {
    module: { decoration: { background: D.dv({ color: b.colorVar('void') }), spacing: D.dv({ padding: { top: '4em', bottom: '4em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),

  // Headings
  heroH1: b.preset('divi/heading', 'Hero H1', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h1', family: T.headingFont, size: '66px', weight: '800', lineHeight: '1.06em', color: b.colorVar('white'), textAlign: 'center', letterSpacing: '-1px' }, { phone: { size: '36px' } }) } } },
  }),
  h2Dark: b.preset('divi/heading', 'H2 on dark', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h2', family: T.headingFont, size: '42px', weight: '700', lineHeight: '1.2em', color: b.colorVar('white'), textAlign: 'center', letterSpacing: '-0.5px' }, { phone: { size: '28px' } }) } } },
  }),
  h2Light: b.preset('divi/heading', 'H2 on light', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h2', family: T.headingFont, size: '42px', weight: '700', lineHeight: '1.2em', color: T.ink, textAlign: 'center', letterSpacing: '-0.5px' }, { phone: { size: '28px' } }) } } },
  }),
  h2LightLeft: b.preset('divi/heading', 'H2 on light left', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h2', family: T.headingFont, size: '40px', weight: '700', lineHeight: '1.2em', color: T.ink, textAlign: 'left', letterSpacing: '-0.5px' }, { phone: { size: '28px' } }) } } },
  }),

  // Body
  bodyDarkC: b.preset('divi/text', 'Body dark centred', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '18px', lineHeight: '1.8em', color: T.bodyDark, textAlign: 'center' }) } } } },
  }),
  bodyLightC: b.preset('divi/text', 'Body light centred', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '17px', lineHeight: '1.8em', color: T.bodyLight, textAlign: 'center' }) } } } },
  }),
  bodyLightL: b.preset('divi/text', 'Body light left', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '17px', lineHeight: '1.85em', color: T.bodyLight, textAlign: 'left' }) } } } },
  }),

  // Buttons
  btnPrimary: b.preset('divi/button', 'Button - Primary', {
    button: { decoration: { button: D.dv({ enable: 'on' }), font: { font: D.dv({ family: T.bodyFont, size: '17px', color: b.colorVar('white'), weight: '700' }) }, background: D.dv({ color: b.colorVar('plasma') }), border: D.dv({ radius: { topLeft: '10px', topRight: '10px', bottomLeft: '10px', bottomRight: '10px', sync: 'on' } }) } },
  }),
  btnOnPlasma: b.preset('divi/button', 'Button - on Plasma', {
    button: { decoration: { button: D.dv({ enable: 'on' }), font: { font: D.dv({ family: T.bodyFont, size: '17px', color: b.colorVar('plasma'), weight: '700' }) }, background: D.dv({ color: T.white }), border: D.dv({ radius: { topLeft: '10px', topRight: '10px', bottomLeft: '10px', bottomRight: '10px', sync: 'on' } }) } },
  }),

  cardBlurb: b.preset('divi/blurb', 'Feature Card', {
    // Dark cards need explicit light text - Divi's default blurb colours (#333/#666)
    // are invisible on a near-black surface.
    title: { decoration: { font: { font: D.dv({ family: T.headingFont, weight: '700', color: b.colorVar('white') }) } } },
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, lineHeight: '1.7em', color: T.bodyDark }) } } } },
  }),
};

// ─── helpers ────────────────────────────────────────────────────────────────
// Monospace, accent-coloured attribute label - styled via Divi decoration (no inline CSS).
// Use &quot; not a literal " - a literal double-quote in innerContent breaks Divi's
// block-comment JSON parsing and empties the module.
const presetTag = (name, color) =>
  D.text({ html: `<p>data-theatre=&quot;${name}&quot;</p>`, font: { family: 'monospace', size: '13px', weight: '600', color: color, letterSpacing: '1px', textAlign: 'center' } });

const spacer = (h) => D.divider({ show: false, height: h });

// ─── 4. SECTIONS ─────────────────────────────────────────────────────────────

// 1 ── HERO - hero-reveal (onLoad), CTAs hover-grow
const hero = D.section({ adminLabel: 'Hero', preset: P.secVoid, theatre: 'hero-reveal', theatreOpts: { trigger: 'onLoad' } }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '920px' }, [
    D.column({}, [
      D.eyebrow('CINEMATIC MOTION FOR DIVI 5', T.plasma2),
      D.heading({ text: `The Divi 5 Animation Plugin for <em>Cinematic</em>, Code-Free Motion`, level: 'h1', preset: P.heroH1 }),
      D.text({ html: `<p>DiviTheatre is the <strong>Divi 5 animation plugin</strong> that brings Theatre.js-powered, multi-step motion to any module, row or section - added with a single <code>data-theatre</code> attribute. No JavaScript. No timeline editor. Just drop it on and scroll.</p>`, preset: P.bodyDarkC, maxWidth: '660px', centered: true }),
      spacer('28px'),
      D.button({ text: 'Get DiviTheatre', url: '#pricing', preset: P.btnPrimary, theatre: 'hover-grow' }),
    ]),
  ]),
]);

// 2 ── INTRO - two-column, fade-right (text) / fade-left (visual)
const intro = D.section({ adminLabel: 'Intro', preset: P.secGhost }, [
  D.row({ structure: 'equal-columns_2', columnGap: '56px', rowGap: '40px', alignItems: 'center', maxWidth: '1100px' }, [
    D.column({ theatre: 'fade-right' }, [
      D.eyebrow('THE 30-SECOND WORKFLOW', T.plasma, { textAlign: 'left' }),
      D.heading({ text: 'Premium motion in Divi 5 - without touching a line of code', level: 'h2', preset: P.h2LightLeft }),
      D.text({ html: `<p>Open any element's <strong>Advanced → Attributes</strong> panel, add the attribute <code>data-theatre</code> with a value like <code>fade-up</code>, and you're done. DiviTheatre's engine handles the keyframes, the scroll triggers, the reduced-motion fallbacks and the mobile safeguards for you.</p>`, preset: P.bodyLightL }),
      spacer('18px'),
      D.button({ text: 'See all 8 presets', url: '#presets', preset: P.btnPrimary, theatre: 'hover-grow' }),
    ]),
    D.column({ background: T.void, padding: '2.4em', radius: '16px', theatre: 'fade-left' }, [
      D.text({ html: `<p>// Divi &rarr; Advanced &rarr; Attributes<br>name&nbsp;&nbsp;data-theatre<br>value&nbsp;hero-reveal<br><br>// optional fine-tuning<br>name&nbsp;&nbsp;data-theatre-trigger<br>value&nbsp;onScroll<br>name&nbsp;&nbsp;data-theatre-delay<br>value&nbsp;200</p>`, font: { family: 'monospace', size: '14px', lineHeight: '2em', color: T.bodyDark } }),
    ]),
  ]),
]);

// 3 ── PRESETS GRID - stagger on the row (children animate in sequence)
const presetCard = (icon, name, label, desc) =>
  D.column({ flexType: '8_24', background: T.card, padding: '2em', radius: '14px' }, [
    D.blurb({ icon, iconColor: T.plasma2, title: label, titleLevel: 'h3', body: desc, preset: P.cardBlurb }),
    presetTag(name, T.plasma2),
  ]);

const presets = D.section({ adminLabel: 'Presets', preset: P.secGraphite }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '760px' }, [
    D.column({ theatre: 'fade-up' }, [
      D.eyebrow('THE PRESET LIBRARY', T.plasma2),
      D.heading({ text: 'Eight cinematic presets, ready to drop on', level: 'h2', preset: P.h2Dark }),
      D.text({ html: `<p>Every animation on this page is DiviTheatre running live. Scroll and watch - each card below is tagged with the exact attribute that powers it.</p>`, preset: P.bodyDarkC, maxWidth: '600px', centered: true }),
    ]),
  ]),
  D.row({ structure: 'equal-columns_3', columnGap: '26px', rowGap: '26px', maxWidth: '1160px', theatre: 'stagger' }, [
    presetCard('&#xf062;', 'fade-up', 'Fade Up', 'Fades in while rising 50px. The everyday workhorse for headings and copy.'),
    presetCard('&#xf061;', 'fade-right', 'Fade Right', 'Slides in from the left as it fades. Ideal for text columns.'),
    presetCard('&#xf060;', 'fade-left', 'Fade Left', 'Slides in from the right. Pairs with fade-right for two-column reveals.'),
  ]),
  D.row({ structure: 'equal-columns_3', columnGap: '26px', rowGap: '26px', maxWidth: '1160px', theatre: 'stagger' }, [
    presetCard('&#xf065;', 'scale-in', 'Scale In', 'Scales 0.9 → 1 with a fade. Gives cards and images a confident pop.'),
    presetCard('&#xf0cb;', 'stagger', 'Stagger', 'Each child reveals 100ms after the last - exactly what this grid is doing.'),
    presetCard('&#xf07e;', 'parallax-scroll', 'Parallax Scroll', 'Drifts on the Y-axis as you scroll. rAF-driven, zero scroll listeners.'),
  ]),
  D.row({ structure: 'equal-columns_2', columnGap: '26px', rowGap: '26px', maxWidth: '780px', theatre: 'stagger' }, [
    presetCard('&#xf25a;', 'hover-grow', 'Hover Grow', 'Scales to 1.08 on hover and eases back. Try it on the buttons.'),
    presetCard('&#xf008;', 'hero-reveal', 'Hero Reveal', 'A choreographed 1.8s sequence - the exact reveal that opened this page.'),
  ]),
]);

// 4 ── PROCESS - stagger row of 3 numbered steps
const step = (n, title, body) =>
  D.column({ flexType: '8_24', padding: '0.5em' }, [
    D.text({ html: `<p>${n}</p>`, font: { family: T.headingFont, size: '52px', weight: '800', lineHeight: '1em', color: T.plasma } }),
    D.heading({ text: title, level: 'h3', attrs: { title: { decoration: { font: { font: D.dv({ headingLevel: 'h3', family: T.headingFont, size: '24px', weight: '700', color: T.ink, textAlign: 'left' }) } } } } }),
    D.text({ html: `<p>${body}</p>`, preset: P.bodyLightL }),
  ]);

const process = D.section({ adminLabel: 'Process', preset: P.secWhite }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '760px' }, [
    D.column({ theatre: 'fade-up' }, [
      D.eyebrow('HOW IT WORKS', T.plasma),
      D.heading({ text: 'Live in three steps', level: 'h2', preset: P.h2Light }),
    ]),
  ]),
  D.row({ structure: 'equal-columns_3', columnGap: '40px', rowGap: '32px', maxWidth: '1080px', theatre: 'stagger' }, [
    step('1', 'Install the plugin', 'Activate DiviTheatre. The engine loads site-wide and stays a no-op until it finds a tagged element.'),
    step('2', 'Add an attribute', 'On any module, set <code>data-theatre</code> to a preset name in the Advanced → Attributes panel.'),
    step('3', 'Publish & scroll', 'That\'s it. Reduced-motion and sub-768px visitors get a clean, fully-visible fallback automatically.'),
  ]),
]);

// 5 ── SHOWCASE - parallax-scroll on a decorative mark + scale-in cards
const showcase = D.section({ adminLabel: 'Showcase', preset: P.secVoid }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '760px' }, [
    D.column({ theatre: 'fade-up' }, [
      D.text({ html: `<p>&#10022;</p>`, font: { size: '64px', lineHeight: '1em', color: T.plasma2, textAlign: 'center' }, theatre: 'parallax-scroll' }),
      D.eyebrow('BUILT FOR REAL SITES', T.plasma2),
      D.heading({ text: 'Fast, accessible, and conflict-free by design', level: 'h2', preset: P.h2Dark }),
    ]),
  ]),
  D.row({ structure: 'equal-columns_3', columnGap: '26px', rowGap: '26px', maxWidth: '1080px' }, [
    D.column({ flexType: '8_24', background: T.card, padding: '2.2em', radius: '14px', theatre: 'scale-in', theatreOpts: { delay: 0 } }, [
      D.blurb({ icon: '&#xf3fd;', iconColor: T.plasma2, title: 'Reduced-motion safe', titleLevel: 'h3', body: 'Honours prefers-reduced-motion - every element jumps to its final visible state. Nothing is ever left hidden.', preset: P.cardBlurb }),
    ]),
    D.column({ flexType: '8_24', background: T.card, padding: '2.2em', radius: '14px', theatre: 'scale-in', theatreOpts: { delay: 120 } }, [
      D.blurb({ icon: '&#xf3cd;', iconColor: T.plasma2, title: 'Mobile-aware', titleLevel: 'h3', body: 'Animations skip below 768px so phones stay snappy - override per element when you really want motion.', preset: P.cardBlurb }),
    ]),
    D.column({ flexType: '8_24', background: T.card, padding: '2.2em', radius: '14px', theatre: 'scale-in', theatreOpts: { delay: 240 } }, [
      D.blurb({ icon: '&#xf0e7;', iconColor: T.plasma2, title: 'No layout jank', titleLevel: 'h3', body: 'Parallax runs on requestAnimationFrame with IntersectionObserver - zero scroll listeners, no CLS.', preset: P.cardBlurb }),
    ]),
  ]),
]);

// 6 ── STATS - fade-up counters on light
const stat = (num, percent, label) =>
  D.column({ flexType: '8_24', padding: '0.5em' }, [
    D.numberCounter({ title: label, number: num, percent, numberColor: T.plasma, numberSize: '56px' }),
  ]);

const stats = D.section({ adminLabel: 'Stats', preset: P.secGhost }, [
  D.row({ structure: 'equal-columns_3', columnGap: '40px', rowGap: '32px', maxWidth: '960px', theatre: 'fade-up' }, [
    stat(8, false, 'Cinematic presets'),
    stat(30, false, 'Seconds to add motion'),
    stat(0, false, 'Lines of code required'),
  ]),
]);

// 7 ── CTA - plasma band, hover-grow button
const cta = D.section({ adminLabel: 'CTA', preset: P.secPlasma, theatre: 'fade-up' }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '760px' }, [
    D.column({}, [
      D.heading({ text: 'Give your Divi 5 site a sense of motion', level: 'h2', preset: P.h2Dark }),
      D.text({ html: `<p>Install DiviTheatre, tag an element, and ship cinematic motion this afternoon.</p>`, font: { family: T.bodyFont, size: '18px', lineHeight: '1.8em', color: '#F3F0FF', textAlign: 'center' }, maxWidth: '540px', centered: true }),
      spacer('22px'),
      D.button({ text: 'Get DiviTheatre', url: '#', preset: P.btnOnPlasma, theatre: 'hover-grow' }),
    ]),
  ]),
]);

// 8 ── FAQ - long-tail queries
const faq = D.section({ adminLabel: 'FAQ', preset: P.secWhite }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '820px' }, [
    D.column({ theatre: 'fade-up' }, [
      D.eyebrow('QUESTIONS', T.plasma),
      D.heading({ text: 'Divi 5 animation plugin - FAQs', level: 'h2', preset: P.h2Light }),
      D.accordion([
        { question: 'How do I add animations to Divi 5 without code?', answer: 'Install DiviTheatre, then open any module’s Advanced → Attributes panel and add an attribute named <code>data-theatre</code> with a preset value such as <code>fade-up</code> or <code>stagger</code>. The engine does the rest - no custom JavaScript or CSS required.' },
        { question: 'What is the best animation plugin for Divi 5?', answer: 'DiviTheatre is purpose-built for Divi 5’s block system. It uses the Theatre.js motion engine for multi-step, choreographed animations that go well beyond Divi’s built-in entrance effects, while staying lightweight and accessible.' },
        { question: 'Does DiviTheatre slow down my Divi 5 site?', answer: 'No. The engine ships as a single IIFE bundle, exits as a no-op when no tagged elements are present, and drives scroll effects with requestAnimationFrame and IntersectionObserver - so there are zero scroll event listeners and no layout shift.' },
        { question: 'Will DiviTheatre animations work on mobile and with reduced motion?', answer: 'Yes - safely. Every preset skips on viewports under 768px and jumps to its final visible state when a visitor has prefers-reduced-motion enabled, so content is never hidden. You can override the mobile skip per element when needed.' },
        { question: 'How do I change the animation trigger or timing?', answer: 'Add companion attributes alongside <code>data-theatre</code>: <code>data-theatre-trigger</code> (onScroll, onLoad or onClick), <code>data-theatre-delay</code> in milliseconds, and <code>data-theatre-duration</code> to override a preset’s default speed.' },
      ]),
    ]),
  ]),
]);

// 9 ── FOOTER
const footer = D.section({ adminLabel: 'Footer', preset: P.secFooter }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '760px' }, [
    D.column({}, [
      D.text({ html: `<p>DiviTheatre</p>`, font: { family: T.headingFont, size: '20px', weight: '700', color: b.colorVar('white'), textAlign: 'center' } }),
      D.text({ html: `<p>Cinematic, code-free motion for Divi 5. A plugin by <a href='https://iconnectit.co.uk'>iConnectIT</a>.</p>`, font: { size: '14px', color: T.muted, textAlign: 'center' } }),
    ]),
  ]),
]);

// ─── 5. Assemble + write ──────────────────────────────────────────────────────
const content = D.placeholder([hero, intro, presets, process, showcase, stats, cta, faq, footer]);
const json = b.assemble({ context: 'et_builder', content, title: 'DiviTheatre - Divi 5 Animation Plugin' });

const OUT = __dirname;
fs.writeFileSync(path.join(OUT, 'divitheatre-landing-page.json'), JSON.stringify(json));

fs.writeFileSync(path.join(OUT, 'divitheatre-seo-meta.json'), JSON.stringify({
  keyword: KW,
  title: 'Divi 5 Animation Plugin | Cinematic Motion - DiviTheatre',
  description: 'DiviTheatre is the Divi 5 animation plugin that adds cinematic, Theatre.js-powered motion to any module - no code. Add fade, stagger & parallax in seconds.',
  slug: 'divi-5-animation-plugin',
}, null, 2));

// FAQPage + SoftwareApplication schema
const faqItems = [
  ['How do I add animations to Divi 5 without code?', 'Install DiviTheatre, then open any module’s Advanced → Attributes panel and add an attribute named data-theatre with a preset value such as fade-up or stagger. No custom JavaScript or CSS required.'],
  ['What is the best animation plugin for Divi 5?', 'DiviTheatre is purpose-built for Divi 5’s block system, using the Theatre.js motion engine for multi-step, choreographed animations that go beyond Divi’s built-in entrance effects.'],
  ['Does DiviTheatre slow down my Divi 5 site?', 'No. The engine is a single IIFE bundle, exits as a no-op when no tagged elements exist, and uses requestAnimationFrame with IntersectionObserver - zero scroll listeners and no layout shift.'],
  ['Will DiviTheatre animations work on mobile and with reduced motion?', 'Yes. Every preset skips below 768px and jumps to its final visible state under prefers-reduced-motion, so content is never hidden.'],
  ['How do I change the animation trigger or timing?', 'Add data-theatre-trigger (onScroll, onLoad, onClick), data-theatre-delay in milliseconds, and data-theatre-duration alongside the data-theatre attribute.'],
];
fs.writeFileSync(path.join(OUT, 'divitheatre-schema.json'), JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'FAQPage',
      mainEntity: faqItems.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    {
      '@type': 'SoftwareApplication',
      name: 'DiviTheatre',
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'WordPress',
      description: 'A Divi 5 animation plugin that adds Theatre.js-powered cinematic motion to any module via a data-theatre attribute.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      publisher: { '@type': 'Organization', name: 'iConnectIT', url: 'https://iconnectit.co.uk' },
    },
  ],
}, null, 2));

console.log('Wrote divitheatre-landing-page.json + seo-meta + schema');
