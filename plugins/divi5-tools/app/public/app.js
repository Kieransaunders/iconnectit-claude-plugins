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

// ─── ET Pages dropdown ────────────────────────────────────────────────────────
async function loadEtPages() {
  try {
    const pages = await fetch('/et-pages').then(r => r.json());
    const sel = document.getElementById('etTemplate');
    pages.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.slug;
      opt.textContent = p.title.replace(/ - Page$/, '');
      opt.dataset.sections = p.sections.join(', ');
      sel.appendChild(opt);
    });
  } catch {}
}

document.getElementById('etTemplate').addEventListener('change', (e) => {
  const opt = e.target.selectedOptions[0];
  const hint    = document.getElementById('etTemplateSections');
  const note    = document.getElementById('sectionsNote');
  const hasTemplate = !!e.target.value;
  if (hasTemplate && opt.dataset.sections) {
    hint.textContent = 'Sections: ' + opt.dataset.sections;
    hint.style.display = '';
    note.style.display = '';
  } else {
    hint.style.display = 'none';
    note.style.display = 'none';
  }
});

// ─── Step tracker ────────────────────────────────────────────────────────────
const STEP_PATTERNS = [
  { id: 'step-clone',      triggers: ['Stage 0', 'ET template', 'ET pack template', 'Cloned', 'clone'] },
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
  const badge = document.createElement('span');
  if (styleCheck === 'consistent') {
    badge.className = 'badge pass';
    badge.textContent = '✓ Style consistent';
  } else if (styleCheck === 'error') {
    badge.className = 'badge warn';
    badge.textContent = '⚠ Style check error';
  } else {
    badge.className = 'badge fail';
    badge.textContent = '✖ Style inconsistent';
  }
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

  // Clear revision notes now that they're captured in FormData
  document.getElementById('revisionNotes').value = '';
  document.getElementById('revisionNotesField').style.display = 'none';

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
      const { status, styleCheck, files, hasPreview } = JSON.parse(ev.data);
      es.close();
      completeAllSteps(status);
      btn.disabled = false;
      btn.textContent = 'Generate Page';

      if (files && files.length) {
        currentGenId = id;
        renderFiles(id, files);
        renderVerdicts(styleCheck);
        renderStyleCheckDetails(logBox.textContent || '');
        document.getElementById('outputPanel').style.display = '';
        document.getElementById('importRow').style.display = '';
        document.getElementById('importStatus').textContent = '';
        document.getElementById('previewLink').style.display = 'none';
      }

      if (hasPreview) showHtmlPreview(id);

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
      const hasPreview = r.status === 'complete' && !!r.has_preview;
      return `
        <div class="history-item" onclick="loadGeneration(${r.id})">
          <div>
            <div class="h-brand">${r.brand}</div>
            <div class="h-meta">${r.keyword} · ${r.sections.join(', ')}</div>
            <div class="h-meta">${r.created_at}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${hasPreview ? `<button type="button" class="btn-view" onclick="viewMockup(${r.id}, event)" title="View mockup">View</button>` : ''}
            <button type="button" class="btn-rerun" onclick="openRevisionDrawer(${r.id}, event)">Re-run</button>
            <button type="button" class="btn-delete" onclick="deleteGeneration(${r.id}, event)" title="Delete">✕</button>
            <span style="color:${statusColor};font-weight:600">${statusIcon}</span>
          </div>
        </div>
        <div class="revision-drawer" id="drawer-${r.id}" style="display:none">
          <div class="revision-label">Revision notes <span class="revision-hint">(optional — describe what to change)</span></div>
          <textarea class="revision-textarea" id="revision-${r.id}" placeholder="e.g. Make the hero headline punchier, add a pricing section, use darker colours"></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="button" class="btn-generate" style="flex:1;padding:8px" onclick="rerunGeneration(${r.id}, event)">Generate revised page</button>
            <button type="button" class="btn-secondary" onclick="closeRevisionDrawer(${r.id}, event)">Cancel</button>
          </div>
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
    currentGenId = id;
    renderFiles(id, gen.files);
    renderVerdicts(gen.style_check);
    renderStyleCheckDetails(gen.log || '');
    document.getElementById('outputPanel').style.display = '';
    document.getElementById('importRow').style.display = '';
    document.getElementById('importStatus').textContent = gen.import_status === 'imported' ? 'Already imported' : '';
    const link = document.getElementById('previewLink');
    if (gen.preview_url) {
      link.href = gen.preview_url;
      link.style.display = 'inline-block';
    } else {
      link.style.display = 'none';
    }
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

// ─── Saved exports dropdown ───────────────────────────────────────────────────
async function loadExports() {
  try {
    const exports = await fetch('/exports').then(r => r.json());
    const sel = document.getElementById('savedExportSelect');
    // Remove all but first placeholder option
    while (sel.options.length > 1) sel.remove(1);
    exports.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.label} (${e.brand}, ${e.preset_count} presets)`;
      sel.appendChild(opt);
    });
  } catch {}
}

document.getElementById('savedExportSelect').addEventListener('change', (e) => {
  const dropZone = document.getElementById('dropZone');
  const exportLabelField = document.getElementById('exportLabelField');
  const hiddenSavedId = document.getElementById('savedExportId');
  if (e.target.value) {
    dropZone.style.display = 'none';
    exportLabelField.style.display = 'none';
    hiddenSavedId.value = e.target.value;
  } else {
    dropZone.style.display = '';
    hiddenSavedId.value = '';
  }
});

// ─── Browse / pick folder ─────────────────────────────────────────────────────
document.getElementById('pickFolderBtn').addEventListener('click', async () => {
  try {
    const { path } = await fetch('/pick-folder').then(r => r.json());
    if (path) document.getElementById('outputDir').value = path;
  } catch {}
});

// ─── Import to WordPress ──────────────────────────────────────────────────────
let currentGenId = null;

document.getElementById('importBtn').addEventListener('click', async () => {
  if (!currentGenId) return;
  const btn    = document.getElementById('importBtn');
  const status = document.getElementById('importStatus');
  const link   = document.getElementById('previewLink');
  btn.disabled = true;
  btn.textContent = 'Importing…';
  status.textContent = '';
  link.style.display = 'none';
  try {
    const r = await fetch(`/import/${currentGenId}`, { method: 'POST' });
    const data = await r.json();
    if (data.ok) {
      status.innerHTML = '<span class="style-pass">Imported as draft</span>';
      if (data.previewUrl) {
        link.href = data.previewUrl;
        link.style.display = 'inline-block';
      }
    } else {
      status.innerHTML = `<span class="style-fail">Import failed: ${data.error}</span>`;
    }
  } catch (err) {
    status.innerHTML = `<span class="style-fail">Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import to WordPress';
  }
});

// ─── Test connection ──────────────────────────────────────────────────────────
document.getElementById('testConnection').addEventListener('click', async () => {
  const el = document.getElementById('connectionResult');
  el.textContent = 'Testing…';
  try {
    const data = await fetch('/test-connection').then(r => r.json());
    if (data.ok) {
      el.innerHTML = '<span class="style-pass">Connected successfully</span>';
    } else {
      el.innerHTML = `<span class="style-fail">Failed: ${data.error}</span>`;
    }
  } catch (err) {
    el.innerHTML = `<span class="style-fail">Error: ${err.message}</span>`;
  }
});

// ─── Re-run a past generation ─────────────────────────────────────────────────
function viewMockup(id, event) {
  event.stopPropagation();
  showHtmlPreview(id);
}

function openRevisionDrawer(id, event) {
  event.stopPropagation();
  // Close any other open drawers
  document.querySelectorAll('.revision-drawer').forEach(d => d.style.display = 'none');
  const drawer = document.getElementById(`drawer-${id}`);
  if (drawer) {
    drawer.style.display = '';
    drawer.querySelector('textarea').focus();
  }
}

function closeRevisionDrawer(id, event) {
  event.stopPropagation();
  const drawer = document.getElementById(`drawer-${id}`);
  if (drawer) drawer.style.display = 'none';
}

async function deleteGeneration(id, event) {
  event.stopPropagation();
  if (!confirm('Delete this generation from history?')) return;
  await fetch(`/generations/${id}`, { method: 'DELETE' });
  loadHistory();
}

async function rerunGeneration(id, event) {
  event.stopPropagation();
  try {
    const data = await fetch(`/rerun/${id}`, { method: 'POST' }).then(r => r.json());
    if (data.error) return;

    // Capture revision notes before switching tabs
    const revisionNotes = (document.getElementById(`revision-${id}`)?.value || '').trim();

    const form = document.getElementById('genForm');
    form.querySelector('[name=brand]').value             = data.brand || '';
    form.querySelector('[name=whatItDoes]').value        = data.what_it_does || '';
    form.querySelector('[name=keyword]').value           = data.keyword || '';
    form.querySelector('[name=secondaryKeywords]').value = data.secondary_keywords || '';
    form.querySelector('[name=ctaLabel]').value          = data.cta_label || '';
    form.querySelector('[name=ctaUrl]').value            = data.cta_url || '';
    document.getElementById('outputDir').value      = data.output_dir || '';
    document.getElementById('revisionNotes').value  = revisionNotes;

    // Sections checkboxes
    form.querySelectorAll('[name=sections]').forEach(cb => {
      cb.checked = Array.isArray(data.sections) && data.sections.includes(cb.value);
    });

    // Aesthetic radio
    form.querySelectorAll('[name=aesthetic]').forEach(r => {
      r.checked = r.value === (data.aesthetic || '');
    });

    // ET template
    const etSel = document.getElementById('etTemplate');
    etSel.value = data.et_template || '';
    etSel.dispatchEvent(new Event('change'));

    // Switch to generate tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab=generate]').classList.add('active');
    document.getElementById('tab-generate').hidden = false;
    document.getElementById('tab-settings').hidden  = true;

    if (revisionNotes) {
      document.getElementById('revisionNotesField').style.display = '';
    }

    // Auto-submit so the user gets immediate feedback
    form.requestSubmit();

  } catch {}
}

// ─── Style check details panel ────────────────────────────────────────────────
function renderStyleCheckDetails(logText) {
  const panel = document.getElementById('styleCheckDetails');
  if (!logText) { panel.style.display = 'none'; return; }
  // Scope to the style-check report — the full log also carries the render
  // validator's "all checks pass" summary, which reads as contradictory next
  // to an INCONSISTENT style verdict (they measure different things).
  const start = logText.indexOf('STYLE CONSISTENCY REPORT');
  const report = start === -1 ? logText : logText.slice(start);
  const lines = report.split('\n');
  // Keep the verdict, section headers, and the ✖/⚠/✓ detail bullets (the
  // bullets don't contain the words FAIL/WARN, so match on the glyphs too).
  const relevant = lines.filter(l => /FAIL|WARN|VERDICT|CONSISTENT|INCONSISTENT|[✖⚠✓]/.test(l));
  if (!relevant.length) { panel.style.display = 'none'; return; }
  const html = relevant.map(l => {
    const cls = /✖|FAIL|INCONSISTENT/.test(l) ? 'style-fail' :
                /⚠|WARN/.test(l) ? 'style-warn' : 'style-pass';
    const escaped = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="${cls}">${escaped}</div>`;
  }).join('');
  panel.innerHTML = '<strong style="font-size:0.75rem;color:var(--muted);display:block;margin-bottom:6px">STYLE CHECK DETAILS</strong>' + html;
  panel.style.display = '';
}

// ─── Saved Briefs ────────────────────────────────────────────────────────────
async function loadBriefs() {
  try {
    const briefs = await fetch('/briefs').then(r => r.json());
    const sel = document.getElementById('savedBriefSelect');
    while (sel.options.length > 1) sel.remove(1);
    briefs.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      opt.dataset.brief = JSON.stringify(b.data);
      sel.appendChild(opt);
    });
  } catch {}
}

document.getElementById('savedBriefSelect').addEventListener('change', (e) => {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.dataset.brief) return;
  const d = JSON.parse(opt.dataset.brief);
  const form = document.getElementById('genForm');
  if (d.brand)             form.querySelector('[name=brand]').value = d.brand;
  if (d.whatItDoes)        form.querySelector('[name=whatItDoes]').value = d.whatItDoes;
  if (d.keyword)           form.querySelector('[name=keyword]').value = d.keyword;
  if (d.secondaryKeywords) form.querySelector('[name=secondaryKeywords]').value = d.secondaryKeywords;
  if (d.ctaLabel)          form.querySelector('[name=ctaLabel]').value = d.ctaLabel;
  if (d.ctaUrl)            form.querySelector('[name=ctaUrl]').value = d.ctaUrl;
  if (d.outputDir)         document.getElementById('outputDir').value = d.outputDir;
  if (d.sections) {
    form.querySelectorAll('[name=sections]').forEach(cb => {
      cb.checked = d.sections.includes(cb.value);
    });
  }
  if (d.aesthetic) {
    form.querySelectorAll('[name=aesthetic]').forEach(r => { r.checked = r.value === d.aesthetic; });
  }
  if (d.motion) {
    form.querySelectorAll('[name=motion]').forEach(r => { r.checked = r.value === d.motion; });
  }
  if (d.etTemplate !== undefined) {
    const sel = document.getElementById('etTemplate');
    sel.value = d.etTemplate || '';
    sel.dispatchEvent(new Event('change'));
  }
  e.target.value = ''; // reset dropdown after loading
});

document.getElementById('saveBriefBtn').addEventListener('click', async () => {
  const name = prompt('Brief name:');
  if (!name) return;
  const form = document.getElementById('genForm');
  const data = {
    brand:             form.querySelector('[name=brand]').value,
    whatItDoes:        form.querySelector('[name=whatItDoes]').value,
    keyword:           form.querySelector('[name=keyword]').value,
    secondaryKeywords: form.querySelector('[name=secondaryKeywords]').value,
    ctaLabel:          form.querySelector('[name=ctaLabel]').value,
    ctaUrl:            form.querySelector('[name=ctaUrl]').value,
    outputDir:         document.getElementById('outputDir').value,
    sections:          [...form.querySelectorAll('[name=sections]:checked')].map(c => c.value),
    aesthetic:         form.querySelector('[name=aesthetic]:checked')?.value || '',
    motion:            form.querySelector('[name=motion]:checked')?.value || 'no',
    etTemplate:        document.getElementById('etTemplate').value || '',
  };
  await fetch('/briefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  });
  await loadBriefs();
});

// ─── HTML Preview panel ───────────────────────────────────────────────────────
function showHtmlPreview(genId) {
  const panel = document.getElementById('previewPanel');
  const frame = document.getElementById('previewFrame');
  if (!panel || !frame) return;
  frame.src = `/preview-html/${genId}?t=${Date.now()}`;
  panel.style.display = '';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Revision notes field ─────────────────────────────────────────────────────
document.getElementById('clearRevision').addEventListener('click', () => {
  document.getElementById('revisionNotes').value = '';
  document.getElementById('revisionNotesField').style.display = 'none';
});

// ─── Init ────────────────────────────────────────────────────────────────────
checkPrereqs();
loadHistory();
loadSettings();
loadExports();
loadBriefs();
loadEtPages();
