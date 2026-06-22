#!/usr/bin/env node
'use strict';

/**
 * et-pages.js — ET pack clone helper (Phase 0)
 *
 * Indexes the 24 premade pages from Divi-5-Launch-Freebie_Pages.json and
 * outputs importable JSON files that can be sent directly to the /import endpoint.
 *
 * Usage (CLI):
 *   node et-pages.js list
 *   node et-pages.js clone "services" [output.json]
 *   node et-pages.js match "landing page for a services company"
 *
 * Usage (module):
 *   const { list, match, clone } = require('./et-pages');
 */

const fs   = require('fs');
const path = require('path');

const PACK = path.join(
  __dirname,
  '../references/Divi design system JSON/Divi-5-Launch-Freebie_Pages.json'
);

// ponytail: loaded once per process — the file is 1.2 MB and only needed on demand
let _pack = null;
function pack() {
  if (!_pack) _pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  return _pack;
}

/** Extract section adminLabels from a post_content block-comment string. */
function sections(content) {
  const labels = [];
  const re = /<!-- wp:divi\/section ([^>]+)-->/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    try {
      const attrs = JSON.parse(m[1].trim());
      labels.push(attrs.module?.meta?.adminLabel?.desktop?.value || '?');
    } catch (_) { labels.push('?'); }
  }
  return labels;
}

/**
 * List all 24 ET pack pages with their section outlines.
 * @returns {{ id: number, title: string, slug: string, sections: string[] }[]}
 */
function list() {
  return Object.values(pack().data).map(p => ({
    id:       p.ID,
    title:    p.post_title,
    slug:     p.post_title.toLowerCase().replace(/\s*-\s*page$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    sections: sections(p.post_content),
  }));
}

/**
 * Return the best-matching ET pack page entry for a keyword/phrase, or null.
 * Tries (in order): exact slug, slug substring, title substring.
 */
function match(keyword) {
  const kw    = keyword.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').trim();
  const pages = list();

  // exact slug
  let hit = pages.find(p => p.slug === kw);
  if (hit) return hit;

  // slug appears in keyword — prefer longer slugs to avoid "service" beating "services"
  const byLength = [...pages].sort((a, b) => b.slug.length - a.slug.length);
  hit = byLength.find(p => kw.includes(p.slug));
  if (hit) return hit;

  // keyword word appears in slug
  const kwWords = kw.split(/\s+/);
  hit = pages.find(p => kwWords.some(w => w.length > 2 && p.slug.split('-').includes(w)));
  if (hit) return hit;

  // title substring
  hit = pages.find(p => p.title.toLowerCase().includes(kw));
  return hit || null;
}

/**
 * Build an importable JSON object from the best-matching ET pack page.
 * The output can be written to disk and POSTed to /wp-json/divi-tools/v1/import.
 *
 * @param {string} keyword  Page type keyword, e.g. "services", "pricing", "home"
 * @returns {{ context, data, presets, global_colors, global_variables, ... } | null}
 */
function clone(keyword) {
  const hit = match(keyword);
  if (!hit) return null;

  const p   = pack();
  const src = Object.values(p.data).find(pg => pg.ID === hit.id);

  return {
    context:          'et_builder',
    data:             { '1': src.post_content },
    presets:          p.presets          || {},
    global_colors:    p.global_colors    || [],
    global_variables: p.global_variables || [],
    canvases:         [],
    images:           {},
    thumbnails:       [],
    // Carry the original title so callers can surface it
    _et_source_title: src.post_title,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const [,, cmd, ...args] = process.argv;

  if (cmd === 'list') {
    list().forEach(p => {
      console.log(`${p.slug.padEnd(28)} ${p.sections.join(' › ')}`);
    });

  } else if (cmd === 'match') {
    const kw = args.join(' ');
    const hit = match(kw);
    if (hit) {
      console.log(`Matched: "${hit.title}" (slug: ${hit.slug})`);
      console.log('Sections:', hit.sections.join(' › '));
    } else {
      console.log(`No match for "${kw}"`);
      console.log('Available slugs:', list().map(p => p.slug).join(', '));
    }

  } else if (cmd === 'clone') {
    const [keyword, outFile] = args;
    if (!keyword) {
      console.error('Usage: et-pages.js clone <keyword> [output.json]');
      process.exit(1);
    }
    const result = clone(keyword);
    if (!result) {
      console.error(`No ET pack page matching "${keyword}"`);
      console.error('Run "node et-pages.js list" to see available pages.');
      process.exit(1);
    }
    const out = outFile || `et-${keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-page.json`;
    // Remove the internal _et_source_title before writing
    const { _et_source_title, ...output } = result;
    fs.writeFileSync(out, JSON.stringify(output, null, 2));
    console.log(`Cloned "${_et_source_title}" → ${out}`);
    console.log('Sections:', list().find(p => p.title === _et_source_title)?.sections.join(' › '));

  } else {
    console.log('Commands:');
    console.log('  node et-pages.js list                        — list all 24 ET pack pages');
    console.log('  node et-pages.js match <keyword>             — show best match for a keyword');
    console.log('  node et-pages.js clone <keyword> [out.json]  — write importable JSON');
  }
}

module.exports = { list, match, clone };
