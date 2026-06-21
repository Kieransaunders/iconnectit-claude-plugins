#!/usr/bin/env node
/**
 * preset-first-workflow.js — Example of the recommended 2-step workflow.
 *
 * Step 1: Import preset pack → presets registered, CSS generated, IDs returned
 * Step 2: Fetch registry → generate page using real IDs → import page only
 *
 * This is more reliable than importing presets + page together because:
 * - Divi generates CSS for presets immediately when save_data() is called
 * - No ID remapping in the page content
 * - Re-importing a page never re-registers presets (no stale preset accumulation)
 *
 * Usage:
 *   DTI_KEY=dtik_xxx node examples/preset-first-workflow.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.DTI_URL || 'http://localhost:10015';
const KEY      = process.env.DTI_KEY;
if (!KEY) { console.error('DTI_KEY env var required'); process.exit(1); }

const SKILL_DIR = path.join(__dirname, '..');
const D = require(path.join(SKILL_DIR, 'scripts/divi-builder.js'));
const TOKENS = require(path.join(SKILL_DIR, 'references/Divi design system JSON/divi-design-system.tokens.js'));

// ── Helper: REST call ─────────────────────────────────────────────────────────
function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'X-Divi-Tools-Key': KEY,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Step 1: Define and import the preset pack ─────────────────────────────────
async function importPresetPack() {
  console.log('\n── Step 1: Importing preset pack ────────────────────────────────');

  const b = D.createBuilder({ tokens: TOKENS });

  // Design tokens
  const T = {
    cream:  '#fdf7f2',
    ink:    '#2a2420',
    accent: '#c9715a',
    muted:  '#7d6e67',
    white:  '#ffffff',
    serif:  'DM Serif Display',
    sans:   'DM Sans',
  };

  // Register custom global colours
  const WHITE = b.globalColor('white',  T.white,  'White');
  const MUTED = b.globalColor('muted',  T.muted,  'Muted');
  const ACCENT = b.globalColor('accent', T.accent, 'Terracotta');
  const INK    = b.globalColor('ink',    T.ink,    'Ink');

  // Define presets — background colors use RAW HEX (required for preset CSS generation)
  // Font/text colors can use variable refs (resolved at render time)
  b.preset('divi/section', 'Section – Cream',  { module: { decoration: { background: D.dv({ color: T.cream }),  spacing: D.dv({ padding: { top: '90px', bottom: '90px', syncVertical: 'on', syncHorizontal: 'off' } }) } } });
  b.preset('divi/section', 'Section – Ink',    { module: { decoration: { background: D.dv({ color: T.ink }),    spacing: D.dv({ padding: { top: '90px', bottom: '90px', syncVertical: 'on', syncHorizontal: 'off' } }) } } });
  b.preset('divi/section', 'Section – Accent', { module: { decoration: { background: D.dv({ color: T.accent }), spacing: D.dv({ padding: { top: '14px', bottom: '14px', syncVertical: 'on', syncHorizontal: 'off' } }) } } });

  b.preset('divi/button', 'Button – Primary', { button: { decoration: {
    button:     D.dv({ enable: 'on' }),
    font:       { font: D.dv({ family: T.sans, size: '16px', color: WHITE, weight: '600' }) },
    background: D.dv({ color: T.accent }),
    border:     D.dv({ radius: { topLeft: '999px', topRight: '999px', bottomLeft: '999px', bottomRight: '999px', sync: 'on' } }),
    spacing:    D.dv({ padding: { top: '16px', bottom: '16px', left: '36px', right: '36px', syncVertical: 'on', syncHorizontal: 'off' } }),
  } } });

  b.preset('divi/heading', 'Hero H1', { title: { decoration: { font: { font: D.dv(
    { headingLevel: 'h1', family: T.serif, size: '62px', weight: '400', lineHeight: '1.08em', color: INK, letterSpacing: '-0.02em', textAlign: 'left' },
    { phone: { size: '38px' } }
  ) } } } });

  b.preset('divi/text', 'Body', { content: { decoration: { bodyFont: { body: { font: D.dv({
    family: T.sans, size: '17px', lineHeight: '1.7em', color: MUTED, textAlign: 'left',
  }) } } } } });

  // Extract just the presets + global colours from assemble()
  const assembled = b.assemble({ context: 'et_builder', content: '', title: '', slug: '' });

  const result = await api('POST', '/wp-json/divi-tools/v1/presets/import', {
    presets: assembled.presets,
  });

  console.log(`  Imported ${result.imported_count} presets`);
  console.log(`  ID mappings: ${Object.keys(result.id_mappings || {}).length} remapped`);
  if (result.warnings?.length) console.log('  Warnings:', result.warnings);

  return result;
}

// ── Step 2: Fetch registry ────────────────────────────────────────────────────
async function fetchRegistry() {
  console.log('\n── Step 2: Fetching preset registry ────────────────────────────');

  const result = await api('GET', '/wp-json/divi-tools/v1/presets');
  const total = Object.values(result.presets || {}).reduce((n, m) => n + Object.keys(m).length, 0);
  console.log(`  ${total} presets registered across ${Object.keys(result.presets || {}).length} modules`);

  return result.presets;
}

// ── Step 3: Generate page using registry IDs ──────────────────────────────────
function generatePage(registry) {
  console.log('\n── Step 3: Generating page with registry IDs ───────────────────');

  const b = D.createBuilder({ tokens: TOKENS });
  b.loadPresetRegistry(registry);

  // Reference existing presets by name — no new registration, no ID remapping
  const P = {
    secCream:  b.presetRef('divi/section', 'Section – Cream'),
    secInk:    b.presetRef('divi/section', 'Section – Ink'),
    secAccent: b.presetRef('divi/section', 'Section – Accent'),
    btnPrimary: b.presetRef('divi/button', 'Button – Primary'),
    heroH1:    b.presetRef('divi/heading', 'Hero H1'),
    body:      b.presetRef('divi/text',    'Body'),
  };

  // Build a minimal example page
  const sections = [
    D.section({ adminLabel: 'Hero', preset: P.secCream }, [
      D.row({ structure: 'equal-columns_1', maxWidth: '900px' }, [
        D.column({}, [
          D.heading({ text: 'Preset-first workflow example', level: 'h1', preset: P.heroH1 }),
          D.text({ html: '<p>This page was generated using presets already registered on the site.</p>', preset: P.body }),
          D.button({ text: 'Get Started', url: '#', preset: P.btnPrimary }),
        ]),
      ]),
    ]),
    D.section({ adminLabel: 'Strip', preset: P.secAccent }, [
      D.row({ structure: 'equal-columns_1', maxWidth: '900px' }, [
        D.column({}, [
          D.text({ html: '<p style="text-align:center;color:#ffffff">Social proof strip</p>' }),
        ]),
      ]),
    ]),
    D.section({ adminLabel: 'Dark CTA', preset: P.secInk }, [
      D.row({ structure: 'equal-columns_1', maxWidth: '900px' }, [
        D.column({}, [
          D.text({ html: '<p style="text-align:center;color:#ffffff">Dark ink section</p>' }),
        ]),
      ]),
    ]),
  ];

  // When using presetRef(), assemble with empty presets — page doesn't re-register
  const layout = b.assemble({
    context: 'et_builder',
    content: D.placeholder(sections),
    title: 'Preset First Example',
    slug: 'preset-first-example',
  });

  // Omit presets from layout — they're already on the site, no re-registration needed
  delete layout.presets;

  console.log(`  Generated ${sections.length} sections referencing existing preset IDs`);
  return layout;
}

// ── Step 4: Import page ───────────────────────────────────────────────────────
async function importPage(layout) {
  console.log('\n── Step 4: Importing page ───────────────────────────────────────');

  const result = await api('POST', '/wp-json/divi-tools/v1/import', {
    layout,
    seo: { title: 'Preset First Example', slug: 'preset-first-example' },
    publish: false,
  });

  console.log(`  Action: ${result.action}`);
  console.log(`  Presets imported: ${result.presets_imported} (should be false — none sent)`);
  console.log(`  Preview: ${result.preview_url}`);
  if (result.warnings?.length) console.log('  Warnings:', result.warnings);
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await importPresetPack();
    const registry = await fetchRegistry();
    const layout   = generatePage(registry);
    await importPage(layout);
    console.log('\n✓ Done\n');
  } catch (e) {
    console.error('\n✗ Error:', e.message);
    process.exit(1);
  }
})();
