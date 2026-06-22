#!/usr/bin/env node
/**
 * regression.test.js — Golden-file regression suite.
 *
 * For each known-good example JSON: run validate.js → assert exit 0.
 * Run taste-check.js → assert exit 0.
 * If either exits 1, a previously passing file has regressed.
 *
 * Run:   node scripts/__tests__/regression.test.js
 * Exit:  0 = all pass · 1 = regression detected
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT     = path.resolve(__dirname, '..', '..');
const VALIDATE = path.join(ROOT, 'scripts', 'validate.js');
const TASTE    = path.join(ROOT, 'scripts', 'taste-check.js');
const EXAMPLES = path.join(ROOT, 'examples');

const GOLDEN = [
  { file: 'divitheatre-landing-page.json', label: 'DiviTheatre landing page' },
  { file: 'example-landing-page.json',     label: 'Example landing page'     },
];

let passed = 0;
let failed = 0;

function ok(label, cond, detail) {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else       { console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

console.log('\n── regression suite ──');

for (const { file, label } of GOLDEN) {
  const json = path.join(EXAMPLES, file);

  const v = spawnSync(process.execPath, [VALIDATE, json], { encoding: 'utf8' });
  ok(`validate: ${label}`, v.status === 0, v.stdout.split('\n').filter(l => /FAIL/.test(l)).join(' | ') || v.stderr.slice(0, 200));

  const t = spawnSync(process.execPath, [TASTE, json], { encoding: 'utf8' });
  ok(`taste:    ${label}`, t.status === 0, t.stdout.split('\n').filter(l => /FAIL/.test(l)).join(' | ') || t.stderr.slice(0, 200));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
