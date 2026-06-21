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
const PORT        = 3747;

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

// ─── GET /stream/:id — SSE live log ─────────────────────────────────────────
app.get('/stream/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send existing log on connect
  const gen = db.prepare('SELECT log, status FROM generations WHERE id = ?').get(id);
  if (gen?.log) res.write(`event: log\ndata: ${JSON.stringify({ chunk: gen.log })}\n\n`);
  if (gen?.status !== 'running') {
    res.write(`event: done\ndata: ${JSON.stringify({ status: gen.status })}\n\n`);
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
    motion, outputDir, exportLabel,
  } = req.body;

  const sectionsArr = Array.isArray(sections) ? sections : (sections ? [sections] : []);
  const outputPath  = outputDir || path.join(os.homedir(), 'Desktop', 'divi-output');
  fs.mkdirSync(outputPath, { recursive: true });

  // Save uploaded designer export
  let exportPath = null;
  if (req.file) {
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
  const prompt = [
    `/divi5-tools:divi5-page-generator`,
    `Build a landing page for ${brand}. ${whatItDoes || ''}`,
    `Primary keyword: ${keyword}.${secondary}`,
    `Sections: ${sectionList}.`,
    aesthetic ? `Aesthetic: ${aesthetic}.` : '',
    `Primary CTA: "${ctaLabel || 'Get Started'}" linking to ${ctaUrl || '#'}.`,
    motionLine,
  ].filter(Boolean).join(' ');

  // Insert generation record
  const genId = db.prepare(`
    INSERT INTO generations (brand, keyword, sections, aesthetic, cta_label, cta_url, output_dir, export_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(brand, keyword, JSON.stringify(sectionsArr), aesthetic, ctaLabel, ctaUrl, outputPath, exportPath).lastInsertRowid;

  res.json({ id: genId });

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
    '--plugin-dir', PLUGIN_DIR, prompt], { cwd: outputPath });

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
    // Detect output files
    const files = fs.readdirSync(outputPath).filter(f => f.endsWith('.json'));
    const insertFile = db.prepare(`INSERT INTO output_files (generation_id, filename, filepath, kind) VALUES (?, ?, ?, ?)`);
    for (const f of files) {
      const kind = f.includes('seo-meta') ? 'seo-meta' :
                   f.includes('schema')   ? 'schema' :
                   f.includes('landing-page') || f.includes('-page') ? 'page' : 'other';
      // Avoid duplicate inserts on re-runs
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
          styleCheck = result.consistent ? 'consistent' : 'inconsistent';
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

    // Send final file list to UI
    const outputFiles = db.prepare('SELECT * FROM output_files WHERE generation_id=?').all(genId);
    sendSSE(genId, 'done', { status, styleCheck, files: outputFiles });

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
    try { execSync(`which ${c} 2>/dev/null || test -f ${c}`); return c; } catch (_) {}
  }
  try { return execSync('which claude').toString().trim(); } catch (_) { return null; }
}

function runStyleCheck(originalPath, generatedPath) {
  try {
    const out = execSync(`node "${STYLE_CHECK}" "${originalPath}" "${generatedPath}"`, { encoding: 'utf8' });
    return { consistent: true, report: out };
  } catch (e) {
    return { consistent: false, report: e.stdout || e.message };
  }
}

app.listen(PORT, () => {
  console.log(`Divi 5 Generator running at http://localhost:${PORT}`);
});
