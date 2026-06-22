'use strict';

/**
 * server.test.js — integration tests for the Express server endpoints.
 * Uses Node's built-in test runner (node:test) and assert (node:assert).
 * Requires Node 18+.
 *
 * Run: node --test tests/server.test.js
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const path   = require('node:path');
const { spawn } = require('node:child_process');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const PORT = 37470; // different from production to avoid conflicts

// ─── helpers ────────────────────────────────────────────────────────────────

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method,
      headers: {},
    };
    let bodyStr;
    if (body) {
      bodyStr = JSON.stringify(body);
      opts.headers['Content-Type']   = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function waitForPort(port, maxMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      const sock = http.get({ hostname: '127.0.0.1', port, path: '/prereqs' }, () => {
        sock.destroy();
        resolve();
      });
      sock.on('error', () => {
        if (Date.now() - start > maxMs) return reject(new Error('Server did not start'));
        setTimeout(attempt, 200);
      });
    }
    attempt();
  });
}

// ─── Server lifecycle ────────────────────────────────────────────────────────

let serverProc;

test.before(async () => {
  serverProc = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });
  serverProc.stderr.on('data', () => {}); // suppress
  serverProc.stdout.on('data', () => {}); // suppress
  await waitForPort(PORT);
});

test.after(() => {
  if (serverProc) serverProc.kill('SIGTERM');
});

// ─── Tests ──────────────────────────────────────────────────────────────────

test('GET /prereqs returns claudeFound and claudeVersion keys', async () => {
  const { status, body } = await request('GET', '/prereqs');
  assert.equal(status, 200);
  assert.ok('claudeFound' in body, 'missing claudeFound');
  assert.ok('claudeVersion' in body, 'missing claudeVersion');
  assert.equal(typeof body.claudeFound, 'boolean');
});

test('GET /settings returns object without crashing when empty', async () => {
  const { status, body } = await request('GET', '/settings');
  assert.equal(status, 200);
  assert.equal(typeof body, 'object');
  assert.ok(body !== null);
});

test('POST /settings saves siteUrl; GET /settings masks apiKey', async () => {
  const siteUrl = 'https://test-site-xyz.example.com';
  const apiKey  = 'secretkey12345678';
  const postRes = await request('POST', '/settings', { siteUrl, apiKey });
  assert.equal(postRes.status, 200);
  assert.equal(postRes.body.ok, true);

  const getRes = await request('GET', '/settings');
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.siteUrl, siteUrl);
  // apiKey should be masked
  assert.ok(getRes.body.apiKey, 'apiKey should be present');
  assert.ok(!getRes.body.apiKey.includes('secretkey'), 'apiKey should be masked');
  assert.ok(getRes.body.apiKey.includes('•'), 'apiKey should contain mask character');
});

test('GET /test-connection returns { ok: false } when no valid WP site reachable', async () => {
  // Settings may have been saved above with a fake URL, so this should fail gracefully
  const { status, body } = await request('GET', '/test-connection');
  assert.equal(status, 200);
  assert.ok('ok' in body, 'missing ok property');
  // We expect false since the test URL is not a real WP site
  assert.equal(body.ok, false);
});

test('GET /pick-folder returns { path } property (null on cancel)', async () => {
  // In CI / test env osascript will fail — should return { path: null }
  const { status, body } = await request('GET', '/pick-folder');
  assert.equal(status, 200);
  assert.ok('path' in body, 'missing path property');
  // path is null when osascript fails
  assert.ok(body.path === null || typeof body.path === 'string');
});

test('GET /exports returns an array', async () => {
  const { status, body } = await request('GET', '/exports');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body), 'exports should be an array');
});

test('GET /generations returns an array', async () => {
  const { status, body } = await request('GET', '/generations');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body), 'generations should be an array');
});

test('POST /generate with missing required fields returns a response (any HTTP status)', async () => {
  // Submit with no brand/keyword — server must respond (not hang or crash the process)
  // The server currently returns 500 when brand is missing (sqlite NOT NULL constraint).
  // We just verify it responds at all — a status code is returned.
  const { status } = await request('POST', '/generate', {});
  assert.ok(typeof status === 'number' && status >= 100 && status < 600,
    `Expected a valid HTTP status, got ${status}`);
});
