#!/usr/bin/env node
/**
 * e2e-render.test.js — live render smoke-test via the /preview endpoint + Playwright.
 *
 * Run:    node scripts/__tests__/e2e-render.test.js
 * Exit:   0 = all pass · 1 = fail · 2 = skipped (no site configured / not reachable)
 *
 * Credentials (first match wins):
 *   1. DIVI_SITE_URL + DIVI_API_KEY env vars
 *   2. ~/Library/Application Support/Divi5Generator/history.db settings table
 *
 * Golden screenshot: scripts/__tests__/golden/homepage.png
 *   - Created automatically on first run.
 *   - On subsequent runs: pixel diff. Fail if changed pixels > DIFF_THRESHOLD.
 *   - Delete the golden file to reset the baseline.
 *
 * Covers:
 *   E1  /preview returns a valid URL with no errors
 *   E2  Playwright: page loads without console errors
 *   E3  Playwright: hero h1 is visible
 *   E4  Playwright: no default-blue buttons (Divi fallback = rgb(46,86,153))
 *   E5  Screenshot diff vs golden (pixel threshold)
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const https   = require('https');
const http    = require('http');

const GOLDEN_DIR  = path.join(__dirname, 'golden');
const GOLDEN_FILE = path.join(GOLDEN_DIR, 'homepage.png');
const SOURCE      = path.join(__dirname, '..', '..', 'examples', 'iConnectITHomepage.json');
// Maximum changed pixels before E5 fails (1% of a 1280×800 viewport = ~10240 px)
const DIFF_THRESHOLD = 10000;

let pass = 0, fail = 0, skip = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; process.stdout.write(`  PASS  ${name}\n`); }
  else       { fail++; failures.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); process.stdout.write(`  FAIL  ${name}${detail ? ' — ' + detail : ''}\n`); }
}

// ─── Credentials ─────────────────────────────────────────────────────────────

function loadCreds() {
  if (process.env.DIVI_SITE_URL && process.env.DIVI_API_KEY) {
    return {
      siteUrl: process.env.DIVI_SITE_URL.replace(/\/$/, ''),
      apiKey:  process.env.DIVI_API_KEY,
      wpUser:  process.env.WP_USER || null,
      wpPass:  process.env.WP_PASS || null,
    };
  }
  const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Divi5Generator', 'history.db');
  if (!fs.existsSync(dbPath)) return null;
  try {
    const Database = require(path.join(__dirname, '..', '..', '..', '..', 'app', 'node_modules', 'better-sqlite3'));
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT key, value FROM settings').all();
    db.close();
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    if (s.siteUrl && s.apiKey) return {
      siteUrl: s.siteUrl.replace(/\/$/, ''),
      apiKey:  s.apiKey,
      wpUser:  s.wpUser || null,
      wpPass:  s.wpPass || null,
    };
  } catch (_) {}
  return null;
}

const creds = loadCreds();
if (!creds) {
  console.log('SKIP: no credentials found (set DIVI_SITE_URL + DIVI_API_KEY or configure the app)');
  process.exit(2);
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function post(url, apiKey, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const data   = JSON.stringify(body);
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Divi-Tools-Key': apiKey },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Main (async) ─────────────────────────────────────────────────────────────

(async () => {
  // ── E1: /preview endpoint ────────────────────────────────────────────────────

  const layout = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  let previewUrl;
  try {
    const res = await post(
      `${creds.siteUrl}/wp-json/divi-tools/v1/preview`,
      creds.apiKey,
      { layout }
    );
    ok('E1: /preview returns 200', res.status === 200, `HTTP ${res.status}: ${res.body.slice(0, 120)}`);
    if (res.status === 200) {
      const json = JSON.parse(res.body);
      ok('E1: response has preview_url', typeof json.preview_url === 'string' && json.preview_url.startsWith('http'),
        'got: ' + json.preview_url);
      ok('E1: no errors in response', !json.error && !json.code, json.code || json.error || '');
      previewUrl = json.preview_url;
    }
  } catch (e) {
    ok('E1: /preview reachable', false, e.message);
    console.log('\nSKIP: site not reachable — is Local running?');
    process.exit(2);
  }

  if (!previewUrl) {
    console.log('\nSKIP: no preview URL returned — cannot run E2–E5');
    report();
    return;
  }

  // ── E2–E5: Playwright ────────────────────────────────────────────────────────

  let chromium, browser, page;
  try {
    ({ chromium } = require('playwright'));
  } catch (_) {
    console.log('\nINFO: playwright not installed — skipping E2–E5');
    console.log('      Run: npx playwright install chromium');
    report();
    return;
  }

  try {
    browser = await chromium.launch();
    page    = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Log in to WordPress if credentials available (preview URLs require auth)
    if (creds.wpUser && creds.wpPass) {
      await page.goto(`${creds.siteUrl}/wp-login.php`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.fill('#user_login', creds.wpUser);
      await page.fill('#user_pass',  creds.wpPass);
      await page.click('#wp-submit');
      await page.waitForLoadState('networkidle');
    }

    // Only capture JS runtime errors — not 404s for missing images/fonts on local
    const jsErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Skip resource 404s (expected on local where external images may be missing)
        if (!text.includes('404') && !text.includes('Failed to load resource')) {
          jsErrors.push(text);
        }
      }
    });
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // E2: no JS runtime errors
    ok('E2: no JS runtime errors on page load', jsErrors.length === 0,
      jsErrors.slice(0, 3).join(' | '));

    // E3: hero h1 visible
    const h1 = await page.$('h1');
    ok('E3: h1 is visible on the page', !!h1, 'no <h1> found');

    // E4: no default-blue buttons (Divi fallback colour rgb(46,86,153) = #2E5699)
    const blueButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.et_pb_button, a.et_pb_button, [class*="divi-button"]'));
      return btns.filter(b => {
        const bg = window.getComputedStyle(b).backgroundColor;
        return bg === 'rgb(46, 86, 153)' || bg === 'rgb(38, 74, 135)';
      }).map(b => b.textContent.trim().slice(0, 40));
    });
    ok('E4: no default-blue (unfilled preset) buttons', blueButtons.length === 0,
      blueButtons.length ? `${blueButtons.length} blue button(s): ${blueButtons.join(', ')}` : '');

    // E5: screenshot diff vs golden
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    const screenshotBuf = await page.screenshot({ fullPage: true });

    if (!fs.existsSync(GOLDEN_FILE)) {
      fs.writeFileSync(GOLDEN_FILE, screenshotBuf);
      console.log(`  INFO  E5: golden screenshot saved → ${path.relative(process.cwd(), GOLDEN_FILE)}`);
      console.log('        Re-run to diff against it.');
      pass++;
    } else {
      const failPath = GOLDEN_FILE.replace('.png', '-actual.png');
      fs.writeFileSync(failPath, screenshotBuf);

      // Pixel diff with pixelmatch + pngjs
      try {
        const { PNG }      = require('pngjs');
        const pixelmatch   = require('pixelmatch').default ?? require('pixelmatch');

        const goldenPng  = PNG.sync.read(fs.readFileSync(GOLDEN_FILE));
        const actualPng  = PNG.sync.read(screenshotBuf);

        if (goldenPng.width !== actualPng.width || goldenPng.height !== actualPng.height) {
          // Different dimensions = definite layout change
          ok('E5: screenshot matches golden', false,
            `dimensions changed: golden ${goldenPng.width}×${goldenPng.height} vs actual ${actualPng.width}×${actualPng.height}`);
        } else {
          const diff    = new PNG({ width: goldenPng.width, height: goldenPng.height });
          const changed = pixelmatch(goldenPng.data, actualPng.data, diff.data,
            goldenPng.width, goldenPng.height, { threshold: 0.1 });
          const diffPath = GOLDEN_FILE.replace('.png', '-diff.png');
          fs.writeFileSync(diffPath, PNG.sync.write(diff));

          ok('E5: changed pixels within threshold',
            changed <= DIFF_THRESHOLD,
            `${changed} px changed (threshold ${DIFF_THRESHOLD}) — diff at ${path.relative(process.cwd(), diffPath)}`);
          if (changed > 0 && changed <= DIFF_THRESHOLD) {
            console.log(`  INFO  E5: ${changed} pixels changed — within threshold`);
          }
        }
        // Clean up actual if it passed
        if (!failures.some(f => f.includes('E5'))) fs.rmSync(failPath, { force: true });
      } catch (e) {
        ok('E5: pixelmatch diff ran', false, e.message);
      }
    }

  } catch (e) {
    ok('Playwright run completed without crash', false, e.message);
  } finally {
    if (browser) await browser.close();
  }

  report();
})();

function report() {
  console.log(`\n── E2E render test results ──`);
  console.log(`  ${pass} passed, ${fail} failed${skip ? ', ' + skip + ' skipped' : ''}`);
  if (failures.length) { failures.forEach(f => console.log(f)); process.exit(1); }
}
