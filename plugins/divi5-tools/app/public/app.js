'use strict';

// ─── Prerequisites check ─────────────────────────────────────────────────────
async function checkPrereqs() {
  const el = document.getElementById('prereqs');
  el.innerHTML = '<div class="prereq"><span>Checking…</span></div>';
  try {
    const r = await fetch('/prereqs');
    const { claudeFound, claudeVersion } = await r.json();
    el.innerHTML = claudeFound
      ? `<div class="prereq"><span class="ok">✓</span> Claude Code ${claudeVersion}</div>`
      : `<div class="prereq"><span class="fail">✗</span> Claude Code not found — <a href="https://claude.ai/download" target="_blank" style="color:var(--accent)">install it</a></div>`;
  } catch {
    el.innerHTML = '<div class="prereq"><span class="fail">✗</span> Server not responding</div>';
  }
}

// ─── File drop zone ──────────────────────────────────────────────────────────
const dropZone    = document.getElementById('dropZone');
const exportInput = document.getElementById('exportInput');
const exportName  = document.getElementById('exportName');
const exportLabelField = document.getElementById('exportLabelField');

exportInput.addEventListener('change', () => {
  const f = exportInput.files[0];
  if (f) {
    exportName.textContent = f.name;
    exportLabelField.style.display = '';
  }
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.json')) {
    const dt = new DataTransfer();
    dt.items.add(f);
    exportInput.files = dt.files;
    exportName.textContent = f.name;
    exportLabelField.style.display = '';
  }
});

// ─── Step tracker ────────────────────────────────────────────────────────────
const STEP_PATTERNS = [
  { id: 'step-brief',      triggers: ['Stage 1', 'Brief', 'Reading this as', 'Design Read', 'dials set'] },
  { id: 'step-preview',    triggers: ['Stage 2', 'HTML Preview', 'preview-', 'taste pre-flight', 'Approved'] },
  { id: 'step-generate',   triggers: ['Stage 3', 'Generate', 'Validator', 'validate.js', 'FAILs', '0 errors'] },
  { id: 'step-stylecheck', triggers: ['STYLE CHECK', 'style-check', 'CONSISTENT', 'INCONSISTENT'] },
];

let activeStep = null;

function advanceStep(text) {
  for (const s of STEP_PATTERNS) {
    if (s.triggers.some(t => text.includes(t))) {
      if (activeStep !== s.id) {
        if (activeStep) {
          const prev = document.getElementById(activeStep);
          if (prev) prev.className = 'step done';
        }
        activeStep = s.id;
        const el = document.getElementById(s.id);
        if (el) el.className = 'step active';
      }
    }
  }
}

function completeAllSteps(status) {
  STEP_PATTERNS.forEach(s => {
    const el = document.getElementById(s.id);
    if (!el) return;
    if (el.classList.contains('active') || el.classList.contains('done')) {
      el.className = status === 'failed' ? 'step fail' : 'step done';
    }
  });
}

// ─── Log rendering ───────────────────────────────────────────────────────────
const logBox = document.getElementById('logBox');

function appendLog(text) {
  // Colorise key patterns
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(✓[^\n]*|CONSISTENT[^\n]*|0 errors[^\n]*)/g, '<span class="log-pass">$1</span>')
    .replace(/(✖[^\n]*|INCONSISTENT[^\n]*|FAIL[^\n]*)/g, '<span class="log-fail">$1</span>')
    .replace(/(⚠[^\n]*|WARN[^\n]*)/g,  '<span class="log-warn">$1</span>')
    .replace(/(^#{1,3} .+|^={3,}|^─{3,}|STYLE CONSISTENCY REPORT|VERDICT:.*)/gm,
             '<span class="log-head">$1</span>');
  logBox.insertAdjacentHTML('beforeend', html);
  logBox.scrollTop = logBox.scrollHeight;
  advanceStep(text);
}

// ─── Output files ─────────────────────────────────────────────────────────────
function renderFiles(genId, files) {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  files.forEach(f => {
    const icon = f.kind === 'page' ? '📄' : f.kind === 'seo-meta' ? '🔍' : f.kind === 'schema' ? '🧩' : '📁';
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <div class="file-info">
        <span class="file-icon">${icon}</span>
        <div>
          <div class="file-name-text">${f.filename}</div>
          <div class="file-kind">${f.kind}</div>
        </div>
      </div>
      <a class="btn-dl" href="/download/${genId}/${encodeURIComponent(f.filename)}" download="${f.filename}">Download</a>
    `;
    list.appendChild(row);
  });
}

function renderVerdicts(styleCheck) {
  const el = document.getElementById('verdicts');
  el.innerHTML = '';
  if (!styleCheck || styleCheck === 'skipped') return;
  const pass = styleCheck === 'consistent';
  const badge = document.createElement('span');
  badge.className = `badge ${pass ? 'pass' : 'fail'}`;
  badge.textContent = pass ? '✓ Style consistent' : '✖ Style inconsistent';
  el.appendChild(badge);
}

// ─── Form submit ─────────────────────────────────────────────────────────────
document.getElementById('genForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Reset UI
  logBox.innerHTML = '';
  document.getElementById('fileList').innerHTML = '';
  document.getElementById('verdicts').innerHTML = '';
  document.getElementById('progressPanel').style.display = '';
  document.getElementById('logPanel').style.display = '';
  document.getElementById('outputPanel').style.display = 'none';
  STEP_PATTERNS.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) el.className = 'step';
  });
  activeStep = null;

  const btn = document.getElementById('genBtn');
  btn.disabled = true;
  btn.textContent = 'Generating…';

  const form   = e.target;
  const data   = new FormData(form);

  try {
    const res  = await fetch('/generate', { method: 'POST', body: data });
    const { id } = await res.json();

    // Open SSE stream
    const es = new EventSource(`/stream/${id}`);

    es.addEventListener('log', ev => {
      const { chunk } = JSON.parse(ev.data);
      appendLog(chunk);
    });

    es.addEventListener('done', ev => {
      const { status, styleCheck, files } = JSON.parse(ev.data);
      es.close();
      completeAllSteps(status);
      btn.disabled = false;
      btn.textContent = 'Generate Page';

      if (files && files.length) {
        renderFiles(id, files);
        renderVerdicts(styleCheck);
        document.getElementById('outputPanel').style.display = '';
      }

      loadHistory();
    });

    es.onerror = () => {
      es.close();
      btn.disabled = false;
      btn.textContent = 'Generate Page';
    };

  } catch (err) {
    appendLog(`\nError: ${err.message}\n`);
    btn.disabled = false;
    btn.textContent = 'Generate Page';
  }
});

// ─── History ─────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const rows = await fetch('/generations').then(r => r.json());
    const list = document.getElementById('historyList');
    if (!rows.length) {
      list.innerHTML = '<div class="empty">No generations yet — fill in the form and click Generate.</div>';
      return;
    }
    list.innerHTML = rows.map(r => {
      const statusIcon = r.status === 'complete' ? '✓' : r.status === 'failed' ? '✖' : '…';
      const statusColor = r.status === 'complete' ? 'var(--success)' : r.status === 'failed' ? 'var(--danger)' : 'var(--warn)';
      return `
        <div class="history-item" onclick="loadGeneration(${r.id})">
          <div>
            <div class="h-brand">${r.brand}</div>
            <div class="h-meta">${r.keyword} · ${r.sections.join(', ')}</div>
            <div class="h-meta">${r.created_at}</div>
          </div>
          <span style="color:${statusColor};font-weight:600">${statusIcon}</span>
        </div>
      `;
    }).join('');
  } catch {}
}

async function loadGeneration(id) {
  const gen = await fetch(`/generations/${id}`).then(r => r.json());
  logBox.innerHTML = '';
  appendLog(gen.log || '(no log)');
  document.getElementById('logPanel').style.display = '';
  document.getElementById('progressPanel').style.display = 'none';
  if (gen.files && gen.files.length) {
    renderFiles(id, gen.files);
    renderVerdicts(gen.style_check);
    document.getElementById('outputPanel').style.display = '';
  }
}

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    document.getElementById('tab-generate').hidden = target !== 'generate';
    document.getElementById('tab-settings').hidden  = target !== 'settings';
  });
});

// ─── Settings load / save ─────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const s = await fetch('/settings').then(r => r.json());
    if (s.siteUrl) document.getElementById('siteUrl').value = s.siteUrl;
    if (s.apiKey)  document.getElementById('apiKey').value  = s.apiKey;
  } catch {}
}

document.getElementById('saveSettings').addEventListener('click', async () => {
  const siteUrl = document.getElementById('siteUrl').value.trim();
  const apiKey  = document.getElementById('apiKey').value.trim();
  await fetch('/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, apiKey }),
  });
  const confirm = document.getElementById('settingsSaved');
  confirm.removeAttribute('hidden');
  setTimeout(() => confirm.setAttribute('hidden', ''), 2500);
});

// ─── Plugin info toggle ───────────────────────────────────────────────────────
const pluginToggle = document.getElementById('pluginInfoToggle');
const pluginInfo   = document.getElementById('pluginInfo');
pluginToggle.addEventListener('click', () => {
  const open = pluginInfo.hasAttribute('hidden');
  pluginInfo.toggleAttribute('hidden', !open);
  pluginToggle.textContent = open ? 'Hide' : 'How to install';
  pluginToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// ─── DiviTheatre info toggle ─────────────────────────────────────────────────
const theatreToggle = document.getElementById('theatreInfoToggle');
const theatreInfo   = document.getElementById('theatreInfo');
theatreToggle.addEventListener('click', () => {
  const open = theatreInfo.hasAttribute('hidden');
  if (open) {
    theatreInfo.removeAttribute('hidden');
    theatreToggle.textContent = 'Hide';
    theatreToggle.setAttribute('aria-expanded', 'true');
  } else {
    theatreInfo.setAttribute('hidden', '');
    theatreToggle.textContent = 'What is this?';
    theatreToggle.setAttribute('aria-expanded', 'false');
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────
checkPrereqs();
loadHistory();
loadSettings();
