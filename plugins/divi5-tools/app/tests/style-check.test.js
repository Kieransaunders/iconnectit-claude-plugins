'use strict';

/**
 * style-check.test.js — unit tests for the style-check.js script.
 * Uses Node's built-in test runner (node:test) and assert (node:assert).
 *
 * Runs style-check.js as a child process with minimal fixture JSON files
 * written to OS temp directory.
 *
 * Run: node --test tests/style-check.test.js
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const fs     = require('node:fs');
const os     = require('node:os');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', '..', 'skills', 'divi5-style-check', 'scripts', 'style-check.js');

// ─── helpers ────────────────────────────────────────────────────────────────

let tmpFiles = [];

function writeTmp(obj) {
  const f = path.join(os.tmpdir(), `sc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(f, JSON.stringify(obj));
  tmpFiles.push(f);
  return f;
}

function runScript(origPath, genPath) {
  const result = spawnSync(process.execPath, [SCRIPT, origPath, genPath], {
    encoding: 'utf8',
    timeout: 15000,
  });
  return {
    code:   result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

test.after(() => {
  tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Minimal original export with one preset and one global colour.
 */
function makeOriginal({ presetId = 'preset-abc', colorHex = '#1a2b3c' } = {}) {
  return {
    presets: {
      module: {
        'divi/text': {
          items: {
            [presetId]: { name: 'Body Text', attrs: { color: colorHex } },
          },
        },
      },
    },
    global_colors: [
      [
        'gcid-primary',
        { color: colorHex, label: 'Primary' },
      ],
    ],
  };
}

/**
 * Minimal generated page that references the given presetId and colour.
 */
function makeGeneratedPage({ presetId = 'preset-abc', colorHex = '#1a2b3c' } = {}) {
  return {
    content: [
      {
        type: 'divi/text',
        modulePreset: presetId,
        attrs: { color: colorHex },
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test('exits 0 (CONSISTENT) when generated page uses original preset IDs', () => {
  const presetId = 'preset-original-001';
  const orig = writeTmp(makeOriginal({ presetId }));
  const gen  = writeTmp(makeGeneratedPage({ presetId }));
  const { code, stdout } = runScript(orig, gen);
  assert.equal(code, 0, `Expected exit 0, got ${code}\nOutput: ${stdout}`);
  assert.ok(stdout.includes('CONSISTENT'), `Expected CONSISTENT in output:\n${stdout}`);
});

test('exits 1 (INCONSISTENT) when generated page has a new/unknown preset ID', () => {
  const orig = writeTmp(makeOriginal({ presetId: 'preset-known' }));
  const gen  = writeTmp(makeGeneratedPage({ presetId: 'preset-BRAND-NEW-unknown-xyz' }));
  const { code, stdout } = runScript(orig, gen);
  assert.equal(code, 1, `Expected exit 1, got ${code}\nOutput: ${stdout}`);
  assert.ok(stdout.includes('INCONSISTENT'), `Expected INCONSISTENT in output:\n${stdout}`);
});

test('exits 1 when generated page has a colour not in original palette', () => {
  const orig = writeTmp(makeOriginal({ presetId: 'preset-p', colorHex: '#aabbcc' }));
  // Use a totally different colour, no preset reference
  const gen  = writeTmp({
    content: [
      {
        type: 'divi/text',
        modulePreset: 'preset-p',
        attrs: { color: '#ff0077' }, // not in palette
      },
    ],
  });
  const { code, stdout } = runScript(orig, gen);
  // Should flag the off-palette colour
  assert.equal(code, 1, `Expected exit 1, got ${code}\nOutput: ${stdout}`);
});

test('exits 0 (CONSISTENT) when original has no presets and generated page has no colour refs', () => {
  // When original has no palette, the script has nothing to compare against.
  // We also ensure the generated page has no raw hex colours so no colour FAILs fire.
  const orig = writeTmp({
    presets: { module: {} },
    global_colors: [],
  });
  const gen = writeTmp({
    content: [
      { type: 'divi/text', attrs: { text: 'Hello world' } },
    ],
  });
  const { code, stdout } = runScript(orig, gen);
  assert.equal(code, 0, `Expected exit 0, got ${code}\nOutput: ${stdout}`);
  assert.ok(stdout.includes('CONSISTENT'), `Expected CONSISTENT:\n${stdout}`);
});

test('exits 2 when an input file path does not exist', () => {
  const orig = writeTmp(makeOriginal());
  const { code, stderr } = runScript(orig, '/tmp/this-file-does-not-exist-xyz-abc.json');
  assert.equal(code, 2, `Expected exit 2, got ${code}\nStderr: ${stderr}`);
});
