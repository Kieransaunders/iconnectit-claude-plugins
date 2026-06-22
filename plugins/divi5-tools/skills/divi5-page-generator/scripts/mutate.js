#!/usr/bin/env node
'use strict';
/**
 * mutate.js — Apply targeted changes to a Divi 5 export JSON.
 *
 * Usage: node mutate.js <export.json> <changes.json> [output.json]
 *
 * changes.json schema:
 * {
 *   "texts":        [{ "find": "old copy", "replace": "new copy" }],
 *   "globalColors": [{ "label": "Accent Color", "hex": "#FF6B35" }],
 *   "gcidColors":   [{ "gcid": "gcid-accent", "hex": "#FF6B35" }]
 * }
 *
 * Preservation contract: every preset ID from the source must survive in the output.
 * Exit 1 if any are lost (never silently mutate structural IDs).
 *
 * Output: <output.json> or <name>-mutated.json alongside the source.
 */

const fs   = require('fs');
const path = require('path');

const [exportFile, changesFile, outArg] = process.argv.slice(2);
if (!exportFile || !changesFile) {
  console.error('Usage: node mutate.js <export.json> <changes.json> [output.json]');
  process.exit(1);
}

const doc     = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
const changes = JSON.parse(fs.readFileSync(changesFile, 'utf8'));

// ─── Preservation snapshot ───────────────────────────────────────────────────

// Scan raw content strings (block-comment format) — not the outer serialised JSON
// because content is double-escaped inside JSON.stringify(doc).
const PRESET_RE = /"modulePreset":\["([^"]+)"\]/g;
function collectPresetsFromDoc(d) {
  const ids = new Set();
  for (const val of Object.values(d.data || {})) {
    const content = typeof val === 'string' ? val : (val && val.post_content) || '';
    for (const m of content.matchAll(PRESET_RE)) ids.add(m[1]);
  }
  return ids;
}

let ser = JSON.stringify(doc);
const sourcePresets = collectPresetsFromDoc(doc);

// ─── Text replacements ───────────────────────────────────────────────────────

for (const { find, replace } of (changes.texts || [])) {
  if (!find) { console.warn('WARN: texts entry missing "find" — skipped'); continue; }
  // Use JSON-encoded find so we match within the serialised string correctly
  const needle  = JSON.stringify(find).slice(1, -1);   // strip outer quotes
  const repl    = JSON.stringify(replace || '').slice(1, -1);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re      = new RegExp(escaped, 'g');
  const before  = ser;
  ser = ser.replace(re, repl);
  const count = (before.match(re) || []).length;
  if (!count) console.warn(`WARN: text "${find.slice(0, 50)}" not found in export`);
  else        console.log(`  text (${count}×): "${find.slice(0, 40)}" → "${(replace || '').slice(0, 40)}"`);
}

// ─── Global colour changes ───────────────────────────────────────────────────
// Both globalColors (by label) and gcidColors (by gcid) patch the same array.
// We re-parse here so text replacements above don't corrupt the parse.

const labelChanges = changes.globalColors || [];
const gcidChanges  = changes.gcidColors   || [];

if (labelChanges.length || gcidChanges.length) {
  const d = JSON.parse(ser);
  for (const entry of (d.global_colors || [])) {
    const [gcid, meta] = Array.isArray(entry) ? entry : [entry.id, entry];
    if (!meta) continue;
    for (const { label, hex } of labelChanges) {
      if (meta.label === label) { meta.color = hex; console.log(`  globalColor: "${label}" → ${hex}`); }
    }
    for (const { gcid: g, hex } of gcidChanges) {
      if (gcid === g) { meta.color = hex; console.log(`  gcidColor: ${g} → ${hex}`); }
    }
  }
  ser = JSON.stringify(d);
}

// ─── Preservation check ──────────────────────────────────────────────────────

const outputPresets = collectPresetsFromDoc(JSON.parse(ser));
const lost = [...sourcePresets].filter(id => !outputPresets.has(id));
if (lost.length) {
  console.error(`\nFAIL: ${lost.length} preset ID(s) were removed by mutation:`);
  for (const id of lost) console.error(`  - ${id}`);
  console.error('Mutations must not alter structural preset IDs. Aborting.');
  process.exit(1);
}
console.log(`✓ Preservation: all ${sourcePresets.size} preset ID(s) intact`);

// ─── Write ───────────────────────────────────────────────────────────────────

const outFile = outArg || path.join(
  path.dirname(path.resolve(exportFile)),
  `${path.basename(exportFile, '.json')}-mutated.json`
);
fs.writeFileSync(outFile, JSON.stringify(JSON.parse(ser), null, 2));
console.log(`✓ ${path.relative(process.cwd(), outFile)}`);
