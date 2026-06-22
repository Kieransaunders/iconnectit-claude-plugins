#!/usr/bin/env node
'use strict';
/**
 * ingest.js — Extract design-system artefacts from a Divi 5 export JSON.
 *
 * Usage: node ingest.js <export.json>
 *
 * Outputs alongside the input file:
 *   <name>.tokens.js     — colorRef/colorId/colorHex/variableRef/preset maps
 *   <name>.presets.json  — full presets subtree (validator + builder input)
 *   <name>.outline.json  — section-by-section map (adminLabel, modules, copy)
 */

const fs   = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('Usage: node ingest.js <export.json>'); process.exit(1); }

const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const dir  = path.dirname(path.resolve(file));
const base = path.basename(file, '.json');

// ─── Tokens ──────────────────────────────────────────────────────────────────

const colorRef = {}, colorId = {}, colorHex = {};
for (const entry of (doc.global_colors || [])) {
  // global_colors is an array of [gcid, {color, status, label}] tuples
  const [gcid, meta] = Array.isArray(entry) ? entry : [entry.id, entry];
  if (!gcid || !meta) continue;
  const label = meta.label || gcid;
  colorId[label]  = gcid;
  colorHex[gcid]  = meta.color;
  colorRef[label] = `$variable({"type":"color","value":{"name":"${gcid}","settings":{}}})$`;
}

const variableRef = {}, variableId = {}, variableValue = {};
for (const v of (doc.global_variables || [])) {
  if (!v || !v.id) continue;
  const label = v.label || v.id;
  variableRef[label]   = `$variable({"type":"${v.type || 'numbers'}","value":{"name":"${v.id}","settings":{}}})$`;
  variableId[label]    = v.id;
  variableValue[label] = v.value;
}

const preset = {};
const mod = (doc.presets && doc.presets.module) || {};
// Flat structure: presets.module.items (presets-only export)
// Nested structure: presets.module['divi/section'].items (page export)
const allItems = mod.items
  ? mod.items
  : Object.values(mod).reduce((acc, v) => Object.assign(acc, (v && v.items) || {}), {});
for (const [id, meta] of Object.entries(allItems)) {
  if (meta && meta.name) preset[meta.name] = id;
}

const tokensPath = path.join(dir, `${base}.tokens.js`);
fs.writeFileSync(tokensPath, `module.exports = ${JSON.stringify({
  __meta: { source: path.basename(file), brand: base, extractedAt: new Date().toISOString() },
  colorRef, colorId, colorHex,
  variableRef, variableId, variableValue,
  preset,
}, null, 2)};\n`);
console.log(`✓ ${path.relative(process.cwd(), tokensPath)}`);

// ─── Presets ──────────────────────────────────────────────────────────────────

const presetsPath = path.join(dir, `${base}.presets.json`);
fs.writeFileSync(presetsPath, JSON.stringify(
  { context: doc.context, presets: doc.presets || { module: {} } },
  null, 2
));
console.log(`✓ ${path.relative(process.cwd(), presetsPath)}`);

// ─── Outline ──────────────────────────────────────────────────────────────────

function parseBlocks(content) {
  const tokens = [];
  const re = /<!--\s*(\/?)wp:divi\/([a-z-]+)(\s+(\{[\s\S]*?\}))?\s*(\/?)-->/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let attrs = null;
    if (m[4]) { try { attrs = JSON.parse(m[4]); } catch (_) {} }
    tokens.push({ closing: m[1] === '/', name: m[2], attrs, self: m[5] === '/' });
  }
  return tokens;
}

// Extract first readable text from a block attrs object
function getText(attrs) {
  if (!attrs) return '';
  const s = JSON.stringify(attrs);
  let m;
  // heading/text innerContent
  m = s.match(/"innerContent":\{"desktop":\{"value":"([^"]{1,200})"/);
  if (m) return m[1].replace(/\\[rnt]/g, ' ').replace(/\\u[0-9a-f]{4}/gi, '?').trim();
  // text module value.text
  m = s.match(/"innerContent":\{"desktop":\{"value":\{"text":"([^"]{1,200})"/);
  if (m) return m[1].replace(/\\[rnt]/g, ' ').trim();
  // button text
  m = s.match(/"text":\{"desktop":\{"value":"([^"]{1,80})"/);
  if (m) return m[1];
  return '';
}

const SKIP = new Set(['row', 'column', 'placeholder', 'group']);
const sections = [];

for (const [key, val] of Object.entries(doc.data || {})) {
  const content = typeof val === 'string' ? val : (val && val.post_content) || '';
  const tokens  = parseBlocks(content);
  let sect = null;

  for (const t of tokens) {
    if (t.closing) {
      if (t.name === 'section' && sect) { sections.push(sect); sect = null; }
      continue;
    }
    if (t.name === 'section') {
      const al = t.attrs &&
        t.attrs.module && t.attrs.module.meta &&
        t.attrs.module.meta.adminLabel &&
        t.attrs.module.meta.adminLabel.desktop &&
        t.attrs.module.meta.adminLabel.desktop.value;
      const presetId = t.attrs && Array.isArray(t.attrs.modulePreset) ? t.attrs.modulePreset[0] : null;
      sect = { adminLabel: al || '(unlabelled)', presetId: presetId || null, modules: [] };
      continue;
    }
    if (!sect || SKIP.has(t.name)) continue;

    const entry = { type: t.name };
    if (t.name === 'heading') {
      const s = JSON.stringify(t.attrs || '');
      entry.level = (s.match(/"headingLevel":"(h[1-6])"/) || [])[1] || 'h2';
      entry.text  = getText(t.attrs);
    } else if (t.name === 'button') {
      const s = JSON.stringify(t.attrs || '');
      const bm = s.match(/"text":\{"desktop":\{"value":"([^"]+)"/);
      entry.text = bm ? bm[1] : '';
    } else {
      const preview = getText(t.attrs).slice(0, 120);
      if (preview) entry.preview = preview;
    }
    sect.modules.push(entry);
  }
}

const outlinePath = path.join(dir, `${base}.outline.json`);
fs.writeFileSync(outlinePath, JSON.stringify({ source: path.basename(file), sections }, null, 2));
console.log(`✓ ${path.relative(process.cwd(), outlinePath)}`);
console.log(`   ${sections.length} sections: ${sections.map(s => s.adminLabel).join(', ')}`);
