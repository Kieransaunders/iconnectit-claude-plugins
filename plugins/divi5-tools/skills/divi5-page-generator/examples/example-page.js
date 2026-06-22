#!/usr/bin/env node
/**
 * example-page.js — Reference generator showing taste-compliant layout patterns:
 * split hero, image-led gallery, split process, vertical FAQ.
 *
 * Quality bar: references/floria-top.png + layout-patterns.md
 * Run: node example-page.js   → writes example-landing-page.json + example-seo-meta.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const D = require('../scripts/divi-builder');
const TOKENS = require('../references/Divi design system JSON/divi-design-system.tokens.js');

const T = {
  dark: '#0D0D12',
  white: '#FFFFFF',
  gray: '#F5F5F5',
  accent: '#F95E00',
  onDarkBody: '#BBBBBB',
  body: '#555555',
  headingFont: 'Plus Jakarta Sans',
  bodyFont: 'Source Sans 3',
};
const KW = 'Noloco consultant';
const HERO_IMG = 'https://picsum.photos/seed/noloco-portal-dashboard/900/1100';
const FEAT_IMGS = [
  'https://picsum.photos/seed/noloco-client-portal/600/800',
  'https://picsum.photos/seed/airtable-automation-workflow/600/800',
  'https://picsum.photos/seed/uk-sme-dashboard/600/800',
];
const PROCESS_IMG = 'https://picsum.photos/seed/noloco-build-process/800/900';

const b = D.createBuilder({ tokens: TOKENS });

// Brand-specific colours (NOT in ET design system) — registered as global colours
const PRIMARY   = b.globalColor('brand-primary',  '#F95E00', 'Brand Primary');
const DARK      = b.globalColor('brand-dark',      '#0D0D12', 'Brand Dark');
const BODY_DARK = b.globalColor('brand-body-dark', '#BBBBBB', 'Brand Body Dark');

// ET design-system colour references (resolved via token map)
const WHITE   = b.colorRef('White');
const GRAY_BG = b.colorRef('Background - Light Gray');

// Keep legacy slugs so P.* presets that use b.colorVar() still work
b.globalColor('accent', T.accent, 'Accent Orange');
b.globalColor('dark', T.dark, 'Dark Base');
b.globalColor('light-bg', T.gray, 'Light Background');

const P = {
  sectionDark: b.preset('divi/section', 'Section — Dark', {
    module: { decoration: { background: D.dv({ color: b.colorVar('dark') }), spacing: D.dv({ padding: { top: '6em', bottom: '6em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  sectionWhite: b.preset('divi/section', 'Section — White', {
    module: { decoration: { background: D.dv({ color: WHITE }), spacing: D.dv({ padding: { top: '6em', bottom: '6em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  sectionGray: b.preset('divi/section', 'Section — Light Gray', {
    module: { decoration: { background: D.dv({ color: b.colorVar('light-bg') }), spacing: D.dv({ padding: { top: '6em', bottom: '6em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  heroH1: b.preset('divi/heading', 'Hero H1 — left', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h1', family: T.headingFont, size: '56px', weight: '700', lineHeight: '1.08em', color: WHITE, textAlign: 'left' }, { phone: { size: '36px' } }) } } },
  }),
  sectionH2: b.preset('divi/heading', 'Section H2 — left', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h2', family: T.headingFont, size: '38px', weight: '700', lineHeight: '1.25em', color: DARK, textAlign: 'left' }, { phone: { size: '28px' } }) } } },
  }),
  sectionH2Light: b.preset('divi/heading', 'Section H2 — on dark', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h2', family: T.headingFont, size: '38px', weight: '700', lineHeight: '1.25em', color: WHITE, textAlign: 'left' }, { phone: { size: '28px' } }) } } },
  }),
  cardH3: b.preset('divi/heading', 'Card H3', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h3', family: T.headingFont, size: '22px', weight: '600', lineHeight: '1.3em', color: T.dark, textAlign: 'left' }) } } },
  }),
  bodyOnDark: b.preset('divi/text', 'Body — on dark', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '17px', lineHeight: '1.8em', color: T.onDarkBody, textAlign: 'left' }) } } } },
  }),
  bodyOnLight: b.preset('divi/text', 'Body — on light', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '16px', lineHeight: '1.8em', color: T.body, textAlign: 'left' }) } } } },
  }),
  caption: b.preset('divi/text', 'Image caption', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '14px', lineHeight: '1.5em', color: T.onDarkBody, textAlign: 'left' }) } } } },
  }),
  btnPrimary: b.preset('divi/button', 'Button — Primary pill', {
    button: { decoration: { button: D.dv({ enable: 'on' }), font: { font: D.dv({ family: T.bodyFont, size: '16px', color: T.dark, weight: '600' }) }, background: D.dv({ color: WHITE }), border: D.dv({ radius: { topLeft: '999px', topRight: '999px', bottomLeft: '999px', bottomRight: '999px', sync: 'on' } }) } },
  }),
  btnGhost: b.preset('divi/button', 'Button — Ghost', {
    button: { decoration: { button: D.dv({ enable: 'on' }), font: { font: D.dv({ family: T.bodyFont, size: '16px', color: WHITE, weight: '500' }) }, background: D.dv({ color: 'transparent' }) } },
  }),
};

// A0 — Dark hero with overlay (token-aware demo: colorRef + overlaySection)
const darkHero = D.overlaySection({
  image: { src: HERO_IMG },
  overlay: { color: b.colorRef('Background Overlay - Dark'), opacity: 0.82, blend: 'multiply' },
  padding: { top: '8vw', bottom: '8vw' },
  adminLabel: 'Hero (overlay variant)',
}, [
  D.row({}, [
    D.column({ width: 50 }, [
      D.heading({ text: 'Build faster with tokens', color: WHITE, level: 'h1' }),
      D.text({ content: '<p>Design system colours, resolved server-side by Divi.</p>', color: WHITE }),
    ]),
  ]),
]);

// A — Asymmetric split hero (Floria pattern)
// DiviTheatre motion (uncomment ONLY if user confirmed DiviTheatre installed):
//   add  theatre: 'hero-reveal', theatreOpts: { trigger: 'onLoad' }  to the section opts
//   add  theatre: 'fade-up', theatreOpts: { trigger: 'onScroll' }  to heading/text opts
const hero = D.section({ adminLabel: 'Hero', preset: P.sectionDark }, [
  D.row({ structure: 'equal-columns_2', alignItems: 'center', maxWidth: '1200px', columnGap: '48px' }, [
    D.column({ flexType: '12_24' }, [
      D.eyebrow('UK NOLOCO STUDIO', T.accent, { textAlign: 'left' }),
      D.heading({ text: 'The Noloco Consultant Who Ships Portals in Weeks', level: 'h2', preset: P.heroH1 }),
      D.text({
        html: '<p>UK Noloco consultant building Airtable-backed portals with automation included. Fixed scope, live in weeks.</p>',
        preset: P.bodyOnDark,
        maxWidth: '480px',
      }),
      D.button({ text: 'Book a Consultation', url: '#contact', preset: P.btnPrimary }),
      D.button({ text: 'See Example Builds', url: '#features', preset: P.btnGhost }),
    ]),
    D.column({ flexType: '12_24' }, [
      D.image({ src: HERO_IMG, alt: 'Noloco client portal dashboard on a laptop in a modern UK office' }),
    ]),
  ]),
]);

// B — Image-led gallery (not three equal icon blurbs)
// DiviTheatre motion (uncomment ONLY if user confirmed DiviTheatre installed):
//   add  theatre: 'stagger', theatreOpts: { trigger: 'onScroll' }  to the 3-column row opts
const features = D.section({ adminLabel: 'Features', preset: P.sectionDark }, [
  D.row({ structure: 'equal-columns_2', maxWidth: '1200px', columnGap: '24px' }, [
    D.column({ flexType: '16_24' }, [
      D.heading({ text: 'What a Noloco Consultant Should Deliver', level: 'h2', preset: P.sectionH2Light }),
      D.text({ html: '<p>Real portals on your data, not slide decks. Each build ships with automations wired in.</p>', preset: P.bodyOnDark, maxWidth: '520px' }),
    ]),
    D.column({ flexType: '8_24' }, [
      D.text({ html: '<p><a href="#contact" style="color:#fff;text-decoration:none;">View full capability list →</a></p>', preset: P.caption }),
    ]),
  ]),
  D.row({ structure: 'equal-columns_3', columnGap: '24px', rowGap: '24px', maxWidth: '1200px' }, [
    D.column({ flexType: '8_24' }, [
      D.image({ src: FEAT_IMGS[0], alt: 'Branded Noloco client portal with project status view' }),
      D.text({ html: '<p><strong>Portals in Weeks</strong><br>Live on your Airtable base inside the first fortnight.</p>', preset: P.caption }),
    ]),
    D.column({ flexType: '8_24' }, [
      D.image({ src: FEAT_IMGS[1], alt: 'Make.com automation workflow connected to a Noloco portal' }),
      D.text({ html: '<p><strong>Automation Built In</strong><br>Make.com and n8n flows wired from day one.</p>', preset: P.caption }),
    ]),
    D.column({ flexType: '8_24' }, [
      D.image({ src: FEAT_IMGS[2], alt: 'UK small business team reviewing a client portal together' }),
      D.text({ html: '<p><strong>UK SME Focus</strong><br>GDPR-aware builds with plain-English handover.</p>', preset: P.caption }),
    ]),
  ]),
]);

// C — Split process narrative
const process = D.section({ adminLabel: 'Process', preset: P.sectionGray }, [
  D.row({ structure: 'equal-columns_2', alignItems: 'center', maxWidth: '1200px', columnGap: '48px' }, [
    D.column({ flexType: '12_24' }, [
      D.image({ src: PROCESS_IMG, alt: 'Consultant mapping Airtable fields to a Noloco portal layout' }),
    ]),
    D.column({ flexType: '12_24' }, [
      D.heading({ text: 'How We Build Your Portal', level: 'h2', preset: P.sectionH2 }),
      D.text({ html: '<p>Three focused phases. No mystery months.</p>', preset: P.bodyOnLight, maxWidth: '480px' }),
      D.text({ html: '<p style="font-size:13px;letter-spacing:2px;color:#888;">01</p>', preset: P.bodyOnLight }),
      D.heading({ text: 'Discovery and Data Audit', level: 'h3', preset: P.cardH3 }),
      D.text({ html: '<p>We map your Airtable base, users, and automations before design starts.</p>', preset: P.bodyOnLight }),
      D.text({ html: '<p style="font-size:13px;letter-spacing:2px;color:#888;">02</p>', preset: P.bodyOnLight }),
      D.heading({ text: 'Portal Build and Automations', level: 'h3', preset: P.cardH3 }),
      D.text({ html: '<p>Branded Noloco portal on your live data with Make.com or n8n connected.</p>', preset: P.bodyOnLight }),
      D.text({ html: '<p style="font-size:13px;letter-spacing:2px;color:#888;">03</p>', preset: P.bodyOnLight }),
      D.heading({ text: 'Launch and Handover', level: 'h3', preset: P.cardH3 }),
      D.text({ html: '<p>Training, documentation, and a support window so your team owns it.</p>', preset: P.bodyOnLight }),
    ]),
  ]),
]);

// G — Vertical stack FAQ
const faq = D.section({ adminLabel: 'FAQ', preset: P.sectionWhite }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '800px' }, [
    D.column({}, [
      D.heading({ text: 'Noloco Consultant FAQs', level: 'h2', preset: P.sectionH2 }),
      D.accordion([
        { question: 'How much does a Noloco consultant cost in the UK?', answer: 'Typical portal builds range from fixed-price packages to monthly retainers, scoped after a free consultation.' },
        { question: 'How long does a Noloco portal build take?', answer: 'Most client portals go live within 2-6 weeks depending on data complexity and automations.' },
        { question: 'Do you work with existing Airtable bases?', answer: 'Yes, most projects start from an existing base, which gets restructured where needed for portal performance.' },
      ]),
    ]),
  ]),
]);

const content = D.placeholder([darkHero, hero, features, process, faq]);
const json = b.assemble({ context: 'et_builder', content, title: 'Example Landing Page' });
fs.writeFileSync(path.join(__dirname, 'example-landing-page.json'), JSON.stringify(json));

fs.writeFileSync(path.join(__dirname, 'example-seo-meta.json'), JSON.stringify({
  keyword: KW,
  title: 'Noloco Consultant UK | Portals Live in Weeks | iConnectIT',
  description: 'UK Noloco consultant building Airtable-backed client portals with automation included. Fixed-price builds live in weeks. Book a free consultation.',
  slug: 'noloco-consultant-uk',
}, null, 2));

console.log('Wrote example-landing-page.json + example-seo-meta.json');
