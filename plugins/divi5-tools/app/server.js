'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { spawn, execSync } = require('child_process');
const { db, EXPORTS_DIR } = require('./db');

const PLUGIN_DIR  = path.resolve(__dirname, '..');
const STYLE_CHECK = path.join(PLUGIN_DIR, 'skills', 'divi5-style-check', 'scripts', 'style-check.js');
const ET_PAGES    = require(path.join(PLUGIN_DIR, 'skills', 'divi5-page-generator', 'scripts', 'et-pages.js'));
const PORT        = parseInt(process.env.PORT) || 3747;

const app    = express();
const upload = multer({ dest: os.tmpdir() });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SSE clients map: generationId → [res, ...] ────────────────────────────
const sseClients = new Map();

function sendSSE(genId, event, data) {
  const clients = sseClients.get(genId) || [];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

// ─── GET /et-pages — ET pack page list ──────────────────────────────────────
app.get('/et-pages', (_req, res) => {
  try {
    res.json(ET_PAGES.list());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /stream/:id — SSE live log ─────────────────────────────────────────
app.get('/stream/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send existing log on connect
  const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
  if (gen?.log) res.write(`event: log\ndata: ${JSON.stringify({ chunk: gen.log })}\n\n`);
  if (gen?.status !== 'running') {
    const files = db.prepare('SELECT * FROM output_files WHERE generation_id=?').all(id);
    const hasPreview = gen.output_dir ? (() => { try { return fs.readdirSync(gen.output_dir).some(f => f.endsWith('.html')); } catch { return false; } })() : false;
    res.write(`event: done\ndata: ${JSON.stringify({ status: gen.status, styleCheck: gen.style_check, files, hasPreview })}\n\n`);
    return res.end();
  }

  if (!sseClients.has(id)) sseClients.set(id, []);
  sseClients.get(id).push(res);

  req.on('close', () => {
    const list = sseClients.get(id) || [];
    sseClients.set(id, list.filter(r => r !== res));
  });
});

// ─── POST /generate ──────────────────────────────────────────────────────────
app.post('/generate', upload.single('exportFile'), (req, res) => {
  const {
    brand, whatItDoes, keyword, secondaryKeywords,
    sections, aesthetic, ctaLabel, ctaUrl,
    motion, outputDir, exportLabel, savedExportId, revisionNotes,
    etTemplate,
  } = req.body;

  const sectionsArr = Array.isArray(sections) ? sections : (sections ? [sections] : []);
  const outputPath  = outputDir || path.join(os.homedir(), 'Desktop', 'divi-output');
  fs.mkdirSync(outputPath, { recursive: true });

  // Resolve designer export: saved selection takes priority over new upload
  let exportPath = null;
  if (savedExportId) {
    const saved = db.prepare('SELECT * FROM designer_exports WHERE id=?').get(parseInt(savedExportId));
    if (saved && fs.existsSync(saved.filepath)) exportPath = saved.filepath;
  }
  if (!exportPath && req.file) {
    const dest = path.join(EXPORTS_DIR, `${Date.now()}-${req.file.originalname}`);
    fs.renameSync(req.file.path, dest);
    exportPath = dest;

    // Parse preset/colour counts for history
    try {
      const doc = JSON.parse(fs.readFileSync(dest, 'utf8'));
      const presets = Object.values(doc.presets?.module || {});
      const presetCount = presets.reduce((n, g) => n + Object.keys(g.items || {}).length, 0);
      const colourCount = (doc.global_colors || []).length;
      db.prepare(`INSERT INTO designer_exports (label, brand, filepath, preset_count, colour_count)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(exportLabel || brand, brand, dest, presetCount, colourCount);
    } catch (_) {}
  }

  // Build brief prompt
  const sectionList = sectionsArr.join(', ') || 'Hero, Features, CTA';
  const motionLine  = motion === 'yes' ? 'DiviTheatre motion: Yes.' :
                      motion === 'want' ? 'DiviTheatre motion: No but I want it.' : '';
  const secondary   = secondaryKeywords ? ` Secondary keywords: ${secondaryKeywords}.` : '';

  // Resolve ET template sections for the prompt
  let etTemplateLine = '';
  if (etTemplate) {
    const hit = ET_PAGES.match(etTemplate);
    const sectionStr = hit ? hit.sections.join(', ') : '';
    etTemplateLine = `ET pack template: "${etTemplate}"${sectionStr ? ` (sections: ${sectionStr})` : ''}. Use Stage 0 to clone this template as the starting point before customising copy and branding.`;
  }

  const prompt = [
    `/divi5-tools:divi5-page-generator`,
    `Build a landing page for ${brand}. ${whatItDoes || ''}`,
    `Primary keyword: ${keyword}.${secondary}`,
    etTemplateLine || `Sections: ${sectionList}.`,
    aesthetic ? `Aesthetic: ${aesthetic}.` : '',
    `Primary CTA: "${ctaLabel || 'Get Started'}" linking to ${ctaUrl || '#'}.`,
    motionLine,
    revisionNotes ? `REVISION NOTES (apply these changes from the previous version): ${revisionNotes}` : '',
  ].filter(Boolean).join(' ');

  // Insert generation record
  const genId = db.prepare(`
    INSERT INTO generations (brand, keyword, sections, aesthetic, cta_label, cta_url, output_dir, export_path, what_it_does, secondary_keywords, et_template)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(brand, keyword, JSON.stringify(sectionsArr), aesthetic, ctaLabel, ctaUrl, outputPath, exportPath, whatItDoes || '', secondaryKeywords || '', etTemplate || null).lastInsertRowid;

  res.json({ id: genId });

  // ── Extract design tokens from export and seed output dir ──────────────
  let paletteHint = '';
  if (exportPath) {
    try {
      const extractScript = path.join(PLUGIN_DIR, 'skills', 'divi5-extract-style', 'scripts', 'extract-from-export.js');
      if (fs.existsSync(extractScript)) {
        execSync(`node "${extractScript}" "${exportPath}" --out "${outputPath}"`, { encoding: 'utf8' });
        // Extract palette from presets (global_colors may be empty)
        const doc = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
        const allHex = [...new Set(
          JSON.stringify(doc.presets || {}).match(/#[0-9a-fA-F]{6}\b/g) || []
        )];
        if (allHex.length) paletteHint = `Brand colour palette extracted from the designer export — use ONLY these colours: ${allHex.join(', ')}. Do NOT invent new colours.`;
      }
    } catch (_) {}
  }

  const fullPrompt = paletteHint ? `${prompt} ${paletteHint}` : prompt;

  // ── Spawn claude ────────────────────────────────────────────────────────
  const claudeBin = findClaude();
  if (!claudeBin) {
    db.prepare(`UPDATE generations SET status='failed', log=? WHERE id=?`)
      .run('ERROR: claude CLI not found. Install Claude Code first.', genId);
    sendSSE(genId, 'log', { chunk: 'ERROR: claude CLI not found. Install Claude Code first.\n' });
    sendSSE(genId, 'done', { status: 'failed' });
    return;
  }

  const proc = spawn(claudeBin, ['-p', '--dangerously-skip-permissions',
    '--plugin-dir', PLUGIN_DIR, fullPrompt], {
    cwd: outputPath,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stdin.end(); // send immediate EOF so claude doesn't wait for stdin

  const appendLog = db.prepare(`UPDATE generations SET log = log || ? WHERE id = ?`);

  proc.stdout.on('data', chunk => {
    const text = chunk.toString();
    appendLog.run(text, genId);
    sendSSE(genId, 'log', { chunk: text });
  });

  proc.stderr.on('data', chunk => {
    const text = chunk.toString();
    appendLog.run(text, genId);
    sendSSE(genId, 'log', { chunk: text });
  });

  proc.on('close', async (code) => {
    // Detect output files — only include .json files that are actually valid JSON
    const allJsonFiles = fs.readdirSync(outputPath).filter(f => f.endsWith('.json'));
    const files = allJsonFiles.filter(f => {
      try { JSON.parse(fs.readFileSync(path.join(outputPath, f), 'utf8')); return true; }
      catch (_) {
        const warn = `\n⚠ Skipped ${f} — not valid JSON (likely an HTML file with wrong extension)\n`;
        appendLog.run(warn, genId);
        sendSSE(genId, 'log', { chunk: warn });
        return false;
      }
    });
    const insertFile = db.prepare(`INSERT INTO output_files (generation_id, filename, filepath, kind) VALUES (?, ?, ?, ?)`);
    for (const f of files) {
      const kind = f.includes('seo-meta') ? 'seo-meta' :
                   f.includes('schema')   ? 'schema' :
                   f.includes('landing-page') || f.includes('-page') ? 'page' : 'other';
      const exists = db.prepare('SELECT id FROM output_files WHERE generation_id=? AND filename=?').get(genId, f);
      if (!exists) insertFile.run(genId, f, path.join(outputPath, f), kind);
    }

    // Run style check if export was provided
    let styleCheck = 'skipped';
    if (exportPath && files.some(f => f.includes('-page') || f.includes('landing'))) {
      const pageFile = files.find(f => f.includes('-page') || f.includes('landing'));
      if (pageFile) {
        try {
          const result = runStyleCheck(exportPath, path.join(outputPath, pageFile));
          styleCheck = result.consistent ? 'consistent' : result.crashed ? 'error' : 'inconsistent';
          const scLog = `\n--- STYLE CHECK ---\n${result.report}\n`;
          appendLog.run(scLog, genId);
          sendSSE(genId, 'log', { chunk: scLog });
        } catch (e) {
          appendLog.run(`\nStyle check error: ${e.message}\n`, genId);
        }
      }
    }

    const status = code === 0 ? 'complete' : 'failed';
    db.prepare(`UPDATE generations SET status=?, style_check=? WHERE id=?`).run(status, styleCheck, genId);

    // Detect HTML preview file
    const allFiles = fs.readdirSync(outputPath);
    const hasPreview = allFiles.some(f => f.endsWith('.html'));
    db.prepare(`UPDATE generations SET has_preview=? WHERE id=?`).run(hasPreview ? 1 : 0, genId);

    // Send final file list to UI
    const outputFiles = db.prepare('SELECT * FROM output_files WHERE generation_id=?').all(genId);
    sendSSE(genId, 'done', { status, styleCheck, files: outputFiles, hasPreview });

    // Close SSE connections
    (sseClients.get(genId) || []).forEach(r => r.end());
    sseClients.delete(genId);
  });
});

// ─── GET /generations — history list ────────────────────────────────────────
app.get('/generations', (req, res) => {
  const rows = db.prepare(`SELECT * FROM generations ORDER BY id DESC LIMIT 50`).all();
  res.json(rows.map(r => ({ ...r, sections: JSON.parse(r.sections) })));
});

// ─── GET /generations/:id — single with files ───────────────────────────────
app.get('/generations/:id', (req, res) => {
  const gen   = db.prepare('SELECT * FROM generations WHERE id=?').get(req.params.id);
  if (!gen) return res.status(404).json({ error: 'Not found' });
  const files = db.prepare('SELECT * FROM output_files WHERE generation_id=?').all(req.params.id);
  res.json({ ...gen, sections: JSON.parse(gen.sections), files });
});

// ─── GET /download/:id/:filename ────────────────────────────────────────────
app.get('/download/:id/:filename', (req, res) => {
  const file = db.prepare('SELECT * FROM output_files WHERE generation_id=? AND filename=?')
    .get(req.params.id, req.params.filename);
  if (!file || !fs.existsSync(file.filepath)) return res.status(404).json({ error: 'File not found' });
  res.download(file.filepath, file.filename);
});

// ─── GET /exports — saved designer exports ───────────────────────────────────
app.get('/exports', (req, res) => {
  res.json(db.prepare('SELECT * FROM designer_exports ORDER BY id DESC').all());
});

// ─── GET /download-plugin — serve the importer plugin ZIP ────────────────────
app.get('/download-plugin', (req, res) => {
  // The zip isn't committed (the Claude Code plugin installer rejects nested
  // zips), so always build it from the unpacked source on demand.
  const buildScript = path.join(PLUGIN_DIR, 'skills', 'import-to-local', 'scripts', 'build-plugin-zip.sh');
  if (!fs.existsSync(buildScript)) return res.status(404).json({ error: 'Plugin build script not found' });
  try {
    const zip = execSync(`bash "${buildScript}"`).toString().trim();
    res.download(zip, 'divi-tools-importer.zip');
  } catch (e) {
    res.status(500).json({ error: 'Could not build plugin ZIP' });
  }
});

// ─── GET /settings ───────────────────────────────────────────────────────────
app.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out  = {};
  rows.forEach(r => { out[r.key] = r.value; });
  // Never expose the raw API key — send a masked version
  if (out.apiKey) out.apiKey = out.apiKey.replace(/.(?=.{4})/g, '•');
  res.json(out);
});

// ─── POST /settings ───────────────────────────────────────────────────────────
app.post('/settings', (req, res) => {
  const { siteUrl, apiKey } = req.body;
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  if (siteUrl !== undefined) upsert.run('siteUrl', siteUrl.trim());
  if (apiKey  !== undefined && !apiKey.includes('•')) upsert.run('apiKey', apiKey.trim());
  res.json({ ok: true });
});

// ─── GET /prereqs — check claude is installed ────────────────────────────────
app.get('/prereqs', (req, res) => {
  const claudeBin = findClaude();
  let claudeVersion = null;
  if (claudeBin) {
    try { claudeVersion = execSync(`${claudeBin} --version`).toString().trim(); } catch (_) {}
  }
  res.json({ claudeFound: !!claudeBin, claudeVersion });
});

// ─── helpers ────────────────────────────────────────────────────────────────
function findClaude() {
  const candidates = [
    'claude',
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
  ];
  for (const c of candidates) {
    try { execSync(`which "${c}" 2>/dev/null || test -f "${c}"`); return c; } catch (_) {}
  }
  try { return execSync('which claude').toString().trim(); } catch (_) { return null; }
}

function runStyleCheck(originalPath, generatedPath) {
  try {
    const out = execSync(`node "${STYLE_CHECK}" "${originalPath}" "${generatedPath}"`, { encoding: 'utf8' });
    return { consistent: true, report: out };
  } catch (e) {
    const report = [e.stdout, e.stderr].filter(Boolean).join('\n') || e.message;
    // Distinguish a style mismatch (script exited non-zero with output) from a crash (no stdout)
    const crashed = !e.stdout && !e.stderr;
    return { consistent: false, crashed, report };
  }
}

// ─── POST /import/:id — Import generated page to WordPress ───────────────────
app.post('/import/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });
    const { siteUrl, apiKey } = settings;
    if (!siteUrl || !apiKey) return res.status(400).json({ error: 'WordPress settings not configured' });

    const pageFile  = db.prepare(`SELECT * FROM output_files WHERE generation_id=? AND kind='page'`).get(id);
    const seoFile   = db.prepare(`SELECT * FROM output_files WHERE generation_id=? AND kind='seo-meta'`).get(id);
    const schemaFile= db.prepare(`SELECT * FROM output_files WHERE generation_id=? AND kind='schema'`).get(id);

    if (!pageFile || !fs.existsSync(pageFile.filepath)) {
      return res.status(404).json({ error: 'Page output file not found' });
    }

    const rawPage = fs.readFileSync(pageFile.filepath, 'utf8');
    if (rawPage.trimStart().startsWith('<')) {
      return res.json({ ok: false, error: 'Page file contains HTML, not JSON — the skill wrote an HTML preview with a .json extension. Re-run the generation.' });
    }
    const layout = JSON.parse(rawPage);
    const seo    = seoFile   && fs.existsSync(seoFile.filepath)   ? JSON.parse(fs.readFileSync(seoFile.filepath,   'utf8')) : null;
    const schema = schemaFile&& fs.existsSync(schemaFile.filepath) ? JSON.parse(fs.readFileSync(schemaFile.filepath,'utf8')) : null;

    db.prepare(`UPDATE generations SET import_status='importing' WHERE id=?`).run(id);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let wpRes;
    try {
      wpRes = await fetch(`${siteUrl}/wp-json/divi-tools/v1/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Divi-Tools-Key': apiKey,
        },
        body: JSON.stringify({ layout, seo, schema, draft: true }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!wpRes.ok) {
      const errText = await wpRes.text();
      db.prepare(`UPDATE generations SET import_status='failed' WHERE id=?`).run(id);
      return res.json({ ok: false, error: `WordPress returned ${wpRes.status}: ${errText}` });
    }

    const data = await wpRes.json();
    const previewUrl = data.previewUrl || data.preview_url || null;
    db.prepare(`UPDATE generations SET import_status='imported', preview_url=? WHERE id=?`).run(previewUrl, id);
    res.json({ ok: true, previewUrl });

  } catch (err) {
    db.prepare(`UPDATE generations SET import_status='failed' WHERE id=?`).run(id);
    res.json({ ok: false, error: err.message });
  }
});

// ─── GET /test-connection — Test WordPress site connection ────────────────────
app.get('/test-connection', async (req, res) => {
  try {
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });
    const { siteUrl, apiKey } = settings;
    if (!siteUrl || !apiKey) return res.json({ ok: false, error: 'No WordPress settings saved' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let wpRes;
    try {
      wpRes = await fetch(`${siteUrl}/wp-json/divi-tools/v1/ping`, {
        headers: { 'X-Divi-Tools-Key': apiKey },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!wpRes.ok) return res.json({ ok: false, error: `HTTP ${wpRes.status}` });
    res.json({ ok: true, message: 'Connected' });
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Connection timed out' : err.message;
    res.json({ ok: false, error: msg });
  }
});

// ─── GET /preview-html/:id — serve Stage 2 HTML preview file ────────────────
app.get('/preview-html/:id', (req, res) => {
  const gen = db.prepare('SELECT output_dir FROM generations WHERE id=?').get(req.params.id);
  if (!gen) return res.status(404).send('Not found');
  try {
    const files = fs.readdirSync(gen.output_dir).filter(f => f.endsWith('.html'));
    if (!files.length) return res.status(404).send('No preview HTML yet');
    // Prefer file with 'preview' in name
    const html = files.find(f => f.includes('preview')) || files[0];
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(path.join(gen.output_dir, html), 'utf8'));
  } catch (_) {
    res.status(404).send('Preview not available');
  }
});

// ─── GET /briefs — list saved briefs ─────────────────────────────────────────
app.get('/briefs', (req, res) => {
  res.json(db.prepare('SELECT id, name, data FROM saved_briefs ORDER BY id DESC').all().map(r => ({
    ...r, data: JSON.parse(r.data),
  })));
});

// ─── POST /briefs — save a brief ──────────────────────────────────────────────
app.post('/briefs', (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'name and data required' });
  const id = db.prepare('INSERT INTO saved_briefs (name, data) VALUES (?, ?)').run(name, JSON.stringify(data)).lastInsertRowid;
  res.json({ id });
});

// ─── DELETE /briefs/:id ───────────────────────────────────────────────────────
app.delete('/briefs/:id', (req, res) => {
  db.prepare('DELETE FROM saved_briefs WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── GET /pick-folder — Native macOS folder picker ────────────────────────────
app.get('/pick-folder', (req, res) => {
  try {
    const result = execSync(
      `osascript -e 'POSIX path of (choose folder with prompt "Choose output folder:")'`,
      { encoding: 'utf8', timeout: parseInt(process.env.OSASCRIPT_TIMEOUT) || 60000 }
    ).trim();
    res.json({ path: result || null });
  } catch (_) {
    res.json({ path: null });
  }
});

// ─── DELETE /generations/:id ──────────────────────────────────────────────────
app.delete('/generations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('DELETE FROM output_files WHERE generation_id=?').run(id);
  db.prepare('DELETE FROM generations WHERE id=?').run(id);
  res.json({ ok: true });
});

// ─── POST /rerun/:id — Load a past generation's brief ────────────────────────
app.post('/rerun/:id', (req, res) => {
  const gen = db.prepare('SELECT * FROM generations WHERE id=?').get(req.params.id);
  if (!gen) return res.status(404).json({ error: 'Not found' });
  res.json({
    brand:              gen.brand,
    what_it_does:       gen.what_it_does,
    keyword:            gen.keyword,
    secondary_keywords: gen.secondary_keywords,
    sections:           JSON.parse(gen.sections || '[]'),
    aesthetic:          gen.aesthetic,
    cta_label:          gen.cta_label,
    cta_url:            gen.cta_url,
    output_dir:         gen.output_dir,
    export_path:        gen.export_path,
    et_template:        gen.et_template || null,
  });
});

app.listen(PORT, () => {
  console.log(`Divi 5 Generator running at http://localhost:${PORT}`);
});
