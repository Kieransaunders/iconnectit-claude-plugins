#!/usr/bin/env node
/**
 * smoke.test.js — end-to-end "is the system alive" check.
 *
 * Runs the full generate -> validate pipeline on the canonical example and
 * asserts the minimum invariants that mean the skill is usable:
 *   - modules load
 *   - builder API assembles a valid doc from each module constructor
 *   - example generator runs without throwing
 *   - validator exits 0 on the generated output
 *   - generated content round-trips through the block parser
 *
 * Run:    node scripts/__tests__/smoke.test.js
 * Exit:   0 = smoke passes · 1 = smoke fails (system is broken)
 *
 * Intentionally shallow and fast. Deep per-task coverage lives in
 * phase0.test.js. Run smoke first; if it fails, the deeper suite's results
 * aren't meaningful.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const EXAMPLES = path.join(ROOT, 'examples');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ─── 1. Modules load ─────────────────────────────────────────────────────────

let D, glyphs;
try {
  D = require(path.join(SCRIPTS, 'divi-builder.js'));
  ok('divi-builder.js loads', !!D.createBuilder && typeof D.htmlContent === 'function');
} catch (e) { ok('divi-builder.js loads', false, e.message); }
try {
  glyphs = require(path.join(SCRIPTS, 'glyphs.js'));
  ok('glyphs.js loads', typeof glyphs.buildGlyphRe === 'function' && typeof glyphs.DEFAULT_GLYPH_SOURCE === 'string');
} catch (e) { ok('glyphs.js loads', false, e.message); }
ok('validate.js exists on disk', fs.existsSync(path.join(SCRIPTS, 'validate.js')));

// ─── 2. Builder API smoke — every public module constructor ──────────────────

try {
  const b = D.createBuilder();
  b.globalColor('test', '#000000', 'Test');
  const pid = b.preset('divi/heading', 'Test', {});
  const content = D.placeholder([
    D.section({ preset: pid, theatre: 'fade-up' }, [
      D.row({ structure: 'equal-columns_1' }, [
        D.column({}, [
          D.heading({ text: 'Smoke H1', level: 'h1' }),
          D.text({ html: '<p>body</p>' }),
          D.eyebrow('EYEBROW', '#F95E00'),
          D.button({ text: 'Go', url: '#go' }),
          D.blurb({ title: 'Blurb', body: 'blurb body', icon: '&#xf000;' }),
          D.image({ src: 'https://example.com/x.png', alt: 'smoke' }),
          D.icon({ unicode: '&#xf000;', color: '#000' }),
          D.numberCounter({ title: 'count', number: 7 }),
          D.divider({ show: false, height: '10px' }),
          D.accordion([{ question: 'q?', answer: 'a' }]),
        ]),
      ]),
    ]),
  ]);
  const json = b.assemble({ context: 'et_builder', content, title: 'Smoke' });
  ok('builder: every public module constructor assembles without error',
    json.context === 'et_builder' && typeof json.data['1'] === 'string' && json.data['1'].length > 0);
  ok('builder: theatre attrs survived (T3 canonical path)',
    /"name":"data-theatre","value":"fade-up","targetElement":"main"/.test(json.data['1']));
} catch (e) {
  ok('builder: every public module constructor assembles without error', false, e.message);
}

// ─── 3. Generate the canonical example ───────────────────────────────────────

const gen = spawnSync('node', [path.join(EXAMPLES, 'example-divitheatre-page.js')], {
  encoding: 'utf8', cwd: ROOT,
});
ok('example-divitheatre-page.js runs clean (exit 0)', gen.status === 0,
  gen.stderr ? gen.stderr.slice(0, 200) : '');
const pagePath = path.join(EXAMPLES, 'divitheatre-landing-page.json');
ok('example output JSON written', fs.existsSync(pagePath));

// ─── 4. Validate the generated page ──────────────────────────────────────────

if (fs.existsSync(pagePath)) {
  const val = spawnSync('node', [
    path.join(SCRIPTS, 'validate.js'),
    pagePath,
    '--keyword', 'Divi 5 animation plugin',
    '--meta', path.join(EXAMPLES, 'divitheatre-seo-meta.json'),
  ], { encoding: 'utf8', cwd: ROOT });

  ok('validate.js exits 0 on the canonical example', val.status === 0,
    'exit=' + val.status + (val.stdout ? '\n' + val.stdout.slice(-400) : ''));
  ok('validate.js reports 0 errors', /0 error\(s\), 0 warning\(s\)/.test(val.stdout));
  ok('validate.js: JSON parses', /PASS\s+JSON parses/.test(val.stdout));
  ok('validate.js: hierarchy + balance checked',
    /PASS\s+\d+ blocks parsed, hierarchy \+ balance checked/.test(val.stdout));
  ok('validate.js: TASTE rule passes', /PASS\s+TASTE:/.test(val.stdout));
  ok('validate.js: exactly one h1', /PASS\s+SEO: exactly one h1/.test(val.stdout));
  ok('validate.js: preset references resolved', /PASS\s+\d+ preset references checked/.test(val.stdout));
  ok('validate.js: global colour references resolved', /PASS\s+\d+ global colours defined/.test(val.stdout));
}

// ─── 5. Round-trip generated content through the block parser ────────────────

if (fs.existsSync(pagePath)) {
  try {
    const doc = JSON.parse(fs.readFileSync(pagePath, 'utf8'));
    const content = doc.data['1'];
    const re = /<!--\s*(\/?)wp:divi\/([a-z-]+)(\s+(\{[\s\S]*?\}))?\s*(\/?)-->/g;
    let blocks = 0, m;
    while ((m = re.exec(content)) !== null) if (!m[1]) blocks++;
    ok('generated content: many divi blocks parse', blocks > 50, 'blocks=' + blocks);
    ok('generated content: starts with placeholder',
      /^<!--\s+wp:divi\/placeholder\s*-->/.test(content));
    ok('generated content: balanced (ends by closing placeholder)',
      /<!--\s+\/wp:divi\/placeholder\s*-->\s*$/.test(content));
  } catch (e) {
    ok('generated content round-trips through block parser', false, e.message);
  }
}

// ─── report ─────────────────────────────────────────────────────────────────

console.log('\n── Smoke test results ──');
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) {
  failures.forEach(f => console.log(f));
  console.log('');
  process.exit(1);
}
process.exit(0);
