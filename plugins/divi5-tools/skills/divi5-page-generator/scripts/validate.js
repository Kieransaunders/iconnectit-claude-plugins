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
 *
 * Taste checks (the one anti-slop rule that is deterministically checkable —
 * see references/taste.md sections 10/11):
 *   - Zero em-dash / en-dash characters in visible copy (FAIL). Use a hyphen "-".
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

// tokensByKey: parsed block-comment tokens keyed by content key. Populated inside
// the existing content loop below so a future render-safety module can re-walk
// the tokens without re-parsing (spec §4 "Required tweak to validate.js").
const tokensByKey = {};

for (const { key, content } of contents) {
  const tokens = parseBlocks(content);
  tokensByKey[key] = tokens; // (T1) retain parsed tokens for downstream re-walks
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

    // ─── DiviTheatre custom-attribute checks (pin category) ──────────────────
    // Read the canonical custom-attributes array (theatreAttrs() output shape).
    if (t.attrs) {
      const customAttrs = t.attrs.module?.decoration?.attributes?.desktop?.value?.attributes;
      if (Array.isArray(customAttrs)) {
        const get = n => {
          const hit = customAttrs.find(a => a && a.name === n);
          return hit ? String(hit.value) : null;
        };
        const theatre = get('data-theatre');
        const isPin = theatre && theatre.startsWith('pin:');

        // Collision guard (Pitfall 2b): a pin attribute and Divi's native sticky on
        // the SAME block are two pinning systems fighting. Native sticky lives at
        // module.decoration.sticky.{breakpoint}.value.position; "none"/absent = off.
        if (isPin) {
          const sticky = t.attrs.module?.decoration?.sticky;
          if (sticky && typeof sticky === 'object') {
            const active = Object.values(sticky).some(bp => {
              const pos = bp?.value?.position;
              return pos && pos !== 'none';
            });
            if (active) {
              err(`COLLISION: ${t.name} carries data-theatre="${theatre}" AND a native Divi sticky (decoration.sticky) — two pinning systems on one block. Remove the native sticky.`);
            }
          }
          // Distance format: vh only (engine falls back to 150vh, but a junk value is a generator bug).
          const dist = get('data-theatre-distance');
          if (dist != null && !/^\d+vh$/.test(dist)) {
            err(`PIN: data-theatre-distance="${dist}" on ${t.name} must match /^\\d+vh$/ (e.g. "200vh").`);
          }
        }

        // Part-role allowlist (ADR-001 §5): media|panel only.
        const part = get('data-theatre-part');
        if (part != null && !['media', 'panel'].includes(part)) {
          warn(`data-theatre-part="${part}" on ${t.name} is not a known role (media|panel) — it will be ignored by the engine.`);
        }
      }
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
const path = require('path');
const presetFirstMode = !doc.presets || Object.keys(doc.presets.module || {}).length === 0;
if (presetFirstMode && allPresetRefs.length) {
  // Preset-first workflow: presets must exist on the site. Require a registry file on disk
  // so we can cross-check IDs — silent trust of any ID was the phantom-ID bug (spec §1C).
  const dir = path.dirname(path.resolve(file));
  const candidates = [
    path.join(dir, 'et-preset-registry.json'),
    ...fs.readdirSync(dir).filter(f => f.endsWith('.presets.json')).map(f => path.join(dir, f)),
  ];
  const registryFile = candidates.find(p => fs.existsSync(p));

  if (!registryFile) {
    err(`PRESETS: ${allPresetRefs.length} modulePreset reference(s) in preset-first mode but no registry file found. ` +
        `Provide et-preset-registry.json or *.presets.json alongside the page, or bundle presets in the JSON instead.`);
  } else {
    const reg = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    // Registry shape: { presets: { "divi/x": { "Name": "id" | { id, attrs } } } } or bare map
    const regMap = reg.presets || reg;
    const registryIds = new Set();
    for (const moduleMap of Object.values(regMap)) {
      if (typeof moduleMap !== 'object') continue;
      for (const v of Object.values(moduleMap)) {
        if (typeof v === 'string') registryIds.add(v);
        else if (v && v.id) registryIds.add(String(v.id));
      }
    }
    let phantoms = 0;
    for (const ref of allPresetRefs) {
      if (!registryIds.has(String(ref.id))) {
        err(`PRESETS: modulePreset "${ref.id}" (${ref.module}) not found in ${path.basename(registryFile)} — phantom ID`);
        phantoms++;
      }
    }
    if (!phantoms) pass(`${allPresetRefs.length} preset references cross-checked against ${path.basename(registryFile)}`);
  }
} else {
  for (const ref of allPresetRefs) {
    if (!presetIndex[ref.id]) err(`modulePreset "${ref.id}" (${ref.module}) not defined in presets`);
    else if (presetIndex[ref.id] !== ref.module) warn(`preset "${ref.id}" is for ${presetIndex[ref.id]} but used on ${ref.module}`);
  }
  if (allPresetRefs.length) pass(`${allPresetRefs.length} preset references checked`);
  else warn('no modulePreset references found — presets are mandatory for maintainable layouts');
}

const definedColors = new Set((doc.global_colors || []).map(c => c[0]));
// Collect ET system gcids (pre-loaded on any Divi site, not stored in page global_colors)
const etSystemGcids = (() => {
  try {
    const tokenPath = require('path').join(__dirname, '../references/Divi design system JSON/divi-design-system.tokens.js');
    const T = require(tokenPath);
    const ids = new Set();
    for (const v of Object.values(T.colorRef || {})) {
      const m = v.match(/gcid-[a-z0-9]+/);
      if (m) ids.add(m[0]);
    }
    return ids;
  } catch { return new Set(); }
})();
// In preset-first mode, require a *.variables.json alongside the page so gcid refs
// can be validated — silently trusting any gcid was masking undefined variable bugs.
if (presetFirstMode && allGcidRefs.length) {
  const dir2 = path.dirname(path.resolve(file));
  const varFiles = fs.readdirSync(dir2).filter(f => f.endsWith('.variables.json'));
  if (!varFiles.length) {
    err(`GCID: ${allGcidRefs.length} gcid reference(s) in preset-first mode but no *.variables.json found alongside the page. ` +
        `Provide the matching variables file (from the style-variables skill or site export) or bundle global_colors in the JSON.`);
  }
}

for (const g of new Set(allGcidRefs)) {
  if (!definedColors.has(g) && !etSystemGcids.has(g)) {
    // In preset-first mode, custom brand colours (gcid-ryw-*, gcid-brand-*) are
    // registered separately via /presets/import — not bundled in the page JSON.
    if (presetFirstMode) { /* skip — colours live on site, not in this file */ }
    else err(`global colour "${g}" referenced but not defined in global_colors`);
  }
}
if (definedColors.size) pass(`${definedColors.size} global colours defined, references checked`);

// ─── button enable check ─────────────────────────────────────────────────────
// A button preset missing enable:'on' renders Divi's default blue regardless of
// any colour variables. This is the #1 cause of "default blue buttons on import".
;(() => {
  const hasEnable = (attrs) =>
    attrs?.button?.decoration?.button?.desktop?.value?.enable === 'on';

  let buttonFails = 0;

  // Group presets (divi/button group — used by groupPreset.button on block)
  const groupItems = doc.presets?.group?.['divi/button']?.items || {};
  for (const [id, item] of Object.entries(groupItems)) {
    if (!hasEnable(item.attrs)) {
      err(`BUTTON: group preset "${item.name || id}" missing button.decoration.button.enable:"on" — will render default blue`);
      buttonFails++;
    }
  }

  // Module presets (divi/button module preset)
  const moduleItems = doc.presets?.module?.['divi/button']?.items || {};
  for (const [id, item] of Object.entries(moduleItems)) {
    if (!hasEnable(item.attrs)) {
      err(`BUTTON: module preset "${item.name || id}" missing button.decoration.button.enable:"on" — will render default blue`);
      buttonFails++;
    }
  }

  // Inline button blocks with no preset reference (enable must be on the block itself)
  for (const blockList of Object.values(tokensByKey)) {
    for (const t of blockList) {
      if (t.name !== 'button' || !t.attrs) continue;
      const hasGroupPreset = t.attrs.groupPreset?.button?.presetId?.length > 0;
      const hasModulePreset = Array.isArray(t.attrs.modulePreset) && t.attrs.modulePreset.length > 0;
      if (hasGroupPreset || hasModulePreset) continue;
      if (!hasEnable(t.attrs)) {
        const label = t.attrs.button?.innerContent?.desktop?.value?.text || '(unlabelled)';
        err(`BUTTON: inline button "${String(label).slice(0, 40)}" has no preset and missing enable:"on" — will render default blue`);
        buttonFails++;
      }
    }
  }

  if (!buttonFails) pass('all button presets and inline buttons have enable:"on"');
})();

// ─── ET design system token check ───────────────────────────────────────────
// FAIL when a raw hex colour in the JSON matches a known Elegant Themes token.
// Generators must use builder.colorRef('Label') instead of hard-coded hex.
;(() => {
  const path = require('path');
  const tokenFile = path.join(__dirname, '../references/Divi design system JSON/divi-design-system.tokens.js');
  if (!fs.existsSync(tokenFile)) return; // token file absent — skip silently

  const etTokens = require(tokenFile);
  const { colorHex = {}, colorId = {} } = etTokens;

  // colorId maps label → gcid. Build reverse: gcid → label.
  const gcidToLabel = {};
  for (const [label, gcid] of Object.entries(colorId)) gcidToLabel[gcid] = label;

  // Build hex → human label map (lowercase hex keys)
  const hexToLabel = {};
  for (const [gcid, val] of Object.entries(colorHex)) {
    const hex = (typeof val === 'string' ? val : (val && val.resolvesTo) || null);
    if (!hex) continue;
    const label = gcidToLabel[gcid];
    if (label) hexToLabel[hex.toLowerCase()] = label;
  }

  const hexRe = /#([0-9a-fA-F]{3,8})\b/g;
  let tokenHits = 0;
  for (const blockList of Object.values(tokensByKey)) {
    for (const t of blockList) {
      if (!t.attrs) continue;
      // Variable refs resolve in: font, text, link, icon, divider colour paths.
      // They do NOT resolve in: background, button, border, boxShadow — those require raw hex.
      // Only flag raw hex in paths where refs would actually work, to avoid false positives.
      const aStr = JSON.stringify(t.attrs)
        .replace(/"background":\{[^}]+\}/g, '"background":{}')
        .replace(/"button":\{"desktop":[^}]+\}/g, '"button":{}')
        .replace(/"border":\{[^}]+\}/g, '"border":{}')
        .replace(/"boxShadow":\{[^}]+\}/g, '"boxShadow":{}');
      let m;
      const re = new RegExp(hexRe.source, hexRe.flags);
      while ((m = re.exec(aStr)) !== null) {
        const hex = m[0].toLowerCase();
        if (hexToLabel[hex]) {
          err(`TOKEN: raw colour ${m[0]} in ${t.name} matches ET token "${hexToLabel[hex]}" — use builder.colorRef('${hexToLabel[hex]}') instead`);
          tokenHits++;
        }
      }
    }
  }
  if (!tokenHits) pass('no raw hex values matched ET design system tokens');
})();

// ─── taste: banned-glyph scan (deterministic) ───────────────────────────────
// The em-dash is the #1 AI tell. references/taste.md §11 bans it (and en-dash as
// a separator) in all user-visible copy. Divi structure uses only ASCII, so any
// U+2014/U+2013 (or its HTML entity) lives in copy values — safe to FAIL on.
//
// The banned set is configurable so a future render-safety module can own/extend
// it (spec §4 RS-GLYPH). Default = dashes only (literal chars + their HTML
// entities, so behaviour is byte-identical to the old hard-coded regex). Override
// with `--ban-glyphs "…"` to ban additional literal characters.
//
// The default source is shared with divi-builder.js via scripts/glyphs.js so the
// "what the generator avoids" and "what the validator flags" lists cannot drift.
const { DEFAULT_GLYPH_SOURCE, buildGlyphRe } = require('./glyphs');
const GLYPH_SOURCE = argValue('--ban-glyphs') != null ? argValue('--ban-glyphs') : DEFAULT_GLYPH_SOURCE;
const glyphRe = buildGlyphRe(GLYPH_SOURCE);
const dashHits = [];
for (const { content } of contents) {
  let m;
  const re = new RegExp(glyphRe.source, glyphRe.flags);
  while ((m = re.exec(content)) !== null) {
    const start = Math.max(0, m.index - 30);
    dashHits.push('…' + content.slice(start, m.index + 30).replace(/\s+/g, ' ').trim() + '…');
  }
}
if (dashHits.length) {
  err(`TASTE: ${dashHits.length} em-dash/en-dash in copy — banned (use a hyphen "-"). First: ${dashHits.slice(0, 3).join('  |  ')}`);
} else {
  pass('TASTE: no em-dash/en-dash in copy');
}

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
