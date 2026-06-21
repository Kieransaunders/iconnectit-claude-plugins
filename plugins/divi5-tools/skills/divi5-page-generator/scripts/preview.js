#!/usr/bin/env node
/**
 * preview.js — Render a Divi 5 JSON file as a standalone HTML page
 *
 * Usage:
 *   node preview.js <landing-page.json> [--out preview.html] [--open]
 *
 * Parses the Divi 5 block-comment tree, resolves presets + global colours,
 * and emits a styled HTML page that closely mirrors what Divi would render.
 * Designed as a fidelity check between the HTML design preview and the
 * generated JSON — run after validate.js, before import.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const jsonFile = args.find(a => !a.startsWith('--'));
const outArg  = args[args.indexOf('--out') + 1];
const doOpen  = args.includes('--open');

if (!jsonFile) {
  console.error('Usage: node preview.js <landing-page.json> [--out preview.html] [--open]');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

// ─── Resolve global colours ───────────────────────────────────────────────────

const globalColors = {};  // name → hex

function collectGlobalColors(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.id && obj.color && typeof obj.color === 'string' && obj.color.startsWith('#')) {
    globalColors[obj.id] = obj.color;
    if (obj.name) globalColors[obj.name] = obj.color;
  }
  for (const v of Object.values(obj)) collectGlobalColors(v);
}

if (raw.globalColors) {
  for (const item of Object.values(raw.globalColors)) collectGlobalColors(item);
}
// Also pick up colour definitions inside presets
collectGlobalColors(raw.presets);

/** Resolve a $variable(...)$ reference to a hex colour, or return raw string. */
function resolveColor(val) {
  if (!val || typeof val !== 'string') return val;
  const m = val.match(/\$variable\((.+?)\)\$/);
  if (!m) return val;
  try {
    const obj = JSON.parse(m[1]);
    const name = obj?.value?.name;
    return globalColors[name] || val;
  } catch { return val; }
}

// ─── Resolve presets ──────────────────────────────────────────────────────────

const presetMap = {};  // id → attrs object

if (raw.presets?.module) {
  for (const moduleName of Object.keys(raw.presets.module)) {
    const modulePresets = raw.presets.module[moduleName];
    const items = modulePresets.items || {};
    for (const [id, preset] of Object.entries(items)) {
      presetMap[id] = preset.attrs || preset.styleAttrs || {};
    }
  }
}

/** Deep-merge b into a (b wins). */
function merge(a, b) {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])
        && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
      out[k] = merge(a[k], b[k]);
    } else { out[k] = b[k]; }
  }
  return out;
}

/** Resolve preset ids into a merged attrs object. */
function resolvePresets(modulePreset, inlineAttrs) {
  let base = {};
  if (Array.isArray(modulePreset)) {
    for (const id of modulePreset) {
      if (presetMap[id]) base = merge(base, presetMap[id]);
    }
  } else if (modulePreset && presetMap[modulePreset]) {
    base = merge(base, presetMap[modulePreset]);
  }
  return merge(base, inlineAttrs || {});
}

// ─── Block comment parser ─────────────────────────────────────────────────────

/**
 * Parse the Divi 5 block-comment string into a tree of nodes:
 *   { type, attrs, children }
 * where `attrs` is the parsed JSON object from the comment.
 */
function parseBlocks(str) {
  const nodes = [];
  const stack = [{ children: nodes }];

  // Tokenise into open, self-closing, and close tags
  const re = /<!--\s*(\/wp:divi\/\S+|wp:divi\/\S+(?:\s+\{.*?\})?\s*\/?)\s*-->/gs;
  let match;

  while ((match = re.exec(str)) !== null) {
    const tag = match[1].trim();

    if (tag.startsWith('/wp:divi/')) {
      // Close tag
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = tag.endsWith('/-->') || match[0].trimEnd().endsWith('/-->');
    const nameMatch = tag.match(/^wp:divi\/(\S+)/);
    if (!nameMatch) continue;
    const type = nameMatch[1].replace(/\s.*$/, '');

    let attrsStr = tag.replace(/^wp:divi\/\S+\s*/, '').replace(/\s*\/?$/, '').trim();
    let attrs = {};
    if (attrsStr) {
      try { attrs = JSON.parse(attrsStr); } catch { /* skip malformed */ }
    }

    const node = { type, attrs, children: [] };
    stack[stack.length - 1].children.push(node);

    if (!selfClosing && !match[0].includes('-->') /* open tag */) {
      // Actually all container tags are non-self-closing; detect via tag content
    }
    // Push containers onto stack
    if (!match[0].replace('<!--', '').replace('-->', '').trim().endsWith('/')) {
      stack.push(node);
    }
  }

  return nodes;
}

// Re-parse using a cleaner two-pass tokeniser
function parseBlocksV2(str) {
  const tokens = [];
  const re = /<!--\s*(wp:divi\/[\w-]+)((?:\s+\{[\s\S]*?\})?)\s*(\/?)-->/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const name = m[1].replace('wp:divi/', '');
    let attrs = {};
    const attrsStr = m[2].trim();
    if (attrsStr) { try { attrs = JSON.parse(attrsStr); } catch {} }
    const selfClose = m[3] === '/';
    tokens.push({ name, attrs, selfClose, close: false });
  }
  // Also capture closing tags
  const re2 = /<!--\s*\/wp:divi\/([\w-]+)\s*-->/g;
  let m2;
  const closeTokens = [];
  while ((m2 = re2.exec(str)) !== null) {
    closeTokens.push({ name: m2[1], close: true, pos: m2.index });
  }

  // Build tree by interleaving open/self-close/close tokens in source order
  const allRe = /<!--\s*(\/?)wp:divi\/([\w-]+)((?:\s+\{[\s\S]*?\})?)\s*(\/?)-->/g;
  const root = { type: '__root__', attrs: {}, children: [] };
  const stack = [root];

  let am;
  while ((am = allRe.exec(str)) !== null) {
    const isClose = am[1] === '/';
    const type = am[2];
    const attrsStr = am[3].trim();
    const isSelf = am[4] === '/';
    let attrs = {};
    if (attrsStr) { try { attrs = JSON.parse(attrsStr); } catch {} }

    if (isClose) {
      if (stack.length > 1) stack.pop();
    } else {
      const node = { type, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!isSelf) stack.push(node);
    }
  }
  return root.children;
}

// ─── HTML renderer ────────────────────────────────────────────────────────────

/** Extract a desktop value from a responsive object. */
function deskVal(obj) {
  if (!obj) return undefined;
  if (obj.desktop?.value !== undefined) return obj.desktop.value;
  return obj.value;
}

/** Pull inline styles from a decoration sub-tree. */
function extractStyles(decoration) {
  if (!decoration) return {};
  const styles = {};

  const bg = deskVal(decoration.background);
  if (bg?.color) styles['background-color'] = resolveColor(bg.color);
  if (bg?.gradient) styles['background'] = 'linear-gradient(135deg, var(--c1,#111), var(--c2,#222))';

  const spacing = deskVal(decoration.spacing);
  if (spacing?.padding) {
    const p = spacing.padding;
    styles['padding'] = [p.top, p.right || p.left, p.bottom, p.left].filter(Boolean).join(' ');
  }
  if (spacing?.margin) {
    const p = spacing.margin;
    styles['margin'] = [p.top, p.right || p.left, p.bottom, p.left].filter(Boolean).join(' ');
  }

  const sizing = deskVal(decoration.sizing);
  if (sizing?.maxWidth) styles['max-width'] = sizing.maxWidth;
  if (sizing?.width) styles['width'] = sizing.width;

  const border = deskVal(decoration.border);
  if (border?.styles?.all?.width) {
    styles['border'] = `${border.styles.all.width} ${border.styles.all.style || 'solid'} ${resolveColor(border.color?.desktop?.value?.all) || '#ccc'}`;
  }
  if (border?.radii?.desktop?.value?.syncedInput) {
    styles['border-radius'] = border.radii.desktop.value.syncedInput;
  }

  return styles;
}

/** Convert a style object to an inline style string. */
function toStyle(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(';');
}

/** Merge two style objects. */
function mergeStyles(...objects) {
  return Object.assign({}, ...objects);
}

/** Resolve a node's full attrs by merging presets + inline. */
function resolveNode(node) {
  return resolvePresets(node.attrs.modulePreset, node.attrs);
}

// ── Module renderers ──────────────────────────────────────────────────────────

function renderChildren(children) {
  return (children || []).map(renderNode).join('\n');
}

function renderSection(node) {
  const attrs = resolveNode(node);
  const styles = extractStyles(attrs.module?.decoration);
  // Default section style
  const base = { 'padding': '80px 20px', 'width': '100%', 'box-sizing': 'border-box' };
  const merged = mergeStyles(base, styles);
  return `<section style="${toStyle(merged)}">\n<div style="max-width:1200px;margin:0 auto;">\n${renderChildren(node.children)}\n</div>\n</section>`;
}

function renderRow(node) {
  const attrs = resolveNode(node);
  const layout = deskVal(attrs.module?.decoration?.layout) || {};
  const styles = {
    'display': 'flex',
    'flex-wrap': layout.flexWrap || 'wrap',
    'gap': layout.columnGap || '24px',
    'max-width': deskVal(attrs.module?.decoration?.sizing)?.maxWidth || '1200px',
    'margin': '0 auto',
    'align-items': layout.alignItems || 'flex-start',
  };
  return `<div style="${toStyle(styles)}">\n${renderChildren(node.children)}\n</div>`;
}

const FLEX_MAP = {
  '24_24': '100%', '12_24': '48%', '16_24': '64%', '8_24': '30%',
  '6_24': '22%', '18_24': '72%', '4_24': '14%', '20_24': '80%',
};

function renderColumn(node) {
  const attrs = resolveNode(node);
  const flexType = deskVal(attrs.module?.decoration?.sizing)?.flexType || '24_24';
  const width = FLEX_MAP[flexType] || '100%';
  const styles = extractStyles(attrs.module?.decoration);
  const base = { 'flex': `1 1 ${width}`, 'min-width': '0', 'box-sizing': 'border-box' };
  return `<div style="${toStyle(mergeStyles(base, styles))}">\n${renderChildren(node.children)}\n</div>`;
}

function renderHeading(node) {
  const attrs = resolveNode(node);
  const content = deskVal(attrs.title?.innerContent) || '';
  const fontAttrs = deskVal(attrs.title?.decoration?.font?.font) || {};
  const level = fontAttrs.headingLevel || 'h2';
  const color = resolveColor(fontAttrs.color);
  const size = fontAttrs.size;
  const weight = fontAttrs.weight;
  const align = fontAttrs.textAlign;
  const styles = {};
  if (color) styles['color'] = color;
  if (size) styles['font-size'] = size;
  if (weight) styles['font-weight'] = weight;
  if (align) styles['text-align'] = align;
  const styleStr = toStyle(styles);
  return `<${level} style="${styleStr}">${content}</${level}>`;
}

function renderText(node) {
  const attrs = resolveNode(node);
  const content = deskVal(attrs.content?.innerContent) || '';
  const bodyFont = deskVal(attrs.content?.decoration?.bodyFont?.body?.font) || {};
  const modSize = deskVal(attrs.module?.decoration?.sizing);
  const styles = {};
  if (bodyFont.color) styles['color'] = resolveColor(bodyFont.color);
  if (bodyFont.size) styles['font-size'] = bodyFont.size;
  if (bodyFont.textAlign) styles['text-align'] = bodyFont.textAlign;
  if (modSize?.maxWidth) styles['max-width'] = modSize.maxWidth;
  return `<div style="${toStyle(styles)}">${content}</div>`;
}

function renderImage(node) {
  const attrs = resolveNode(node);
  const img = deskVal(attrs.image?.innerContent) || {};
  const src = img.src || '';
  const alt = img.alt || '';
  return `<img src="${src}" alt="${alt}" style="width:100%;height:auto;display:block;border-radius:4px;">`;
}

function renderButton(node) {
  const attrs = resolveNode(node);
  const btn = deskVal(attrs.button?.innerContent) || {};
  const text = btn.text || 'Button';
  const href = btn.linkUrl || '#';
  const fontAttrs = deskVal(attrs.button?.decoration?.font?.font) || {};
  const spacing = deskVal(attrs.button?.decoration?.spacing) || {};
  const bg = deskVal(attrs.button?.decoration?.background) || {};
  const border = deskVal(attrs.button?.decoration?.border) || {};

  const color = resolveColor(fontAttrs.color) || '#fff';
  const bgColor = resolveColor(bg.color) || '#1a1a1a';
  const pad = spacing.padding
    ? `${spacing.padding.top || '14px'} ${spacing.padding.right || '28px'} ${spacing.padding.bottom || '14px'} ${spacing.padding.left || '28px'}`
    : '14px 28px';
  const radius = border?.radii?.syncedInput || '4px';

  return `<a href="${href}" style="display:inline-block;padding:${pad};background:${bgColor};color:${color};text-decoration:none;border-radius:${radius};font-weight:${fontAttrs.weight || '600'};font-size:${fontAttrs.size || '15px'};">${text}</a>`;
}

function renderAccordion(node) {
  return `<div style="margin:16px 0;">${renderChildren(node.children)}</div>`;
}

function renderAccordionItem(node) {
  const attrs = resolveNode(node);
  const title = deskVal(attrs.title?.innerContent) || '';
  const content = deskVal(attrs.content?.innerContent) || '';
  const open = deskVal(attrs.module?.advanced?.open) === 'on' ? ' open' : '';
  return `<details${open} style="border:1px solid rgba(255,255,255,0.1);border-radius:4px;margin:8px 0;padding:0;">
  <summary style="padding:16px 20px;cursor:pointer;font-weight:600;list-style:none;">${title}</summary>
  <div style="padding:0 20px 16px;">${content}</div>
</details>`;
}

function renderDivider(node) {
  return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;">`;
}

function renderSpacer(node) {
  const attrs = resolveNode(node);
  const height = deskVal(attrs.module?.decoration?.sizing)?.height || '40px';
  return `<div style="height:${height};"></div>`;
}

function renderVideo(node) {
  const attrs = resolveNode(node);
  const src = deskVal(attrs.video?.innerContent)?.src || '';
  if (!src) return '';
  return `<video controls style="width:100%;border-radius:4px;"><source src="${src}"></video>`;
}

function renderCode(node) {
  const attrs = resolveNode(node);
  const content = deskVal(attrs.content?.innerContent) || '';
  return `<div style="font-size:14px;">${content}</div>`;
}

function renderPlaceholder(node) {
  return renderChildren(node.children);
}

const RENDERERS = {
  'placeholder':    renderPlaceholder,
  'section':        renderSection,
  'row':            renderRow,
  'column':         renderColumn,
  'heading':        renderHeading,
  'text':           renderText,
  'image':          renderImage,
  'button':         renderButton,
  'accordion':      renderAccordion,
  'accordion-item': renderAccordionItem,
  'divider':        renderDivider,
  'spacer':         renderSpacer,
  'video':          renderVideo,
  'code':           renderCode,
  'fullwidth-header': (node) => {
    const attrs = resolveNode(node);
    const bg = resolveColor(deskVal(attrs.module?.decoration?.background)?.color);
    const styles = { 'background': bg || '#111', 'padding': '120px 40px', 'text-align': 'center', 'width': '100%', 'box-sizing': 'border-box' };
    return `<section style="${toStyle(styles)}">${renderChildren(node.children)}</section>`;
  },
};

function renderNode(node) {
  const renderer = RENDERERS[node.type];
  if (renderer) return renderer(node);
  // Generic fallback: render children
  return renderChildren(node.children);
}

// ─── Assemble HTML ────────────────────────────────────────────────────────────

// The Divi JSON data is stored in data["1"] as a string
const blockString = raw.data?.['1'] || raw.data?.[1] || '';
if (!blockString) {
  console.error('No page data found in JSON (expected data["1"]).');
  process.exit(1);
}

const tree = parseBlocksV2(blockString);
const pageHtml = tree.map(renderNode).join('\n');

// Detect page title from the first h1 in the output
const titleMatch = pageHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : path.basename(jsonFile, '.json');

// Pick a sensible background colour from the most common section preset
const pageBg = Object.values(globalColors)[0] || '#111111';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Preview — ${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fraunces:ital,wght@0,300;0,700;1,300&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', system-ui, sans-serif;
      background: ${pageBg};
      color: #e8e8e8;
      line-height: 1.6;
      font-size: 16px;
    }
    h1,h2,h3,h4,h5,h6 { line-height: 1.2; margin: 0 0 0.5em; font-family: inherit; }
    h1 { font-size: clamp(2rem,5vw,4rem); font-weight: 800; }
    h2 { font-size: clamp(1.5rem,3vw,2.5rem); font-weight: 700; }
    h3 { font-size: clamp(1.1rem,2vw,1.5rem); font-weight: 600; }
    p  { margin: 0 0 1em; }
    img { max-width: 100%; }
    details > summary::-webkit-details-marker { display: none; }
    a { color: inherit; }

    /* Preview banner */
    .preview-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #f59e0b; color: #000; font-size: 12px; font-weight: 600;
      text-align: center; padding: 6px;
      font-family: system-ui, sans-serif;
      letter-spacing: .05em;
    }
    body { padding-top: 30px; }
  </style>
</head>
<body>
  <div class="preview-banner">DIVI JSON PREVIEW — ${path.basename(jsonFile)} — Fidelity check before import</div>
  ${pageHtml}
</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────

const outFile = outArg || jsonFile.replace(/\.json$/, '-preview.html');
fs.writeFileSync(outFile, html);
console.log(`Preview written: ${outFile}`);

if (doOpen) {
  const { execSync } = require('child_process');
  try {
    execSync(`open "${outFile}"`);
    console.log('Opened in browser.');
  } catch {
    console.log('Run: open "' + outFile + '"');
  }
}
