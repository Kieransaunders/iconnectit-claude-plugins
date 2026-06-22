#!/usr/bin/env node
/**
 * taste-check.js — Deterministic AI-tell and slop detector for Divi 5 pages.
 *
 * Usage:  node taste-check.js <layout.json>
 * Exit:   0 = all pass · 1 = fail
 *
 * Checks (all deterministic — no WordPress required):
 *   TASTE-EM       Em-dash or en-dash in visible copy (always banned)
 *   TASTE-AI-TELL  Corporate buzzwords in h1/h2 ("Unlock", "Leverage", etc.)
 *   TASTE-H1-VERB  h1 starts with a verb ("Build", "Get", "Discover", etc.)
 *   TASTE-3CARDS   3+ blurb modules in one section with body lengths within ±25%
 *
 * See: references/taste.md §10, §11, §14
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('Usage: node taste-check.js <layout.json>'); process.exit(1); }

let doc;
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`FATAL: JSON does not parse: ${e.message}`); process.exit(1); }

const errors   = [];
const warnings = [];
const passes   = [];
function err(msg)  { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function pass(msg) { passes.push(msg); }

// ─── parse block-comment tokens ──────────────────────────────────────────────

function parseBlocks(content) {
  const tokens = [];
  const re = /<!--\s*(\/?)wp:divi\/([a-z-]+)(\s+(\{[\s\S]*?\}))?\s*(\/?)-->/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let attrs = null;
    if (m[4]) { try { attrs = JSON.parse(m[4]); } catch (_) {} }
    tokens.push({ closing: m[1] === '/', name: m[2], attrs, self: m[5] === '/' });
  }
  return tokens;
}

function innerText(attrs) {
  if (!attrs) return '';
  const s = JSON.stringify(attrs);
  let m;
  m = s.match(/"innerContent":\{"desktop":\{"value":"([^"]{1,400})"/);
  if (m) return m[1].replace(/<[^>]+>/g, '').replace(/\\[rnt]/g, ' ').replace(/\\u[0-9a-f]{4}/gi, '?').trim();
  m = s.match(/"innerContent":\{"desktop":\{"value":\{"text":"([^"]{1,400})"/);
  if (m) return m[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

// Build section-grouped outline
const sections = []; // [{ modules: [{type, level?, text, bodyLen?}] }]

for (const val of Object.values(doc.data || {})) {
  const content = typeof val === 'string' ? val : (val && val.post_content) || '';
  const tokens  = parseBlocks(content);
  let sect = null;

  for (const t of tokens) {
    if (t.closing) {
      if (t.name === 'section' && sect) { sections.push(sect); sect = null; }
      continue;
    }
    if (t.name === 'section') { sect = { modules: [] }; continue; }
    if (!sect || ['row', 'column', 'group', 'placeholder'].includes(t.name)) continue;

    const entry = { type: t.name };
    if (t.name === 'heading') {
      const s = JSON.stringify(t.attrs || '');
      entry.level = (s.match(/"headingLevel":"(h[1-6])"/) || [])[1] || 'h2';
      entry.text  = innerText(t.attrs);
    } else if (t.name === 'blurb') {
      const bodyJson = t.attrs?.content?.innerContent?.desktop?.value || '';
      entry.bodyLen = String(bodyJson).replace(/<[^>]+>/g, '').trim().length;
      entry.text = innerText(t.attrs);
    } else {
      entry.text = innerText(t.attrs).slice(0, 200);
    }
    sect.modules.push(entry);
  }
}

// ─── TASTE-EM: em-dash / en-dash in visible copy ─────────────────────────────

const EM_RE = /[—–]|&mdash;|&ndash;|&#8212;|&#8211;/g;
let emHits = 0;
const emExamples = [];
for (const val of Object.values(doc.data || {})) {
  const content = typeof val === 'string' ? val : (val && val.post_content) || '';
  let m;
  const re = new RegExp(EM_RE.source, EM_RE.flags);
  while ((m = re.exec(content)) !== null) {
    emHits++;
    if (emExamples.length < 3) {
      emExamples.push('…' + content.slice(Math.max(0, m.index - 25), m.index + 30).replace(/\s+/g, ' ').trim() + '…');
    }
  }
}
if (emHits) err(`TASTE-EM: ${emHits} em/en-dash in copy — use a hyphen "-". First: ${emExamples.join(' | ')}`);
else pass('TASTE-EM: no em-dash or en-dash in copy');

// ─── TASTE-AI-TELL: banned corporate buzzwords in h1/h2 ─────────────────────

const AI_TELL_WORDS = [
  'Unlock', 'Leverage', 'Transform', 'Seamlessly', 'Streamline', 'Elevate',
  'Supercharge', 'Revolutionize', 'Unleash', 'Empower', 'Harness', 'Reimagine',
];
const AI_TELL_RE = new RegExp(`\\b(${AI_TELL_WORDS.join('|')})\\b`, 'i');

const topHeadings = sections.flatMap(s => s.modules.filter(m => m.type === 'heading' && (m.level === 'h1' || m.level === 'h2')));
const aiTells = topHeadings.filter(h => AI_TELL_RE.test(h.text));
if (aiTells.length) {
  err(`TASTE-AI-TELL: AI buzzword in h1/h2 — "${aiTells.map(h => h.text.slice(0, 60)).join('" | "')}". Rewrite without: ${AI_TELL_WORDS.slice(0,6).join(', ')}, etc.`);
} else {
  pass('TASTE-AI-TELL: no corporate buzzwords in h1/h2');
}

// ─── TASTE-H1-VERB: h1 should not start with a verb ─────────────────────────

const VERB_STARTS = /^(Build|Get|Discover|Find|Start|Try|Join|See|Make|Create|Grow|Scale|Run|Use|Boost|Drive|Help|Take|Learn|Save|Improve|Increase|Reduce|Achieve|Deliver|Enable|Maximize|Optimize)\b/i;
const h1s = sections.flatMap(s => s.modules.filter(m => m.type === 'heading' && m.level === 'h1'));
const verbH1 = h1s.filter(h => VERB_STARTS.test(h.text.trim()));
if (verbH1.length) {
  warn(`TASTE-H1-VERB: h1 starts with a verb — "${verbH1[0].text.slice(0, 60)}". Strong h1s open with a noun, number, or adjective.`);
} else {
  pass('TASTE-H1-VERB: h1 does not start with a generic verb');
}

// ─── TASTE-3CARDS: three equal-length blurb bodies in one section ────────────

let threeCardHits = 0;
for (const sect of sections) {
  const blurbs = sect.modules.filter(m => m.type === 'blurb' && m.bodyLen > 0);
  if (blurbs.length < 3) continue;
  // Check each run of 3 consecutive blurbs for equal-ish lengths
  for (let i = 0; i <= blurbs.length - 3; i++) {
    const lens = blurbs.slice(i, i + 3).map(b => b.bodyLen);
    const avg  = lens.reduce((a, b) => a + b, 0) / lens.length;
    const maxDev = Math.max(...lens.map(l => Math.abs(l - avg) / avg));
    if (maxDev <= 0.25) {
      threeCardHits++;
      warn(`TASTE-3CARDS: 3 blurbs in a section have body lengths within ±25% (${lens.join('/')} chars) — the "three equal feature cards" AI tell. Vary lengths or drop one.`);
      break;
    }
  }
}
if (!threeCardHits) pass('TASTE-3CARDS: no equal-length three-card blurb rows detected');

// ─── report ──────────────────────────────────────────────────────────────────

console.log('\n── taste-check results ──');
for (const p of passes)   console.log(`  PASS  ${p}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors)   console.log(`  FAIL  ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
