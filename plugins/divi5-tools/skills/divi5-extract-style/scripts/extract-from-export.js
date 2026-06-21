#!/usr/bin/env node
'use strict';

/*
 * extract-from-export.js — Divi 5 export → reusable design tokens
 *
 * Parses a Divi 5 export (et_builder or et_builder_layouts context) and pulls
 * out its design system so the landing-page generator can reference the SAME
 * global colours, global variables and presets that already exist on the site.
 *
 * Why this exists: Divi 5 variables and presets are global, site-level records
 * referenced by id (gcid-…, gvid-…, and random preset ids). A generated page
 * inherits a site's branding for free *as long as it references ids that exist
 * on that install*. The generator already supports this (globalColor reuses a
 * gcid- id; `preset: '<id>'` sets modulePreset directly) — it just had no way
 * to discover the ids. This produces them.
 *
 * Usage:
 *   node extract-from-export.js <export.json> [--out <dir>] [--name <brand>]
 *
 * Emits (into --out, default = export's directory):
 *   <name>.variables.json  Importable Global Variables (Divi → Import Global Variables).
 *                          Seeds a FRESH site with the colours + variables.
 *   <name>.tokens.js       require()-able module for generate-<brand>.js:
 *                            colorRef[label]   → ready $variable(...)$ colour string
 *                            colorId[label]    → gcid- id
 *                            colorHex[id]      → resolved hex (or {derived} note)
 *                            variableRef[label]→ ready $variable(...)$ content string
 *                            variableId[label] → gvid- id
 *                            preset[name]      → preset id (pass as `preset:` in builder)
 *                            presetList        → full [{id,name,moduleName,kind,groupId}]
 *   <name>.presets.json    Raw preset definitions (module + group) for reference / re-import.
 *
 * Also prints a human-readable report to stdout.
 */

const fs = require('fs');
const path = require('path');

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
  console.log('Usage: node extract-from-export.js <export.json> [--out <dir>] [--name <brand>]');
  process.exit(argv.length ? 0 : 1);
}
const input = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out' && argv[argv.indexOf(a) - 1] !== '--name');
function flag(name) {
  const i = argv.indexOf('--' + name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
}
if (!input || !fs.existsSync(input)) {
  console.error(`✖ Export file not found: ${input || '(none)'}`);
  process.exit(1);
}
const outDir = flag('out') || path.dirname(path.resolve(input));
const brand = (flag('name') || path.basename(input).replace(/\.json$/i, '')).trim();
const safe = brand.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'export';

// ─── load ────────────────────────────────────────────────────────────────────
let doc;
try {
  doc = JSON.parse(fs.readFileSync(input, 'utf8'));
} catch (e) {
  console.error(`✖ Could not parse JSON: ${e.message}`);
  process.exit(1);
}

const kebab = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ─── global colours ──────────────────────────────────────────────────────────
// Entries are [id, {color,label,status,...}] tuples. `color` is either a raw
// hex/rgba or a derived `$variable(...)$` reference to another gcid.
function parseVariableRef(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/^\$variable\((\{[\s\S]*\})\)\$$/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

const rawColors = Array.isArray(doc.global_colors) ? doc.global_colors : [];
const colors = rawColors.map(([id, def]) => {
  def = def || {};
  const ref = parseVariableRef(def.color);
  return {
    id,
    label: def.label || id,
    raw: def.color,
    derived: !!ref,
    derivedFrom: ref ? (ref.value && ref.value.name) : null,
    derivedSettings: ref ? (ref.value && ref.value.settings) : null,
    status: def.status || 'active',
    folder: def.folder || '',
  };
});
const colorById = Object.fromEntries(colors.map((c) => [c.id, c]));

// Resolve a colour id to a concrete hex where possible (follows one derivation hop chain).
function resolveHex(id, seen = new Set()) {
  const c = colorById[id];
  if (!c || seen.has(id)) return null;
  seen.add(id);
  if (!c.derived) return c.raw;
  return c.derivedFrom ? resolveHex(c.derivedFrom, seen) : null;
}

// ─── global variables ────────────────────────────────────────────────────────
const rawVars = Array.isArray(doc.global_variables) ? doc.global_variables : [];
const variables = rawVars.map((v) => ({
  id: v.id,
  label: v.label || v.id,
  value: v.value,
  type: v.type || 'numbers',
  status: v.status || 'active',
}));

// ─── presets (module + group) ────────────────────────────────────────────────
function collectPresets(bucket, kind) {
  const out = [];
  if (!bucket || typeof bucket !== 'object') return out;
  for (const [containerName, container] of Object.entries(bucket)) {
    const items = (container && container.items) || {};
    const def = container && container.default;
    for (const [id, p] of Object.entries(items)) {
      out.push({
        id,
        name: p.name || id,
        kind, // 'module' | 'group'
        moduleName: p.moduleName || containerName,
        groupName: kind === 'group' ? (p.groupName || containerName) : null,
        groupId: p.groupId || null,
        isDefault: id === def,
      });
    }
  }
  return out;
}
const presetList = [
  ...collectPresets(doc.presets && doc.presets.module, 'module'),
  ...collectPresets(doc.presets && doc.presets.group, 'group'),
];

// ─── build token module ──────────────────────────────────────────────────────
const colorRef = {};   // label → ready-to-use $variable colour string
const colorId = {};    // label → gcid- id
const colorHex = {};   // id    → resolved hex (string) or {derived} marker
for (const c of colors) {
  colorRef[c.label] = `$variable({"type":"color","value":{"name":"${c.id}","settings":{}}})$`;
  colorId[c.label] = c.id;
  const hex = resolveHex(c.id);
  colorHex[c.id] = c.derived ? { derived: true, from: c.derivedFrom, settings: c.derivedSettings, resolvesTo: hex } : hex;
}

const variableRef = {}; // label → ready-to-use $variable content string
const variableId = {};  // label → gvid- id
for (const v of variables) {
  variableRef[v.label] = `$variable({"type":"content","value":{"name":"${v.id}","settings":{}}})$`;
  variableId[v.label] = v.id;
}

const preset = {};      // name → id (last wins on collision; presetList has the full picture)
for (const p of presetList) preset[p.name] = p.id;

const tokens = {
  __meta: { source: path.basename(input), brand, extractedAt: new Date().toISOString() },
  colorRef, colorId, colorHex,
  variableRef, variableId,
  variableValue: Object.fromEntries(variables.map((v) => [v.label, v.value])),
  preset,
  presetList,
};

// ─── importable variables JSON (style-variables shape) ───────────────────────
const variablesImport = {
  context: 'et_builder',
  data: {},
  presets: { module: {} },
  global_colors: rawColors,            // preserved verbatim (keeps derivation + folders)
  global_variables: rawVars,           // preserved verbatim
  images: {},
  thumbnails: [],
};

// ─── presets JSON (reference / re-import) ────────────────────────────────────
const presetsImport = {
  context: 'et_builder_layouts',
  presets: doc.presets || { module: {}, group: {} },
};

// ─── write ───────────────────────────────────────────────────────────────────
fs.mkdirSync(outDir, { recursive: true });
const fVars = path.join(outDir, `${safe}.variables.json`);
const fTokens = path.join(outDir, `${safe}.tokens.js`);
const fPresets = path.join(outDir, `${safe}.presets.json`);

fs.writeFileSync(fVars, JSON.stringify(variablesImport, null, 2));
fs.writeFileSync(fTokens, 'module.exports = ' + JSON.stringify(tokens, null, 2) + ';\n');
fs.writeFileSync(fPresets, JSON.stringify(presetsImport, null, 2));

// ─── report ──────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`\nDivi 5 design-system extract — ${brand}`);
console.log(`source: ${path.basename(input)}   context: ${doc.context || '?'}\n`);

console.log(`Global colours (${colors.length})`);
console.log('  ' + pad('id', 22) + pad('label', 20) + 'value');
for (const c of colors) {
  const val = c.derived ? `derived ← ${c.derivedFrom}${c.derivedSettings && Object.keys(c.derivedSettings).length ? ' ' + JSON.stringify(c.derivedSettings) : ''}` : c.raw;
  console.log('  ' + pad(c.id, 22) + pad(c.label, 20) + val);
}

console.log(`\nGlobal variables (${variables.length})`);
console.log('  ' + pad('id', 22) + pad('label', 14) + pad('type', 9) + 'value');
for (const v of variables) console.log('  ' + pad(v.id, 22) + pad(v.label, 14) + pad(v.type, 9) + v.value);

console.log(`\nPresets (${presetList.length})`);
console.log('  ' + pad('id', 14) + pad('kind', 8) + pad('name', 16) + pad('module', 16) + 'group');
for (const p of presetList) {
  console.log('  ' + pad(p.id, 14) + pad(p.kind, 8) + pad(p.name, 16) + pad(p.moduleName, 16) + (p.groupId || '') + (p.isDefault ? '  (default)' : ''));
}

console.log(`\nWrote:`);
console.log(`  ${fVars}`);
console.log(`  ${fTokens}`);
console.log(`  ${fPresets}`);
console.log(`\nReuse: require('./${safe}.tokens.js') in generate-<brand>.js, then`);
console.log(`  b.globalColor(T.colorId['Primary Color'], T.colorHex[T.colorId['Primary Color']], 'Primary Color')  // or drop T.colorRef['Primary Color'] straight into any color field`);
console.log(`  heading({ ..., preset: T.preset['h1'] })   // binds modulePreset to the existing id`);
