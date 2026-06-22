#!/usr/bin/env node
/**
 * phase0.test.js — Phase 0 regression + behaviour assertions.
 *
 * Run:    node scripts/__tests__/phase0.test.js
 * Exit:   0 = all assertions pass · 1 = one or more failed
 *
 * Covers:
 *   T1  tokensByKey population (source + validator-report regression)
 *   T2  configurable glyph set: default unchanged + --ban-glyphs override works
 *   T3  theatreAttrs() sole-writer guard: throw on advanced.attributes /
 *       advanced map; migrate canonical-map; canonical theatre attrs survive
 *   T4  raw-quote mechanism: builder round-trip + htmlContent() idempotence
 *   T5  single-source glyph default: one definition, two importers
 *   T6  baseline regression: validate.js report on the shipped example is
 *       byte-identical to the captured baseline
 *
 * Baseline (/tmp/phase0-baseline.txt) was captured BEFORE any Phase 0 edits
 * by running:
 *   node examples/example-divitheatre-page.js
 *   node scripts/validate.js examples/divitheatre-landing-page.json \
 *     --keyword "Divi 5 animation plugin" --meta examples/divitheatre-seo-meta.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const EXAMPLES = path.join(ROOT, 'examples');
const D = require(path.join(SCRIPTS, 'divi-builder.js'));
const glyphs = require(path.join(SCRIPTS, 'glyphs.js'));

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
function eq(name, actual, expected) {
  const cond = actual === expected;
  ok(name, cond, cond ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function throws(name, fn) {
  let threw = false, msg = '';
  try { fn(); } catch (e) { threw = true; msg = e.message; }
  ok(name + ' (throws)', threw, threw ? '' : 'did not throw');
  return msg;
}

/** Run validate.js; return stdout regardless of exit code. */
function runValidate(args, opts) {
  const r = spawnSync('node', [path.join(SCRIPTS, 'validate.js'), ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    ...opts,
  });
  return r.stdout == null ? '' : r.stdout;
}

// ─── T1: tokensByKey population (source + runtime regression) ─────────────────

(function t1() {
  const src = fs.readFileSync(path.join(SCRIPTS, 'validate.js'), 'utf8');
  ok('T1: validate.js populates tokensByKey[key] inside the content loop',
    /tokensByKey\[key\]\s*=\s*tokens/.test(src),
    'expected `tokensByKey[key] = tokens` assignment in source');
  ok('T1: validate.js declares tokensByKey as a module-scope map',
    /const\s+tokensByKey\s*=\s*\{\s*\}/.test(src),
    'expected `const tokensByKey = {}` declaration');
  ok('T1: validate.js does NOT add a render-safety require in this phase',
    !/require\(['"]\.\/render-safety['"]\)/.test(src),
    'render-safety require appeared — Phase 0 forbids it');
})();

// ─── T2: configurable glyph set ──────────────────────────────────────────────

(function t2() {
  // (a) Default source unchanged.
  eq('T2: glyphs.DEFAULT_GLYPH_SOURCE is dashes-only', glyphs.DEFAULT_GLYPH_SOURCE, '—–');

  // (b) Default regex matches em-dash, en-dash and their HTML entities.
  const defaultRe = glyphs.buildGlyphRe();
  ok('T2: default regex matches em-dash literal', defaultRe.test('hello — world'));
  defaultRe.lastIndex = 0;
  ok('T2: default regex matches en-dash literal', defaultRe.test('hello – world'));
  defaultRe.lastIndex = 0;
  ok('T2: default regex matches &mdash; entity', defaultRe.test('hello &mdash; world'));
  defaultRe.lastIndex = 0;
  ok('T2: default regex matches &#x2013; entity', defaultRe.test('hello &#x2013; world'));
  defaultRe.lastIndex = 0;
  ok('T2: default regex does NOT match ASCII hyphen', !defaultRe.test('hello - world'));
  defaultRe.lastIndex = 0;
  ok('T2: default regex does NOT match ellipsis by default', !defaultRe.test('hello … world'));

  // (c) --ban-glyphs "…" override adds the ellipsis to the set and drops the
  //     default entity forms (override = literals only, per design).
  const overrideRe = glyphs.buildGlyphRe('…');
  ok('T2: override regex matches the ellipsis', overrideRe.test('hello … world'));
  overrideRe.lastIndex = 0;
  ok('T2: override regex does NOT match em-dash (not in override set)',
    !overrideRe.test('hello — world'));

  // (d) End-to-end: a fixture with ellipsis FAILs under --ban-glyphs "…" and
  //     PASSes under the default. Built with the proper section/row/column
  //     wrapper so structural validation is clean and only TASTE is at issue.
  const ellipsisContent = D.placeholder([
    D.section({}, [ D.row({}, [ D.column({}, [
      D.text({ html: '<p>ellipsis here …</p>' }),
    ]) ]) ]),
  ]);
  const ellipsisDoc = { context: 'et_builder', data: { '1': ellipsisContent } };
  const tmp = path.join(require('os').tmpdir(), 'phase0-t2-ellipsis.json');
  fs.writeFileSync(tmp, JSON.stringify(ellipsisDoc));
  const defaultReport = runValidate([tmp]);
  const overrideReport = runValidate([tmp, '--ban-glyphs', '…']);
  ok('T2: ellipsis PASSes under default glyph set', /PASS\s+TASTE:/.test(defaultReport));
  ok('T2: ellipsis FAILs under --ban-glyphs "…" (TASTE rule fires on the ellipsis)',
    /FAIL\s+TASTE:/.test(overrideReport) && overrideReport.includes('ellipsis'));
})();

// ─── T3: theatreAttrs() sole-writer guard ────────────────────────────────────

(function t3() {
  const B = D.createBuilder();

  // (a) Canonical theatre path: theatreAttrs output passes through untouched.
  const sectionNormal = D.section({ theatre: 'fade-up' }, []);
  ok('T3: canonical theatreAttrs output survives (section builds)',
    /wp:divi\/section /.test(sectionNormal));
  // Section may be self-closing or open/close; the attrs JSON ends at the first
  // `}` followed by either `-->` (open) or ` /-->` (self-closing).
  const attrsJsonMatch = sectionNormal.match(/wp:divi\/section\s+(\{[\s\S]*?\})\s*(?:\/)?-->/);
  let normalAttrs = null;
  if (attrsJsonMatch) {
    try { normalAttrs = JSON.parse(attrsJsonMatch[1]); } catch (e) { /* fall through */ }
  }
  const list = normalAttrs && normalAttrs.module &&
    normalAttrs.module.decoration && normalAttrs.module.decoration.attributes &&
    normalAttrs.module.decoration.attributes.desktop && normalAttrs.module.decoration.attributes.desktop.value &&
    normalAttrs.module.decoration.attributes.desktop.value.attributes;
  ok('T3: canonical output is Array<{name,value,targetElement:"main"}>',
    Array.isArray(list) && list.length === 1 &&
    list[0].name === 'data-theatre' && list[0].value === 'fade-up' &&
    list[0].targetElement === 'main',
    'got: ' + JSON.stringify(list));

  // (b) module.advanced.attributes (old location) → throws.
  const advMsg = throws('T3: module.advanced.attributes', () =>
    D.section({ attrs: { module: { advanced: { attributes: { 'data-theatre': 'fade-up' } } } } }, []));
  ok('T3: throw message names module.advanced.attributes',
    /module\.advanced\.attributes/.test(advMsg), 'got: ' + advMsg);

  // (c) top-level advanced.attributes → throws.
  const topMsg = throws('T3: advanced.attributes (top-level)', () =>
    D.section({ attrs: { advanced: { attributes: { 'data-theatre': 'fade-up' } } } }, []));
  ok('T3: throw message names advanced.attributes',
    /advanced\.attributes/.test(topMsg), 'got: ' + topMsg);

  // (d) module.decoration.attributes.desktop.value.attributes as a key->value
  //     map → migrated to canonical array shape.
  const migrated = D.section({
    attrs: {
      module: {
        decoration: {
          attributes: {
            desktop: { value: { attributes: { 'data-theatre': 'fade-up' } } },
          },
        },
      },
    },
  }, []);
  const migratedMatch = migrated.match(/wp:divi\/section\s+(\{[\s\S]*?\})\s*(?:\/)?-->/);
  let migratedAttrs = null;
  if (migratedMatch) {
    try { migratedAttrs = JSON.parse(migratedMatch[1]); } catch (e) { /* fall through */ }
  }
  const migratedList = migratedAttrs && migratedAttrs.module &&
    migratedAttrs.module.decoration && migratedAttrs.module.decoration.attributes &&
    migratedAttrs.module.decoration.attributes.desktop && migratedAttrs.module.decoration.attributes.desktop.value &&
    migratedAttrs.module.decoration.attributes.desktop.value.attributes;
  ok('T3: key->value map migrated to canonical array',
    Array.isArray(migratedList) && migratedList.length === 1 &&
    migratedList[0].name === 'data-theatre' && migratedList[0].value === 'fade-up' &&
    migratedList[0].targetElement === 'main',
    'got: ' + JSON.stringify(migratedList));

  // (e) wrong element shape inside the array → throws.
  throws('T3: array of non-canonical objects', () =>
    D.section({
      attrs: {
        module: {
          decoration: {
            attributes: {
              desktop: { value: { attributes: [{ weird: 'shape' }] } },
            },
          },
        },
      },
    }, []));
})();

// ─── T4: raw-quote mechanism + htmlContent() ─────────────────────────────────

(function t4() {
  // (a) htmlContent — basic: literal " in text + double-quoted attrs.
  eq('T4: htmlContent converts double-quoted attrs to single-quoted',
    D.htmlContent('<p><a href="x">y</a></p>'),
    "<p><a href='x'>y</a></p>");
  eq('T4: htmlContent escapes literal " in text nodes',
    D.htmlContent('<p>He said "hi"</p>'),
    '<p>He said &quot;hi&quot;</p>');
  eq('T4: htmlContent handles both attr and text in one input',
    D.htmlContent('<p>He said "hi" and href="x"</p>'),
    "<p>He said &quot;hi&quot; and href='x'</p>");

  // (b) pass-through: &quot;, &#34;, single-quoted attrs, $variable(...)$.
  eq('T4: htmlContent preserves &quot; entity',
    D.htmlContent('<p>data-theatre=&quot;fade-up&quot;</p>'),
    '<p>data-theatre=&quot;fade-up&quot;</p>');
  eq('T4: htmlContent preserves &#34; entity',
    D.htmlContent('<p>&#34;hi&#34;</p>'),
    '<p>&#34;hi&#34;</p>');
  eq('T4: htmlContent preserves single-quoted attrs',
    D.htmlContent("<p><a href='https://x'>y</a></p>"),
    "<p><a href='https://x'>y</a></p>");
  eq('T4: htmlContent preserves $variable(...)$ token',
    D.htmlContent('<p>$variable({"type":"color","value":{"name":"gcid-x"}})$</p>'),
    '<p>$variable({"type":"color","value":{"name":"gcid-x"}})$</p>');

  // (c) idempotence on a battery of inputs.
  const idempInputs = [
    '<p>He said "hi" and href="x"</p>',
    '<p><a href="y">z</a></p>',
    '<p>data-theatre=&quot;fade-up&quot;</p>',
    "<p><a href='https://example.com'>link</a></p>",
    '<p>$variable({"type":"color"})$ mixed with " literal</p>',
    '<p>no quotes at all</p>',
    '<img alt="description" />',
    null,
    '',
  ];
  for (const x of idempInputs) {
    const once = D.htmlContent(x);
    const twice = D.htmlContent(once);
    ok('T4: htmlContent idempotent on ' + JSON.stringify(x).slice(0, 40),
      once === twice, `once=${JSON.stringify(once)} twice=${JSON.stringify(twice)}`);
  }

  // (d) round-trip: text() with literal " → assemble → stringify → parse →
  //     recovered value has no unescaped " in the block-comment JSON.
  const html = '<p>He said "hi" and href="x"</p>';
  const t = D.text({ html });
  const content = D.placeholder([t]);
  const B = D.createBuilder();
  const assembled = B.assemble({ context: 'et_builder', content });
  const outer = JSON.parse(JSON.stringify(assembled));
  const innerStr = outer.data['1'];
  const cm = innerStr.match(/<!--\s*wp:divi\/text\s+(\{[\s\S]*?\})\s*\/-->/);
  let parsedBlock;
  try { parsedBlock = JSON.parse(cm[1]); } catch (e) { parsedBlock = null; }
  ok('T4: text() inner block-comment JSON parses after round-trip',
    parsedBlock != null);
  const recovered = parsedBlock &&
    parsedBlock.content && parsedBlock.content.innerContent &&
    parsedBlock.content.innerContent.desktop &&
    parsedBlock.content.innerContent.desktop.value;
  ok('T4: recovered innerContent has no literal U+0022 (htmlContent normalised them all)',
    typeof recovered === 'string' && !recovered.includes('"'),
    'recovered=' + JSON.stringify(recovered));
  ok('T4: recovered innerContent is a non-empty <p>',
    /^<p>[^]*<\/p>$/.test(recovered) && recovered.length > 7,
    'recovered=' + JSON.stringify(recovered));
  // The normalised value is deterministic (text-node " -> &quot;, attr " -> ').
  eq('T4: htmlContent output is what text() actually emits',
    recovered, D.htmlContent(html));
})();

// ─── T5: single-source glyph default ─────────────────────────────────────────

(function t5() {
  const validateSrc = fs.readFileSync(path.join(SCRIPTS, 'validate.js'), 'utf8');
  const builderSrc = fs.readFileSync(path.join(SCRIPTS, 'divi-builder.js'), 'utf8');

  ok('T5: glyphs.js is the single source of the default',
    glyphs.DEFAULT_GLYPH_SOURCE === '—–');
  ok('T5: validate.js imports the glyph default',
    /require\(['"]\.\/glyphs['"]\)/.test(validateSrc));
  ok('T5: divi-builder.js imports the glyph default',
    /require\(['"]\.\/glyphs['"]\)/.test(builderSrc));
  ok('T5: no literal dashes-only default remains in validate.js',
    !/const\s+DEFAULT_GLYPH_SOURCE\s*=\s*['"]—–['"]/.test(validateSrc));
  ok('T5: no literal dashes-only default remains in divi-builder.js',
    !/const\s+DEFAULT_GLYPH_SOURCE\s*=\s*['"]—–['"]/.test(builderSrc));

  // The emitter must NOT silently rewrite author copy in Phase 0 — the import
  // is for single-source drift prevention only.
  ok('T5: divi-builder.js does not call buildGlyphRe (emitter stays no-op on glyphs)',
    !/buildGlyphRe\s*\(/.test(builderSrc));
})();

// ─── T6: baseline regression (the core guarantee) ────────────────────────────

(function t6() {
  // Regenerate the example, then re-run the validator with the exact baseline
  // invocation and diff against the captured baseline.
  spawnSync('node', [path.join(EXAMPLES, 'example-divitheatre-page.js')], { encoding: 'utf8', cwd: ROOT });

  const baselinePath = process.env.PHASE0_BASELINE;
  const actual = runValidate([
    path.join(EXAMPLES, 'divitheatre-landing-page.json'),
    '--keyword', 'Divi 5 animation plugin',
    '--meta', path.join(EXAMPLES, 'divitheatre-seo-meta.json'),
  ]);
  if (baselinePath && fs.existsSync(baselinePath)) {
    const baseline = fs.readFileSync(baselinePath, 'utf8');
    eq('T6: validator report byte-identical to baseline (external)', actual, baseline);
  } else {
    // Fall back to an embedded snapshot of the captured baseline so this test
    // is self-contained and deterministic across machines.
    const expected = [
      '',
      '── SEO report card ──',
      '',
      '── results ──',
      '  PASS  JSON parses',
      '  PASS  context: et_builder',
      '  PASS  114 blocks parsed, hierarchy + balance checked',
      '  PASS  36 preset references checked',
      '  PASS  4 global colours defined, references checked',
      '  PASS  all button presets and inline buttons have enable:"on"',
      '  PASS  no raw hex values matched ET design system tokens',
      '  PASS  TASTE: no em-dash/en-dash in copy',
      '  PASS  SEO: exactly one h1 ("The Divi 5 Animation Plugin for <em>Cinematic</em>, Code-Fre")',
      '  PASS  SEO: outline checked (21 headings)',
      '  PASS  SEO: all images have alt text',
      '  PASS  SEO: keyword in h1',
      '  PASS  SEO: keyword in >=1 h2',
      '  PASS  SEO: keyword in opening copy',
      '  PASS  SEO: title tag length ok (56)',
      '  PASS  SEO: meta description length ok (155)',
      '',
      '0 error(s), 0 warning(s)',
      '',
    ].join('\n');
    eq('T6: validator report byte-identical to baseline (embedded)', actual, expected);
  }

  // Fixtures exist and are valid et_builder docs.
  const fixtureDir = path.join(SCRIPTS, '__fixtures__', 'render-safety');
  const expectedFixtures = [
    'attr-path.pass.json', 'attr-path.fail-advanced.json', 'attr-path.fail-map.json',
    'raw-quote.pass.json', 'raw-quote.fail.json',
    'glyph.pass.json', 'glyph.fail.json',
  ];
  for (const name of expectedFixtures) {
    const p = path.join(fixtureDir, name);
    ok('T6: fixture exists — ' + name, fs.existsSync(p));
    if (fs.existsSync(p)) {
      const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
      ok('T6: fixture has context=et_builder — ' + name, doc.context === 'et_builder');
      ok('T6: fixture has data[1] string — ' + name,
        doc.data && typeof doc.data['1'] === 'string' && doc.data['1'].length > 0);
    }
  }
})();

// ─── report ─────────────────────────────────────────────────────────────────

console.log(`\n── Phase 0 test results ──`);
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) {
  failures.forEach(f => console.log(f));
  console.log('');
  process.exit(1);
}
process.exit(0);
