#!/usr/bin/env node
/**
 * example-page.js — Reference generator showing the full pattern:
 * tokens → global colours → presets → sections → assemble → write.
 *
 * Run: node example-page.js   → writes example-landing-page.json + example-seo-meta.json
 * Validate: node ../scripts/validate.js example-landing-page.json --keyword "noloco consultant" --meta example-seo-meta.json
 *
 * NOTE: this file lives inside the skill, so it uses a relative require.
 * Generated scripts live in the USER'S project — require the builder via the
 * absolute skill path instead: require('${CLAUDE_SKILL_DIR}/scripts/divi-builder.js')
 */

'use strict';

const fs = require('fs');
const path = require('path');
const D = require('../scripts/divi-builder');

// ─── 1. Design tokens (from the brief + aesthetic preset) ───────────────────
const T = {
  dark: '#1A1A1A', white: '#FFFFFF', gray: '#F5F5F5',
  accent: '#F95E00', onDarkBody: '#BBBBBB', body: '#555555',
  headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter',
};
const KW = 'Noloco consultant'; // primary keyword from the brief

// ─── 2. Builder + global colours ────────────────────────────────────────────
const b = D.createBuilder();
b.globalColor('accent', T.accent, 'Accent Orange');
b.globalColor('dark', T.dark, 'Dark Base');
b.globalColor('light-bg', T.gray, 'Light Background');

// ─── 3. Presets (one per reused style) ──────────────────────────────────────
const P = {
  sectionDark: b.preset('divi/section', 'Section — Dark', {
    module: { decoration: { background: D.dv({ color: b.colorVar('dark') }), spacing: D.dv({ padding: { top: '7em', bottom: '7em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  sectionWhite: b.preset('divi/section', 'Section — White', {
    module: { decoration: { background: D.dv({ color: T.white }), spacing: D.dv({ padding: { top: '6em', bottom: '6em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  sectionGray: b.preset('divi/section', 'Section — Light Gray', {
    module: { decoration: { background: D.dv({ color: b.colorVar('light-bg') }), spacing: D.dv({ padding: { top: '6em', bottom: '6em', syncVertical: 'on', syncHorizontal: 'off' } }) } },
  }),
  heroH1: b.preset('divi/heading', 'Hero H1', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h1', family: T.headingFont, size: '60px', weight: '700', lineHeight: '1.05em', color: T.white, textAlign: 'center' }, { phone: { size: '36px' } }) } } },
  }),
  sectionH2: b.preset('divi/heading', 'Section H2', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h2', family: T.headingFont, size: '38px', weight: '700', lineHeight: '1.25em', color: T.dark, textAlign: 'center' }, { phone: { size: '28px' } }) } } },
  }),
  bodyOnDark: b.preset('divi/text', 'Body — on dark', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '17px', lineHeight: '1.8em', color: T.onDarkBody, textAlign: 'center' }) } } } },
  }),
  bodyOnLight: b.preset('divi/text', 'Body — on light', {
    content: { decoration: { bodyFont: { body: { font: D.dv({ family: T.bodyFont, size: '16px', lineHeight: '1.8em', color: T.body }) } } } },
  }),
  btnPrimary: b.preset('divi/button', 'Button — Primary', {
    button: { decoration: { font: { font: D.dv({ family: T.bodyFont, size: '16px', color: T.white, weight: '600' }) }, background: D.dv({ color: b.colorVar('accent') }), border: D.dv({ radius: { topLeft: '8px', topRight: '8px', bottomLeft: '8px', bottomRight: '8px', sync: 'on' } }) } },
  }),
  cardBlurb: b.preset('divi/blurb', 'Feature Card', {}),
};

// ─── 4. Sections ────────────────────────────────────────────────────────────
const hero = D.section({ adminLabel: 'Hero', preset: P.sectionDark }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '900px' }, [
    D.column({}, [
      D.eyebrow('iCONNECTIT', T.accent),
      D.heading({ text: 'The Noloco Consultant Who Ships Working Portals, Fast', level: 'h1', preset: P.heroH1 }),
      D.text({ html: `<p>UK-based Noloco consultant building client portals on Airtable — designed, automated and live in weeks, not months.</p>`, preset: P.bodyOnDark, maxWidth: '640px', centered: true }),
      D.button({ text: 'Book a Free Consultation', url: '#contact', preset: P.btnPrimary }),
    ]),
  ]),
]);

const features = D.section({ adminLabel: 'Features', preset: P.sectionGray }, [
  D.row({ structure: 'equal-columns_1' }, [
    D.column({}, [
      D.eyebrow('WHY ICONNECTIT', T.accent),
      D.heading({ text: 'What a Noloco Consultant Should Deliver', level: 'h2', preset: P.sectionH2 }),
    ]),
  ]),
  D.row({ structure: 'equal-columns_3', columnGap: '30px', rowGap: '30px' }, [
    D.column({ flexType: '8_24', background: T.white, padding: '2em', radius: '8px' }, [
      D.blurb({ icon: '&#xf0e7;', iconColor: T.accent, title: 'Portals in Weeks', titleLevel: 'h3', body: 'Working Noloco portal on your real Airtable data inside the first fortnight.', preset: P.cardBlurb }),
    ]),
    D.column({ flexType: '8_24', background: T.white, padding: '2em', radius: '8px' }, [
      D.blurb({ icon: '&#xf013;', iconColor: T.accent, title: 'Automation Built In', titleLevel: 'h3', body: 'Make.com and n8n workflows wired into the portal from day one.', preset: P.cardBlurb }),
    ]),
    D.column({ flexType: '8_24', background: T.white, padding: '2em', radius: '8px' }, [
      D.blurb({ icon: '&#xf2b5;', iconColor: T.accent, title: 'UK SME Focus', titleLevel: 'h3', body: 'Built for UK small businesses — GDPR-aware, plain-English handover.', preset: P.cardBlurb }),
    ]),
  ]),
]);

const faq = D.section({ adminLabel: 'FAQ', preset: P.sectionWhite }, [
  D.row({ structure: 'equal-columns_1', maxWidth: '800px' }, [
    D.column({}, [
      D.heading({ text: 'Noloco Consultant FAQs', level: 'h2', preset: P.sectionH2 }),
      D.accordion([
        { question: 'How much does a Noloco consultant cost in the UK?', answer: 'Typical portal builds range from fixed-price packages to monthly retainers, scoped after a free consultation.' },
        { question: 'How long does a Noloco portal build take?', answer: 'Most client portals go live within 2–6 weeks depending on data complexity and automations.' },
        { question: 'Do you work with existing Airtable bases?', answer: 'Yes — most projects start from an existing base, which gets restructured where needed for portal performance.' },
      ]),
    ]),
  ]),
]);

// ─── 5. Assemble + write ────────────────────────────────────────────────────
const content = D.placeholder([hero, features, faq]);
const json = b.assemble({ context: 'et_builder', content, title: 'Example Landing Page' });
fs.writeFileSync(path.join(__dirname, 'example-landing-page.json'), JSON.stringify(json));

// Companion SEO meta (page settings can't travel in the layout JSON)
fs.writeFileSync(path.join(__dirname, 'example-seo-meta.json'), JSON.stringify({
  keyword: KW,
  title: 'Noloco Consultant UK | Portals Live in Weeks — iConnectIT',
  description: 'UK Noloco consultant building Airtable-backed client portals with automation included. Fixed-price builds live in weeks. Book a free consultation.',
  slug: 'noloco-consultant-uk',
}, null, 2));

console.log('Wrote example-landing-page.json + example-seo-meta.json');
