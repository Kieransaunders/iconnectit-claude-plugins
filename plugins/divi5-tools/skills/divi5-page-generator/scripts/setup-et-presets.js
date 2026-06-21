#!/usr/bin/env node
/**
 * setup-et-presets.js — One-time setup: import the official ET design system presets.
 *
 * Run this once per WordPress site before generating any pages.
 * After this, GET /presets returns stable IDs you can reference by name.
 *
 * Usage:
 *   DTI_KEY=dtik_xxx node scripts/setup-et-presets.js
 *   DTI_KEY=dtik_xxx DTI_URL=http://localhost:10015 node scripts/setup-et-presets.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BASE_URL = process.env.DTI_URL || 'http://localhost:10015';
const KEY      = process.env.DTI_KEY;
if (!KEY) { console.error('Error: DTI_KEY env var required'); process.exit(1); }

const SKILL_DIR   = path.join(__dirname, '..');
const FREEBIE     = path.join(SKILL_DIR, 'references/Divi design system JSON/Divi-5-Launch-Freebie_Presets.json');
const REGISTRY_OUT = path.join(SKILL_DIR, 'references/et-preset-registry.json');

function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(endpoint, BASE_URL);
    const lib = url.protocol === 'https:' ? https : http;
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
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  // ── 1. Load freebie presets ────────────────────────────────────────────────
  if (!fs.existsSync(FREEBIE)) {
    console.error('Error: freebie presets not found at', FREEBIE);
    process.exit(1);
  }
  const freebie = JSON.parse(fs.readFileSync(FREEBIE, 'utf8'));
  const presets = freebie.presets;
  if (!presets?.module) { console.error('Error: unexpected freebie format'); process.exit(1); }

  const totalModules = Object.keys(presets.module).length;
  const totalPresets = Object.values(presets.module).reduce((n, m) => n + Object.keys(m.items || {}).length, 0);
  console.log(`\nImporting ${totalPresets} ET presets across ${totalModules} modules...`);

  // ── 2. Import via preset endpoint ─────────────────────────────────────────
  const importRes = await api('POST', '/wp-json/divi-tools/v1/presets/import', { presets });
  if (importRes.status !== 200) {
    console.error('Import failed:', importRes.body);
    process.exit(1);
  }
  console.log(`  ✓ Imported ${importRes.body.imported_count} presets (${Object.keys(importRes.body.id_mappings || {}).length} IDs remapped)`);

  // ── 3. Fetch and save the registry ────────────────────────────────────────
  const listRes = await api('GET', '/wp-json/divi-tools/v1/presets');
  if (listRes.status !== 200) {
    console.error('Registry fetch failed:', listRes.body);
    process.exit(1);
  }
  const registry = listRes.body.presets;
  const total = Object.values(registry).reduce((n, m) => n + Object.keys(m).length, 0);
  console.log(`  ✓ Registry has ${total} named presets across ${Object.keys(registry).length} modules`);

  // ── 4. Write registry to disk ─────────────────────────────────────────────
  fs.writeFileSync(REGISTRY_OUT, JSON.stringify(registry, null, 2));
  console.log(`  ✓ Registry written to: references/et-preset-registry.json`);

  // ── 5. Summary of key presets ─────────────────────────────────────────────
  console.log('\nKey preset IDs now available:');
  const KEY_PRESETS = [
    ['divi/section', 'Section Preset 1'],
    ['divi/button',  'Filled - Primary Color'],
    ['divi/button',  'Filled - White'],
    ['divi/heading', 'Heading 1'],
    ['divi/heading', 'Heading 2'],
    ['divi/text',    'Dark Text'],
    ['divi/text',    'Light Text'],
    ['divi/column',  'Contained - Dark'],
    ['divi/column',  'Contained - Light'],
  ];
  for (const [mod, name] of KEY_PRESETS) {
    const id = registry[mod]?.[name] || '(not found)';
    console.log(`  ${mod.replace('divi/', '').padEnd(10)} "${name}" → ${id}`);
  }

  console.log('\n✓ ET presets ready. Use in generators:\n');
  console.log('  const registry = require(\'./references/et-preset-registry.json\');');
  console.log('  b.loadPresetRegistry(registry);');
  console.log('  const P = { hero: b.presetRef(\'divi/section\', \'Section Preset 1\') };\n');
})();
