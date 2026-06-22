#!/usr/bin/env node
/**
 * phase2.test.js — ingest.js + mutate.js regression suite.
 *
 * Run:    node scripts/__tests__/phase2.test.js
 * Exit:   0 = all pass · 1 = any fail
 *
 * Covers:
 *   T1  ingest: outputs all three artefacts
 *   T2  ingest: tokens.js maps are correct (preset names, gcid labels)
 *   T3  ingest: outline.json has correct section count and labels
 *   T4  mutate: text swap appears in output, original is gone
 *   T5  mutate: globalColors hex patch is applied
 *   T6  mutate: preservation contract — exits 1 when a preset ID is removed
 *   T7  mutate: output is valid JSON with the same context as source
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT    = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const EXAMPLES = path.join(ROOT, 'examples');
const INGEST  = path.join(SCRIPTS, 'ingest.js');
const MUTATE  = path.join(SCRIPTS, 'mutate.js');
const SOURCE  = path.join(EXAMPLES, 'iConnectITHomepage.json');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// ─── shared temp dir ─────────────────────────────────────────────────────────

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-'));
const tmpSrc = path.join(tmp, 'test-page.json');
fs.copyFileSync(SOURCE, tmpSrc);

function run(script, args) {
  return spawnSync('node', [script, ...args], { encoding: 'utf8', cwd: ROOT });
}

// ─── T1: ingest outputs all three artefacts ──────────────────────────────────

(function t1() {
  const r = run(INGEST, [tmpSrc]);
  ok('T1: ingest exits 0', r.status === 0, r.stderr || r.stdout);

  const tokens  = path.join(tmp, 'test-page.tokens.js');
  const presets = path.join(tmp, 'test-page.presets.json');
  const outline = path.join(tmp, 'test-page.outline.json');
  ok('T1: tokens.js written',   fs.existsSync(tokens));
  ok('T1: presets.json written', fs.existsSync(presets));
  ok('T1: outline.json written', fs.existsSync(outline));
})();

// ─── T2: tokens.js content ──────────────────────────────────────────────────

(function t2() {
  const tokFile = path.join(tmp, 'test-page.tokens.js');
  if (!fs.existsSync(tokFile)) { ok('T2: tokens.js readable', false, 'file missing'); return; }

  let tok;
  try { tok = require(tokFile); } catch (e) { ok('T2: tokens.js loads as CommonJS', false, e.message); return; }
  ok('T2: tokens.js loads as CommonJS', !!tok);
  ok('T2: __meta.source is set', tok.__meta && tok.__meta.source === 'test-page.json');

  // The iConnectITHomepage has named presets — at least one should appear
  ok('T2: preset map is non-empty', tok.preset && Object.keys(tok.preset).length > 0,
    'keys: ' + (tok.preset ? Object.keys(tok.preset).length : 'undefined'));
  // Spot-check a known preset name
  ok('T2: preset map has "Section - Light Gray"', 'Section - Light Gray' in (tok.preset || {}));
})();

// ─── T3: outline.json content ────────────────────────────────────────────────

(function t3() {
  const outFile = path.join(tmp, 'test-page.outline.json');
  if (!fs.existsSync(outFile)) { ok('T3: outline.json readable', false, 'file missing'); return; }

  let outline;
  try { outline = JSON.parse(fs.readFileSync(outFile, 'utf8')); }
  catch (e) { ok('T3: outline.json is valid JSON', false, e.message); return; }
  ok('T3: outline.json is valid JSON', !!outline);
  ok('T3: outline has source field', outline.source === 'test-page.json');
  ok('T3: outline has 8 sections', Array.isArray(outline.sections) && outline.sections.length === 8,
    'count: ' + (outline.sections && outline.sections.length));

  const labels = (outline.sections || []).map(s => s.adminLabel);
  ok('T3: first section is Hero',   labels[0] === 'Hero');
  ok('T3: last section is Footer',  labels[labels.length - 1] === 'Footer');

  // Hero section should have at least one heading module
  const hero = outline.sections && outline.sections[0];
  const hasHeading = hero && hero.modules && hero.modules.some(m => m.type === 'heading');
  ok('T3: Hero section contains a heading module', hasHeading);
})();

// ─── T4: mutate — text replacement ──────────────────────────────────────────

const changesPath = path.join(tmp, 'changes.json');
const mutatedPath = path.join(tmp, 'test-page-mutated.json');
const FIND_TEXT   = 'Build smarter. Connect faster. Scale effortlessly.';
const REPLACE_TEXT = 'The IT partner that scales with you.';

(function t4() {
  fs.writeFileSync(changesPath, JSON.stringify({
    texts: [{ find: FIND_TEXT, replace: REPLACE_TEXT }],
  }));

  const r = run(MUTATE, [tmpSrc, changesPath, mutatedPath]);
  ok('T4: mutate exits 0', r.status === 0, r.stderr || r.stdout);

  if (!fs.existsSync(mutatedPath)) { ok('T4: output file written', false, 'file missing'); return; }
  ok('T4: output file written', true);

  const out = fs.readFileSync(mutatedPath, 'utf8');
  ok('T4: replacement text appears in output', out.includes(REPLACE_TEXT));
  ok('T4: original text is gone from output',  !out.includes(FIND_TEXT));
})();

// ─── T5: mutate — globalColors hex patch ────────────────────────────────────

(function t5() {
  const src = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (!src.global_colors || !src.global_colors.length) {
    ok('T5: source has global_colors (skip if none)', true);
    return;
  }
  // Use the first real colour entry
  const [firstGcid, firstMeta] = src.global_colors[0];
  const newHex = '#ABCDEF';

  const ch2 = path.join(tmp, 'changes-color.json');
  const out2 = path.join(tmp, 'test-page-color.json');
  fs.writeFileSync(ch2, JSON.stringify({ gcidColors: [{ gcid: firstGcid, hex: newHex }] }));

  const r = run(MUTATE, [tmpSrc, ch2, out2]);
  ok('T5: mutate with gcidColors exits 0', r.status === 0, r.stderr || r.stdout);

  if (!fs.existsSync(out2)) { ok('T5: color-mutated file written', false, 'file missing'); return; }
  const doc = JSON.parse(fs.readFileSync(out2, 'utf8'));
  const entry = (doc.global_colors || []).find(e => e[0] === firstGcid);
  ok('T5: target gcid colour was updated', entry && entry[1] && entry[1].color === newHex,
    `got: ${entry && entry[1] && entry[1].color}`);
  // Other colours unchanged
  if (src.global_colors.length > 1) {
    const [otherGcid, otherMeta] = src.global_colors[1];
    const otherEntry = (doc.global_colors || []).find(e => e[0] === otherGcid);
    ok('T5: non-targeted colour unchanged', otherEntry && otherEntry[1].color === otherMeta.color);
  }
})();

// ─── T6: preservation contract ───────────────────────────────────────────────

(function t6() {
  // Try to overwrite a known preset ID via text replacement — must exit 1
  const src = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const content = list(src.data).map(v => typeof v === 'string' ? v : v.post_content).join('');
  const m = content.match(/"modulePreset":\["([^"]+)"\]/);
  if (!m) { ok('T6: source has modulePreset refs (skip if none)', true); return; }

  const presetId = m[1];
  const ch3 = path.join(tmp, 'changes-break.json');
  const out3 = path.join(tmp, 'test-page-broken.json');
  fs.writeFileSync(ch3, JSON.stringify({ texts: [{ find: presetId, replace: 'DESTROYED' }] }));

  const r = run(MUTATE, [tmpSrc, ch3, out3]);
  ok('T6: mutate exits 1 when preset ID is removed', r.status === 1,
    'exit=' + r.status + ' ' + (r.stdout || '').slice(0, 200));
  ok('T6: output file not written on preservation failure', !fs.existsSync(out3));
  ok('T6: FAIL message mentions the lost preset ID',
    (r.stdout || '').includes(presetId) || (r.stderr || '').includes(presetId));
})();

// ─── T7: output is valid JSON with same context ──────────────────────────────

(function t7() {
  if (!fs.existsSync(mutatedPath)) { ok('T7: mutated file exists', false, 'see T4'); return; }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(mutatedPath, 'utf8')); }
  catch (e) { ok('T7: mutated output is valid JSON', false, e.message); return; }
  ok('T7: mutated output is valid JSON', true);
  ok('T7: context preserved', doc.context === 'et_builder');
  ok('T7: data key preserved', !!doc.data && Object.keys(doc.data).length > 0);
  ok('T7: presets preserved', !!doc.presets && !!doc.presets.module);
})();

// ─── cleanup + report ────────────────────────────────────────────────────────

function list(obj) { return Object.values(obj || {}); }

// Remove temp dir
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n── Phase 2 test results ──');
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) { failures.forEach(f => console.log(f)); process.exit(1); }
