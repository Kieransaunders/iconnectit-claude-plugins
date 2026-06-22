#!/usr/bin/env node
/**
 * phase4b.test.js — fixture suite for known past bugs.
 *
 * Run:    node scripts/__tests__/phase4b.test.js
 * Exit:   0 = all pass · 1 = any fail
 *
 * Each test builds a minimal Divi 5 JSON containing one known-bad pattern,
 * runs the validator, and asserts the expected FAIL message appears.
 * All tests run without WordPress — just the validator and builder.
 *
 * Bugs covered (from plan §4B):
 *   B1  Phantom preset ID — modulePreset ref to an ID not in presets
 *   B2  Unbalanced block comments — section opened but never closed
 *   B3  Module outside column — heading directly in section (hierarchy violation)
 *   B4  Em-dash in copy — taste rule
 *   B5  Raw hex matching ET token — TOKEN rule
 *   B6  Missing h1 — SEO rule
 *   B7  Two h1s — SEO rule (also a common AI mistake)
 *
 * Gaps (not yet caught by validator — documented here as known blind spots):
 *   GAP-A  Button without decoration.button: { enable:'on' } — renders default blue
 *   GAP-B  codeBlock([]) passed array instead of null — emits open+close not self-close
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPTS  = path.resolve(__dirname, '..');
const VALIDATE = path.join(SCRIPTS, 'validate.js');
const D        = require(path.join(SCRIPTS, 'divi-builder.js'));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// Write a doc to a temp file, run the validator, return { status, stdout }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase4b-'));
function validate(doc, extra = []) {
  const f = path.join(tmp, `fixture-${pass + fail}.json`);
  fs.writeFileSync(f, JSON.stringify(doc));
  const r = spawnSync('node', [VALIDATE, f, ...extra], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout || '' };
}

// Minimal valid page skeleton (passes the validator when content is sound)
function page(content, presets = {}) {
  return {
    context: 'et_builder',
    data: { '1': content },
    presets: { module: presets },
    global_colors: [],
    global_variables: [],
    images: {},
    thumbnails: [],
  };
}

// A passing baseline — confirm the scaffold itself is clean
function baseline() {
  const b = D.createBuilder();
  const pid = b.preset('divi/section', 'Test Section', {});
  const content = D.placeholder([
    D.section({ preset: pid, adminLabel: 'Hero' }, [
      D.row({}, [
        D.column({}, [
          D.heading({ text: 'Hello world', level: 'h1' }),
        ]),
      ]),
    ]),
  ]);
  return b.assemble({ context: 'et_builder', content, title: 'Test' });
}

// ─── Baseline ────────────────────────────────────────────────────────────────

(function b0() {
  const { status } = validate(baseline());
  ok('B0: baseline fixture passes validator', status === 0);
})();

// ─── B1: Phantom preset ID ───────────────────────────────────────────────────

(function b1() {
  // Preset declared as 'divi/section' in items, but block references a different ID
  const doc = page(
    `<!-- wp:divi/placeholder -->\n` +
    `<!-- wp:divi/section {"modulePreset":["PHANTOM-ID"],"builderVersion":"5.0.0-public-beta.9.1"} -->\n` +
    `<!-- wp:divi/row {"builderVersion":"5.0.0-public-beta.9.1"} -->\n` +
    `<!-- wp:divi/column {"builderVersion":"5.0.0-public-beta.9.1"} -->\n` +
    `<!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"Hello"}}},"module":{"advanced":{"text":{"text":{"desktop":{"value":{"headingLevel":"h1"}}}}}},"builderVersion":"5.0.0-public-beta.9.1"} /-->\n` +
    `<!-- /wp:divi/column -->\n<!-- /wp:divi/row -->\n<!-- /wp:divi/section -->\n<!-- /wp:divi/placeholder -->`,
    { 'divi/section': { default: 'REAL-ID', items: { 'REAL-ID': { id: 'REAL-ID', name: 'Section', moduleName: 'divi/section', version: '5.0.0', type: 'module', created: 0, updated: 0, attrs: {} } } } }
  );
  const { status, out } = validate(doc);
  ok('B1: phantom preset ID exits 1', status === 1, 'exit=' + status);
  ok('B1: error names the phantom ID', out.includes('PHANTOM-ID'), out.slice(-200));
})();

// ─── B2: Unbalanced block comments ───────────────────────────────────────────

(function b2() {
  const doc = page(
    `<!-- wp:divi/placeholder -->\n` +
    `<!-- wp:divi/section {"builderVersion":"5.0.0-public-beta.9.1"} -->\n` +
    // section never closed
    `<!-- /wp:divi/placeholder -->`
  );
  const { status, out } = validate(doc);
  ok('B2: unbalanced blocks exits 1', status === 1, 'exit=' + status);
  ok('B2: error mentions balance/closing', /[Uu]nbalanced|closing|stack/i.test(out), out.slice(-200));
})();

// ─── B3: Module outside column ───────────────────────────────────────────────

(function b3() {
  const doc = page(
    `<!-- wp:divi/placeholder -->\n` +
    `<!-- wp:divi/section {"builderVersion":"5.0.0-public-beta.9.1"} -->\n` +
    // heading placed directly in section, skipping row + column
    `<!-- wp:divi/heading {"builderVersion":"5.0.0-public-beta.9.1"} /-->\n` +
    `<!-- /wp:divi/section -->\n<!-- /wp:divi/placeholder -->`
  );
  const { status, out } = validate(doc);
  ok('B3: module outside column exits 1', status === 1, 'exit=' + status);
  ok('B3: error mentions hierarchy', /column|group|child|inside/i.test(out), out.slice(-200));
})();

// ─── B4: Em-dash in copy ─────────────────────────────────────────────────────

(function b4() {
  const b = D.createBuilder();
  const pid = b.preset('divi/section', 'S', {});
  const content = D.placeholder([
    D.section({ preset: pid }, [
      D.row({}, [
        D.column({}, [
          D.heading({ text: 'Great results — every time', level: 'h1' }),
        ]),
      ]),
    ]),
  ]);
  const doc = b.assemble({ context: 'et_builder', content, title: 'T' });
  const { status, out } = validate(doc);
  ok('B4: em-dash in copy exits 1', status === 1, 'exit=' + status);
  ok('B4: TASTE error in output', /TASTE|em.dash|en.dash/i.test(out), out.slice(-200));
})();

// ─── B5: Raw hex matching ET token ───────────────────────────────────────────

(function b5() {
  // #0C71C3 is the ET "Primary Color" token — using it raw in a heading font should FAIL
  const tokenFile = path.join(SCRIPTS, '..', 'references', 'Divi design system JSON', 'divi-design-system.tokens.js');
  if (!fs.existsSync(tokenFile)) { ok('B5: ET tokens file present', false, 'missing'); return; }
  const T = require(tokenFile);
  // Pick any ET colour
  const hex = Object.values(T.colorHex)[0];
  if (!hex) { ok('B5: ET colorHex non-empty', false); return; }

  const b = D.createBuilder();
  const spid = b.preset('divi/section', 'S', {});
  // Embed the raw hex in a heading preset font color — the TOKEN check scans preset-inlined attrs
  const hpid = b.preset('divi/heading', 'BadH1', {
    title: { decoration: { font: { font: D.dv({ headingLevel: 'h1', color: hex }) } } },
  });
  const content = D.placeholder([
    D.section({ preset: spid }, [
      D.row({}, [
        D.column({}, [
          D.heading({ text: 'Hello world', level: 'h1', preset: hpid }),
        ]),
      ]),
    ]),
  ]);
  const doc = b.assemble({ context: 'et_builder', content, title: 'T' });
  const { status, out } = validate(doc);
  ok('B5: raw ET-token hex exits 1', status === 1, 'exit=' + status);
  ok('B5: TOKEN error in output', /TOKEN/i.test(out), out.slice(-200));
})();

// ─── B6: Missing h1 ──────────────────────────────────────────────────────────

(function b6() {
  const b = D.createBuilder();
  const pid = b.preset('divi/section', 'S', {});
  const content = D.placeholder([
    D.section({ preset: pid }, [
      D.row({}, [
        D.column({}, [
          D.heading({ text: 'A subheading only', level: 'h2' }),
        ]),
      ]),
    ]),
  ]);
  const doc = b.assemble({ context: 'et_builder', content, title: 'T' });
  const { status, out } = validate(doc);
  ok('B6: missing h1 exits 1', status === 1, 'exit=' + status);
  ok('B6: SEO h1 error in output', /h1|heading/i.test(out), out.slice(-200));
})();

// ─── B7: Two h1s ─────────────────────────────────────────────────────────────

(function b7() {
  const b = D.createBuilder();
  const pid = b.preset('divi/section', 'S', {});
  const content = D.placeholder([
    D.section({ preset: pid }, [
      D.row({}, [
        D.column({}, [
          D.heading({ text: 'First h1',  level: 'h1' }),
          D.heading({ text: 'Second h1', level: 'h1' }),
        ]),
      ]),
    ]),
  ]);
  const doc = b.assemble({ context: 'et_builder', content, title: 'T' });
  const { status, out } = validate(doc);
  ok('B7: duplicate h1 exits 1', status === 1, 'exit=' + status);
  ok('B7: SEO error mentions h1 count', /h1|heading/i.test(out), out.slice(-200));
})();

// ─── B8: Button preset without enable:'on' ───────────────────────────────────

(function b8() {
  const b = D.createBuilder();
  // Register a button module preset WITHOUT enable:'on'
  const bpid = b.preset('divi/button', 'BadButton', {
    button: { decoration: { background: { desktop: { value: { color: '#0000ff' } } } } },
  });
  const spid = b.preset('divi/section', 'S', {});
  const content = D.placeholder([
    D.section({ preset: spid }, [
      D.row({}, [
        D.column({}, [
          D.heading({ text: 'Title', level: 'h1' }),
          D.button({ text: 'Click me', preset: bpid }),
        ]),
      ]),
    ]),
  ]);
  const doc = b.assemble({ context: 'et_builder', content, title: 'T' });
  const { status, out } = validate(doc);
  ok('B8: button preset without enable:"on" exits 1', status === 1, 'exit=' + status);
  ok('B8: BUTTON error in output', /BUTTON/i.test(out), out.slice(-200));
})();

// ─── Gap still open ──────────────────────────────────────────────────────────
console.log('\n  NOTE  GAP-B: codeBlock([]) array arg is NOT caught by the validator');
console.log('        Emits open+close tags instead of self-closing. Fix: builder should throw on [] arg.');

// ─── Cleanup + report ────────────────────────────────────────────────────────

fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n── Phase 4B test results ──');
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) { failures.forEach(f => console.log(f)); process.exit(1); }
