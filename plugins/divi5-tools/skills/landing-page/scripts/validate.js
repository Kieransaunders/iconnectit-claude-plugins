#!/usr/bin/env node
/**
 * validate.js — Deterministic validator + SEO report card for Divi 5 JSON exports.
 *
 * Usage:
 *   node validate.js <layout.json> [--keyword "primary keyword"] [--meta seo-meta.json]
 *
 * Exit code 0 = no errors (warnings allowed), 1 = errors found.
 *
 * Structural checks:
 *   - JSON parses; context is et_builder or et_builder_layouts; data shape matches context
 *   - Block comments balanced; placeholder wrapper present
 *   - builderVersion on every block
 *   - Nesting hierarchy (modules only inside columns; rows in sections/columns; columns in rows)
 *   - Every modulePreset reference exists in presets
 *   - Every gcid- variable reference exists in global_colors
 *
 * SEO checks:
 *   - Exactly one h1 (heading modules' headingLevel + <h1> tags in text modules)
 *   - No skipped heading levels in document outline
 *   - All images have non-empty alt text
 *   - Keyword present in h1, first text content, and >=1 h2 (when --keyword given)
 *   - Title <=60 chars, description <=155 chars (when --meta given)
 *   - Responsive: non-full-width columns define phone flexType
 */

'use strict';

const fs = require('fs');

const STRUCTURAL = new Set(['placeholder', 'section', 'row', 'column', 'group']);
const ALLOWED_CHILDREN = {
  placeholder: new Set(['section']),
  section: new Set(['row']),
  row: new Set(['column']),
  // column and group can contain any module plus nested rows/groups
};
const CONTAINER_ONLY_CHILD = {
  accordion: 'accordion-item',
  'icon-list': 'icon-list-item',
  'pricing-tables': 'pricing-table',
  slider: 'slide',
  'video-slider': 'video-slider-item',
  'contact-form': 'contact-field',
  'social-media-follow': 'social-media-follow-network',
  'group-carousel': 'group',
};

const errors = [];
const warnings = [];
const passes = [];
function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function pass(msg) { passes.push(msg); }

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('Usage: node validate.js <layout.json> [--keyword "kw"] [--meta seo-meta.json]'); process.exit(1); }
const keyword = argValue('--keyword');
const metaFile = argValue('--meta');
function argValue(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; }

// ─── load + top-level shape ─────────────────────────────────────────────────

let doc;
try {
  doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  pass('JSON parses');
} catch (e) {
  console.error(`FATAL: JSON does not parse: ${e.message}`);
  process.exit(1);
}

if (!['et_builder', 'et_builder_layouts'].includes(doc.context)) err(`context is "${doc.context}" — must be et_builder or et_builder_layouts`);
else pass(`context: ${doc.context}`);

const contents = [];
for (const [key, val] of Object.entries(doc.data || {})) {
  if (doc.context === 'et_builder') {
    if (typeof val !== 'string') err(`data["${key}"] must be a string for et_builder`);
    else contents.push({ key, content: val });
  } else {
    if (typeof val !== 'object' || typeof val.post_content !== 'string') err(`data["${key}"] must be a post object with post_content for et_builder_layouts`);
    else contents.push({ key, content: val.post_content, title: val.post_title });
  }
}
if (!contents.length) err('data is empty');

// ─── parse block comments ───────────────────────────────────────────────────

function parseBlocks(content) {
  const tokens = [];
  const re = /<!--\s*(\/?)wp:divi\/([a-z-]+)(\s+(\{[\s\S]*?\}))?\s*(\/?)-->/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let attrs = null;
    if (m[4]) {
      try { attrs = JSON.parse(m[4]); }
      catch (e) { err(`Unparseable attrs on ${m[2]}: ${e.message.slice(0, 80)}`); }
    }
    tokens.push({ closing: m[1] === '/', name: m[2], attrs, selfClosing: m[5] === '/' });
  }
  return tokens;
}

const allPresetRefs = [];
const allGcidRefs = [];
const headingOutline = []; // {level, text}
const imagesMissingAlt = [];
let textBlocks = [];
let blockCount = 0;

for (const { key, content } of contents) {
  const tokens = parseBlocks(content);
  if (!tokens.length) { err(`data["${key}"]: no Divi blocks found`); continue; }
  if (tokens[0].name !== 'placeholder') err(`data["${key}"]: content must start with wp:divi/placeholder`);

  // nesting + balance
  const stack = [];
  for (const t of tokens) {
    if (t.closing) {
      const top = stack.pop();
      if (!top || top !== t.name) err(`Unbalanced: closing ${t.name} but open stack top is ${top || 'empty'}`);
      continue;
    }
    blockCount++;
    const parent = stack[stack.length - 1] || null;

    // builderVersion (placeholder exempt)
    if (t.name !== 'placeholder' && (!t.attrs || !t.attrs.builderVersion)) err(`${t.name}: missing builderVersion`);

    // hierarchy
    if (parent && ALLOWED_CHILDREN[parent] && !ALLOWED_CHILDREN[parent].has(t.name)) {
      err(`${t.name} cannot be a direct child of ${parent}`);
    }
    if (parent && CONTAINER_ONLY_CHILD[parent] && t.name !== CONTAINER_ONLY_CHILD[parent]) {
      err(`${parent} may only contain ${CONTAINER_ONLY_CHILD[parent]}, found ${t.name}`);
    }
    if (!STRUCTURAL.has(t.name) && !Object.values(CONTAINER_ONLY_CHILD).includes(t.name)) {
      if (parent && !['column', 'group'].includes(parent) && !CONTAINER_ONLY_CHILD[parent]) {
        err(`module ${t.name} must be inside a column/group, found inside ${parent || 'root'}`);
      }
    }

    const aStr = t.attrs ? JSON.stringify(t.attrs) : '';

    // preset + colour refs
    if (t.attrs && Array.isArray(t.attrs.modulePreset)) allPresetRefs.push({ module: `divi/${t.name}`, id: t.attrs.modulePreset[0] });
    for (const g of aStr.matchAll(/gcid-[a-z0-9-]+/g)) allGcidRefs.push(g[0]);

    // headings
    if (t.name === 'heading' && t.attrs) {
      const level = (aStr.match(/"headingLevel":"(h[1-6])"/) || [])[1];
      const txt = t.attrs.title?.innerContent?.desktop?.value || '';
      if (!level) warn(`heading "${String(txt).slice(0, 40)}": no explicit headingLevel (defaults to h2)`);
      headingOutline.push({ level: level || 'h2', text: String(txt) });
    }
    if (t.name === 'blurb' && t.attrs) {
      const level = (aStr.match(/"headingLevel":"(h[1-6])"/) || [])[1] || 'h4';
      const txt = t.attrs.title?.innerContent?.desktop?.value?.text || '';
      headingOutline.push({ level, text: String(txt) });
    }
    if (t.name === 'text' && t.attrs) {
      const html = t.attrs.content?.innerContent?.desktop?.value || '';
      textBlocks.push(String(html));
      for (const h of String(html).matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
        headingOutline.push({ level: `h${h[1]}`, text: h[2].replace(/<[^>]+>/g, '') });
      }
    }

    // images
    if (t.name === 'image' && t.attrs) {
      const v = t.attrs.image?.innerContent?.desktop?.value || {};
      if (!v.alt || !String(v.alt).trim()) imagesMissingAlt.push(v.src || '(no src)');
    }

    // responsive columns
    if (t.name === 'column' && t.attrs) {
      const ft = t.attrs.module?.decoration?.sizing?.desktop?.value?.flexType;
      const phoneFt = t.attrs.module?.decoration?.sizing?.phone?.value?.flexType;
      if (ft && ft !== '24_24' && !phoneFt) warn(`column flexType ${ft}: no phone flexType override (won't stack on mobile)`);
    }

    if (!t.selfClosing) stack.push(t.name);
  }
  if (stack.length) err(`Unclosed blocks: ${stack.join(' > ')}`);
}
pass(`${blockCount} blocks parsed, hierarchy + balance checked`);

// ─── preset + colour reference integrity ────────────────────────────────────

const presetIndex = {};
for (const [mod, group] of Object.entries(doc.presets?.module || {})) {
  for (const id of Object.keys(group.items || {})) presetIndex[id] = mod;
}
for (const ref of allPresetRefs) {
  if (!presetIndex[ref.id]) err(`modulePreset "${ref.id}" (${ref.module}) not defined in presets`);
  else if (presetIndex[ref.id] !== ref.module) warn(`preset "${ref.id}" is for ${presetIndex[ref.id]} but used on ${ref.module}`);
}
if (allPresetRefs.length) pass(`${allPresetRefs.length} preset references checked`);
else warn('no modulePreset references found — presets are mandatory for maintainable layouts');

const definedColors = new Set((doc.global_colors || []).map(c => c[0]));
for (const g of new Set(allGcidRefs)) {
  if (!definedColors.has(g)) err(`global colour "${g}" referenced but not defined in global_colors`);
}
if (definedColors.size) pass(`${definedColors.size} global colours defined, references checked`);

// ─── SEO report card ────────────────────────────────────────────────────────

console.log('\n── SEO report card ──');

const h1s = headingOutline.filter(h => h.level === 'h1');
if (h1s.length === 0) err('SEO: no h1 on the page — the hero heading must be level h1');
else if (h1s.length > 1) err(`SEO: ${h1s.length} h1s found — must be exactly one (${h1s.map(h => h.text.slice(0, 30)).join(' | ')})`);
else pass(`SEO: exactly one h1 ("${h1s[0].text.slice(0, 60)}")`);

// outline order: no skips
let prev = 0;
for (const h of headingOutline) {
  const n = parseInt(h.level[1], 10);
  if (prev && n > prev + 1) warn(`SEO: heading outline skips from h${prev} to h${n} at "${h.text.slice(0, 40)}"`);
  prev = n;
}
pass(`SEO: outline checked (${headingOutline.length} headings)`);

if (imagesMissingAlt.length) err(`SEO: ${imagesMissingAlt.length} image(s) missing alt text: ${imagesMissingAlt.join(', ')}`);
else pass('SEO: all images have alt text');

if (keyword) {
  const kw = keyword.toLowerCase();
  const inH1 = h1s.some(h => h.text.toLowerCase().includes(kw));
  const inH2 = headingOutline.some(h => h.level === 'h2' && h.text.toLowerCase().includes(kw));
  const firstText = textBlocks.slice(0, 3).join(' ').replace(/<[^>]+>/g, ' ').toLowerCase();
  if (!inH1) err(`SEO: keyword "${keyword}" not in h1`);
  else pass('SEO: keyword in h1');
  if (!inH2) warn(`SEO: keyword "${keyword}" not in any h2`);
  else pass('SEO: keyword in >=1 h2');
  if (!firstText.includes(kw)) warn(`SEO: keyword "${keyword}" not in opening copy`);
  else pass('SEO: keyword in opening copy');
}

if (metaFile) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    if (meta.title && meta.title.length > 60) warn(`SEO: title tag ${meta.title.length} chars (max 60)`);
    else if (meta.title) pass(`SEO: title tag length ok (${meta.title.length})`);
    if (meta.description && meta.description.length > 155) warn(`SEO: meta description ${meta.description.length} chars (max 155)`);
    else if (meta.description) pass(`SEO: meta description length ok (${meta.description.length})`);
    if (keyword && meta.title && !meta.title.toLowerCase().includes(keyword.toLowerCase())) warn('SEO: keyword not in title tag');
  } catch (e) { warn(`could not read meta file: ${e.message}`); }
}

// ─── report ─────────────────────────────────────────────────────────────────

console.log('\n── results ──');
for (const p of passes) console.log(`  PASS  ${p}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
