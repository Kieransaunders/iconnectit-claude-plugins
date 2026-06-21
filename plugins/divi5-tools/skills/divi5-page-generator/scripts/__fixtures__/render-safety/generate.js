#!/usr/bin/env node
/**
 * generate.js — render-safety fixture generator.
 *
 * Produces the seed fixtures under scripts/__fixtures__/render-safety/ so they
 * stay in sync with the builder's structural conventions. The PASS fixtures
 * are built with the normal builder API; the FAIL fixtures either bypass the
 * normaliser (raw attribute strings) or hand-author the wrong shape that the
 * builder now refuses to emit.
 *
 * Run:  node scripts/__fixtures__/render-safety/generate.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const D = require(path.join(__dirname, '..', '..', 'divi-builder.js'));

const OUT = __dirname;

function wrap(moduleBlock) {
  return D.placeholder([
    D.section({}, [
      D.row({}, [
        D.column({}, [
          moduleBlock,
        ]),
      ]),
    ]),
  ]);
}

function writeFixture(name, contentString, rule, caseName, note) {
  const doc = {
    context: 'et_builder',
    data: { '1': contentString },
    _fixture: { rule, case: caseName, note },
  };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(doc, null, 2) + '\n');
  console.log('  wrote ' + name + '.json');
}

// ─── attr-path ───────────────────────────────────────────────────────────────

// pass: canonical theatreAttrs output via the normal builder path.
writeFixture(
  'attr-path.pass',
  wrap(D.section({ theatre: 'fade-up' }, [
    D.row({}, [ D.column({}, []) ]),
  ])),
  'RS-ATTR-PATH', 'pass',
  'Canonical theatreAttrs() output: Array<{name,value,targetElement:"main"}> at module.decoration.attributes.desktop.value.attributes. Tier 1 must NOT flag.'
);

// fail-advanced: hand-crafted block with module.advanced.attributes (old location).
// The builder refuses to emit this post-T3, so we hand-author the section block.
writeFixture(
  'attr-path.fail-advanced',
  wrap('<!-- wp:divi/section {"module":{"advanced":{"attributes":{"data-theatre":"fade-up"}}},"builderVersion":"5.0.0-public-beta.9.1"} /-->'),
  'RS-ATTR-PATH', 'fail-advanced',
  'Custom attributes on module.advanced.attributes (the old location). Divi silently renders ZERO. Builder throws; Tier 1 must FAIL.'
);

// fail-map: hand-crafted block with decoration.attributes path but key->value map.
writeFixture(
  'attr-path.fail-map',
  wrap('<!-- wp:divi/section {"module":{"decoration":{"attributes":{"desktop":{"value":{"attributes":{"data-theatre":"fade-up"}}}}}},"builderVersion":"5.0.0-public-beta.9.1"} /-->'),
  'RS-ATTR-PATH', 'fail-map',
  'Custom attributes at the canonical PATH but as a key->value map. Builder migrates; Tier 1 must FAIL on the input shape.'
);

// ─── raw-quote ───────────────────────────────────────────────────────────────

// pass: single-quoted attrs + &quot; entities — htmlContent leaves untouched.
writeFixture(
  'raw-quote.pass',
  wrap(D.text({ html: "<p>Safe <a href='https://example.com'>link</a> and data-theatre=&quot;fade-up&quot; entity form.</p>" })),
  'RS-RAW-QUOTE', 'pass',
  'Single-quoted HTML attribute and &quot; entities. No literal U+0022 in innerContent. Must NOT flag.'
);

// fail: literal " in innerContent HTML — htmlContent normalises this away, so
// the fixture is hand-authored to demonstrate the shape Tier 1 must catch.
writeFixture(
  'raw-quote.fail',
  wrap('<!-- wp:divi/text {"content":{"innerContent":{"desktop":{"value":"<p>He said \\"hi\\" and href=\\"x\\"</p>"}}},"builderVersion":"5.0.0-public-beta.9.1"} /-->'),
  'RS-RAW-QUOTE', 'fail',
  'Literal U+0022 inside innerContent HTML. Breaks block-comment JSON parse on a strict parser -> empties the module. Builder normaliser prevents this shape; Tier 1 must FAIL.'
);

// ─── glyph ───────────────────────────────────────────────────────────────────

writeFixture(
  'glyph.pass',
  wrap(D.text({ html: '<p>Plain ASCII copy with a hyphen - and nothing banned.</p>' })),
  'RS-GLYPH', 'pass',
  'No banned glyphs. Must NOT flag under default or any --ban-glyphs set.'
);

writeFixture(
  'glyph.fail',
  wrap(D.text({ html: '<p>The em-dash is the #1 AI tell — ban it.</p>' })),
  'RS-GLYPH', 'fail',
  'Em-dash (U+2014) in visible copy. Default RS-GLYPH/TASTE set must FAIL; auto-fix substitutes an ASCII hyphen.'
);

console.log('Done.');
