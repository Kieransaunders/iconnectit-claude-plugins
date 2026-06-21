#!/usr/bin/env node
'use strict';

/*
 * style-check.js — Divi 5 style consistency auditor
 *
 * Compares an original designer Divi 5 export against a newly generated page
 * JSON and verifies that presets, colours, and typography from the original
 * are actually reused — not replaced with new IDs or inline values.
 *
 * Usage:
 *   node style-check.js <original-export.json> <generated-page.json>
 *
 * Exit codes:
 *   0  CONSISTENT (no FAILs)
 *   1  INCONSISTENT (one or more FAILs)
 *   2  Input / parse error
 */

const fs = require('fs');
const path = require('path');

// ─── args ────────────────────────────────────────────────────────────────────
const [, , originalPath, generatedPath] = process.argv;
if (!originalPath || !generatedPath) {
  console.error('Usage: node style-check.js <original-export.json> <generated-page.json>');
  process.exit(2);
}
for (const p of [originalPath, generatedPath]) {
  if (!fs.existsSync(p)) {
    console.error(`✖ File not found: ${p}`);
    process.exit(2);
  }
}

let original, generated;
try { original  = JSON.parse(fs.readFileSync(originalPath,  'utf8')); } catch (e) { console.error(`✖ Cannot parse original: ${e.message}`);  process.exit(2); }
try { generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8')); } catch (e) { console.error(`✖ Cannot parse generated: ${e.message}`); process.exit(2); }

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Recursively walk every value in an object, calling fn(value, path) */
function walk(obj, fn, _path = '') {
  if (obj === null || obj === undefined) return;
  fn(obj, _path);
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, fn, `${_path}[${i}]`));
  } else if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) walk(obj[k], fn, _path ? `${_path}.${k}` : k);
  }
}

/** Extract all values for a given key anywhere in the tree */
function collectByKey(obj, key) {
  const results = [];
  walk(obj, (v, p) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && key in v) {
      results.push({ value: v[key], path: p + '.' + key });
    }
  });
  return results;
}

/** Resolve a Divi $variable(...)$ colour reference to its hex string, or return null */
function resolveColourRef(ref, globalColors) {
  if (typeof ref !== 'string') return null;
  const m = ref.match(/\$variable\(.*?"name"\s*:\s*"(gcid-[^"]+)"/);
  if (!m) return null;
  const id = m[1];
  const entry = globalColors.find((e) => e[0] === id);
  return entry ? entry[1].color : null;
}

/** Extract raw hex colours from a string (handles #xxx and #xxxxxx) */
function extractHex(str) {
  if (typeof str !== 'string') return [];
  return (str.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).map(h => h.toLowerCase());
}

/** Normalise a hex to 6-digit lowercase */
function normHex(h) {
  h = h.toLowerCase().replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return '#' + h;
}

// ─── extract from original ───────────────────────────────────────────────────

// Preset IDs from the original export
const origPresetIds = new Set();
const origPresets = original.presets?.module || {};
for (const [, group] of Object.entries(origPresets)) {
  if (group?.items) {
    for (const id of Object.keys(group.items)) origPresetIds.add(id);
  }
}

// Global colours from original: Map<gcid, hex>
const origColorMap = new Map();   // gcid → hex
const origColorHexSet = new Set(); // all hex values from palette
(original.global_colors || []).forEach((entry) => {
  const [id, meta] = Array.isArray(entry) ? entry : [entry.id, entry];
  if (id && meta?.color) {
    origColorMap.set(id, normHex(meta.color));
    origColorHexSet.add(normHex(meta.color));
  }
});

// Also collect hex colours from preset styleAttrs in original
walk(origPresets, (v) => {
  if (typeof v === 'string') extractHex(v).forEach(h => origColorHexSet.add(normHex(h)));
});

// Font families from original presets
const origFontFamilies = new Set();
walk(origPresets, (v, p) => {
  if ((p.endsWith('.fontFamily') || p.includes('font_family') || p.includes('fontFamily')) && typeof v === 'string' && v.trim()) {
    origFontFamilies.add(v.trim().toLowerCase());
  }
});

// ─── extract from generated ──────────────────────────────────────────────────

// All modulePreset references in generated page
const genPresetRefs = [];  // { presetId, path }
walk(generated, (v, p) => {
  if (typeof v === 'object' && v !== null && 'modulePreset' in v && v.modulePreset) {
    genPresetRefs.push({ presetId: v.modulePreset, path: p });
  }
});

// Count blocks (top-level content items)
let genBlockCount = 0;
walk(generated, (v) => {
  if (typeof v === 'object' && v !== null && v.type && v.attrs) genBlockCount++;
});

// Collect module types in generated page
const genModuleTypes = new Set();
walk(generated, (v) => {
  if (typeof v === 'object' && v !== null && v.type && typeof v.type === 'string') {
    genModuleTypes.add(v.type);
  }
});

// Collect all colour values from generated page
const genColours = []; // { value, isVarRef, resolvedHex, path }
walk(generated, (v, p) => {
  if (typeof v === 'string') {
    if (v.includes('$variable(') && v.includes('gcid-')) {
      const m = v.match(/\$variable\(.*?"name"\s*:\s*"(gcid-[^"]+)"/);
      if (m) {
        const id = m[1];
        const resolvedHex = origColorMap.get(id) || null;
        genColours.push({ value: id, isVarRef: true, resolvedHex, path: p });
      }
    } else {
      extractHex(v).forEach(h => {
        genColours.push({ value: normHex(h), isVarRef: false, resolvedHex: normHex(h), path: p });
      });
    }
  }
});

// Collect font families from generated page (inline overrides)
const genFontFamilies = new Set();
walk(generated, (v, p) => {
  if ((p.endsWith('.fontFamily') || p.includes('font_family') || p.includes('fontFamily')) && typeof v === 'string' && v.trim()) {
    genFontFamilies.add(v.trim().toLowerCase());
  }
});

// Module types with and without preset coverage
const coveredTypes = new Set();
const uncoveredTypes = new Set();
walk(generated, (v) => {
  if (typeof v === 'object' && v !== null && v.type && typeof v.type === 'string') {
    if (v.modulePreset) coveredTypes.add(v.type);
    else uncoveredTypes.add(v.type);
  }
});
// A type is only truly uncovered if it NEVER has a preset reference
for (const t of coveredTypes) uncoveredTypes.delete(t);

// ─── check 1: preset reuse ───────────────────────────────────────────────────
const presetFails = [];
const presetPasses = [];
for (const ref of genPresetRefs) {
  if (origPresetIds.has(ref.presetId)) {
    presetPasses.push(ref);
  } else {
    presetFails.push(ref);
  }
}

// ─── check 2: colour consistency ─────────────────────────────────────────────
const colourNew = [];      // FAIL: not in designer's palette
const colourRawWarn = [];  // WARN: raw hex where designer used gcid- ref
const colourMatch = [];    // PASS

for (const c of genColours) {
  const hex = c.resolvedHex;
  if (!hex) continue;
  if (origColorHexSet.has(hex)) {
    // Colour exists in palette — but was designer's version a var ref?
    if (!c.isVarRef) {
      // Check if designer referenced this colour via gcid
      const hasGcidForThisHex = [...origColorMap.entries()].some(([, h]) => h === hex);
      if (hasGcidForThisHex) {
        colourRawWarn.push(c);
      } else {
        colourMatch.push(c);
      }
    } else {
      colourMatch.push(c);
    }
  } else {
    colourNew.push(c);
  }
}

// ─── check 3: typography consistency ─────────────────────────────────────────
const fontFails = [];
const fontWarns = [];
for (const fam of genFontFamilies) {
  if (!origFontFamilies.has(fam)) {
    fontFails.push(fam);
  }
}
// Inline font overrides on modules that also have a preset are WARN
// (we flag if any inline font family appears at all in generated vs preset-only in original)
// This is a light heuristic — exact detection needs deeper attr traversal
if (genFontFamilies.size > 0 && origFontFamilies.size > 0) {
  for (const fam of genFontFamilies) {
    if (origFontFamilies.has(fam) && fontFails.indexOf(fam) === -1) {
      // Font exists in original but is used inline in generated — WARN if it's alongside a preset
      // (can't distinguish inline-only from preset-inherited at this level without deeper parsing)
      // Only warn if the generated page also has preset refs (otherwise it's expected inline usage)
      if (genPresetRefs.length > 0) fontWarns.push(`"${fam}" appears as inline font — confirm it's preset-inherited, not an inline override`);
    }
  }
}

// ─── structural preset coverage ──────────────────────────────────────────────
// already computed: coveredTypes, uncoveredTypes

// ─── compute verdict ─────────────────────────────────────────────────────────
const fails = [
  ...presetFails.map(r => `Preset reuse — module at ${r.path}: preset "${r.presetId}" not in designer's export`),
  ...colourNew.map(c => `Colour palette — ${c.isVarRef ? 'gcid ref' : 'raw hex'} "${c.value}" at ${c.path} is not in designer's palette`),
  ...fontFails.map(f => `Typography — font family "${f}" not present anywhere in designer's export`),
];
const warns = [
  ...colourRawWarn.map(c => `Colour — raw hex "${c.value}" at ${c.path} matches palette but designer used a gcid- variable ref`),
  ...[...uncoveredTypes].map(t => `Structural — module type "${t}" has no preset reference — will render with Divi defaults`),
  ...fontWarns,
];

const consistent = fails.length === 0;

// ─── report ───────────────────────────────────────────────────────────────────
const line = (n) => '─'.repeat(n);

console.log('');
console.log('STYLE CONSISTENCY REPORT');
console.log('========================');
console.log(`Original export:  ${path.basename(originalPath)}  (${origPresetIds.size} presets, ${origColorMap.size} colours)`);
console.log(`Generated page:   ${path.basename(generatedPath)}  (~${genBlockCount} blocks, ${genPresetRefs.length} preset refs)`);
console.log('');
console.log(`Preset reuse:     ${presetPasses.length}/${genPresetRefs.length} references match designer presets`);
const colourTotal = genColours.length;
const colourMatchCount = colourMatch.length;
const colourNewCount = colourNew.length;
console.log(`Colour palette:   ${colourTotal} colour refs — ${colourMatchCount} match, ${colourNewCount} new`);
const coveredTypesCount = coveredTypes.size;
const totalTypeCount = coveredTypes.size + uncoveredTypes.size;
console.log(`Typography:       ${genFontFamilies.size} font families in generated; ${origFontFamilies.size} in designer presets`);
console.log(`Structural:       ${coveredTypesCount}/${totalTypeCount} module types have designer-preset coverage`);
console.log('');

if (fails.length) {
  console.log(`FAILS (${fails.length}):`);
  fails.forEach(f => console.log(`  ✖ ${f}`));
  console.log('');
}

if (warns.length) {
  console.log(`WARNINGS (${warns.length}):`);
  warns.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');
}

if (!fails.length && !warns.length) {
  console.log('  (no issues found)');
  console.log('');
}

console.log(`VERDICT: ${consistent ? 'CONSISTENT ✓' : 'INCONSISTENT ✖'}`);

if (!consistent) {
  console.log('');
  console.log('To fix — use these from the designer\'s export instead:');
  if (presetFails.length) {
    console.log('  Preset IDs available in original export:');
    for (const id of [...origPresetIds].slice(0, 20)) console.log(`    ${id}`);
    if (origPresetIds.size > 20) console.log(`    … and ${origPresetIds.size - 20} more`);
  }
  if (colourNew.length) {
    console.log('  Colour palette from original export:');
    for (const [id, hex] of origColorMap.entries()) console.log(`    ${id}  ${hex}`);
  }
  if (fontFails.length) {
    console.log('  Font families in original export:');
    for (const f of origFontFamilies) console.log(`    ${f}`);
  }
}

console.log('');
process.exit(consistent ? 0 : 1);
