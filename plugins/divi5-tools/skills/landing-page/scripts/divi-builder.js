/**
 * divi-builder.js — Divi 5 JSON generator library
 *
 * Build page content as plain JS objects/strings; JSON.stringify handles ALL
 * escaping (block-comment attrs once, top-level data string twice). Never
 * hand-write escaped JSON.
 *
 * Usage:
 *   const D = require('./divi-builder');
 *   const b = D.createBuilder();                      // preset + colour registry
 *   b.globalColor('accent', '#F95E00', 'Accent');
 *   const heroPreset = b.preset('divi/heading', 'Hero H1', {...});
 *   const content = D.placeholder([ D.section({...}, [ ...rows ]) ]);
 *   const json = b.assemble({ context: 'et_builder', content, title: 'My Page' });
 *   fs.writeFileSync('out.json', JSON.stringify(json));
 */

'use strict';

const BUILDER_VERSION = '5.0.0-public-beta.9.1';
const CRLF = '\r\n';

// Single source of truth for the banned-glyph set lives in scripts/glyphs.js.
// The emitter does NOT rewrite author copy in Phase 0 (the risk of mangling
// intentional glyphs outweighs the benefit); this import exists solely so the
// default ban list cannot drift between "what the generator avoids emitting"
// and "what the validator flags" (spec §4 RS-GLYPH, Phase 0 plan T5).
const { DEFAULT_GLYPH_SOURCE: SHARED_GLYPH_SOURCE } = require('./glyphs');

// ─── core helpers ───────────────────────────────────────────────────────────

/** Deep-merge b into a (b wins). Arrays are replaced, not merged. */
function merge(a, b) {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
      out[k] = merge(a[k], b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}

/** Remove undefined/empty-object branches so attrs stay minimal. */
function prune(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = prune(obj[k]);
      if (v === undefined) continue;
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      out[k] = v;
    }
    return out;
  }
  return obj;
}

/** Shorthand: wrap a value in { desktop: { value } } plus optional breakpoints. */
function dv(value, breakpoints) {
  const out = { desktop: { value } };
  if (breakpoints) for (const bp of Object.keys(breakpoints)) out[bp] = { value: breakpoints[bp] };
  return out;
}

/** Emit one block comment. children: array of strings (container) or null (self-closing). */
function block(name, attrs, children) {
  const a = { ...(attrs || {}) };
  a.builderVersion = a.builderVersion || BUILDER_VERSION;
  const json = JSON.stringify(a);
  if (children == null) return `<!-- wp:divi/${name} ${json} /-->`;
  return [`<!-- wp:divi/${name} ${json} -->`, ...children, `<!-- /wp:divi/${name} -->`].join(CRLF);
}

/**
 * Normalise module innerContent HTML so the emitted value is robust regardless
 * of how downstream parsers handle a literal U+0022 (spec §4 RS-RAW-QUOTE;
 * Phase 0 plan T4). Three steps, applied in order:
 *
 *   1. Protect `$variable({...})$` tokens (they contain JSON with literal ").
 *   2. Convert double-quoted HTML attributes to single quotes, matching the
 *      existing footer `<a href='…'>` convention. Idempotent: already
 *      single-quoted attrs are untouched.
 *   3. Escape any remaining literal `"` (now necessarily in a text node) to
 *      `&quot;`. Leaves existing `&quot;` and `&#34;` untouched.
 *
 * The output is idempotent: `htmlContent(htmlContent(x)) === htmlContent(x)`.
 *
 * NOTE: T4 step 1 confirmed `block()` already round-trips literal `"` correctly
 * (JSON.stringify escapes it at both layers). This normaliser is defence in
 * depth — it makes the recovered innerContent value itself free of any `"` so
 * the RS-RAW-QUOTE rule (Phase 1) has nothing to flag, and matches the
 * `<a href='…'>` convention the spec relies on.
 *
 * @param {string} html
 * @returns {string}
 */
function htmlContent(html) {
  if (html == null) return html;
  let s = String(html);

  // Step 1 — protect $variable({...})$ tokens (they legitimately contain ").
  const stash = [];
  s = s.replace(/\$variable\(\{[\s\S]*?\}\)\$/g, (m) => {
    stash.push(m);
    return `\0VAR${stash.length - 1}\0`;
  });

  // Step 2 — double-quoted HTML attribute → single-quoted.
  // Matches `name="value"` (HTML/XML attribute form); value has no " inside.
  s = s.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g, "$1='$2'");

  // Step 3 — any remaining literal " is in a text node → escape to &quot;.
  s = s.replace(/"/g, '&quot;');

  // Restore protected tokens.
  s = s.replace(/\0VAR(\d+)\0/g, (_, i) => stash[Number(i)]);

  return s;
}

function placeholder(children) {
  return ['<!-- wp:divi/placeholder -->', ...children, '<!-- /wp:divi/placeholder -->'].join(CRLF);
}

// ─── DiviTheatre motion helper ──────────────────────────────────────────────

/**
 * Build a Divi 5 custom-attributes fragment for DiviTheatre data-theatre attributes.
 * ONLY call this when the user has explicitly confirmed DiviTheatre is installed.
 * Never emit data-theatre attributes without consent.
 *
 * Divi 5 reads custom attributes from `module.decoration.attributes` (NOT `advanced`),
 * and the value is `{ attributes: [ { name, value, targetElement } ] }` — an ARRAY of
 * objects, not a key→value map. Verified against Divi 5 beta.9.1
 * Module.php (`$attrs['module']['decoration']['attributes']`) and
 * AttributeUtils::separate_attributes_by_target_element()
 * (`$data['desktop']['value']['attributes']`). The old advanced/key-value shape
 * never rendered to the DOM.
 *
 * Usage in a module:  section({ theatre: 'hero-reveal', theatreOpts: { trigger: 'onLoad' } }, [...])
 * Or standalone:      attrs: D.theatreAttrs('fade-up', { trigger: 'onScroll', delay: 200 })
 *
 * @param {string} preset - DiviTheatre preset name (fade-up, stagger, parallax-scroll, etc.)
 * @param {Object} opts   - { trigger:'onScroll'|'onLoad'|'onClick', delay:ms, duration:ms, mobile:bool }
 */
function theatreAttrs(preset, opts) {
  const o = opts || {};
  const list = [];
  // targetElement 'main' = the module's own wrapper (Divi's canonical value; an
  // empty string renders identically but Divi rewrites it to 'main' on first save).
  const add = (name, value) => list.push({ name: name, value: String(value), targetElement: 'main' });
  if (preset) add('data-theatre', preset);
  if (o.trigger) add('data-theatre-trigger', o.trigger);
  if (o.delay != null) add('data-theatre-delay', String(o.delay));
  // duration is ignored by parallax-scroll and hero-reveal (fixed timelines) —
  // don't emit a misleading attribute for them.
  const DURATION_IGNORED = preset === 'parallax-scroll' || preset === 'hero-reveal';
  if (o.duration != null && !DURATION_IGNORED) add('data-theatre-duration', String(o.duration));
  if (o.mobile) add('data-theatre-mobile', 'true');
  return list.length
    ? { module: { decoration: { attributes: { desktop: { value: { attributes: list } } } } } }
    : {};
}

/** Merge theatre attrs into o.attrs if o.theatre is set. Called by every module function. */
function withTheatre(o) {
  const merged = o.theatre
    ? merge(o.attrs || {}, theatreAttrs(o.theatre, o.theatreOpts))
    : (o.attrs || {});
  return normaliseCustomAttrs(merged);
}

/**
 * Guard the custom-attributes path so `theatreAttrs()` is the only shape that
 * can reach `module.decoration.attributes.desktop.value.attributes` (spec §4
 * RS-ATTR-PATH; Phase 0 plan T3). Any wrong-shape branch arriving through the
 * `attrs:` escape hatch is rejected loudly at generate time, or — only for the
 * unambiguous key→value map case — migrated to the canonical array shape that
 * `theatreAttrs()` itself produces.
 *
 * Canonical shape (from theatreAttrs):
 *   module.decoration.attributes.desktop.value.attributes =
 *     Array<{ name:string, value:string, targetElement:'main' }>
 *
 * Detected + rejected (throw, naming the offending path):
 *   (a) module.advanced.attributes            — old location; renders zero
 *   (b) advanced.attributes                   — top-level; renders zero
 *   (c) module.decoration.attributes.desktop.value.attributes present but
 *       not an Array of {name,value} objects  — renders zero
 * Migrated (only when byte-identical to theatreAttrs output):
 *   - a plain key→value map at the (c) path, e.g. { 'data-theatre': 'fade-up' }
 *
 * @param {object} attrs  - the merged attrs object (or null/undefined)
 * @returns {object}      - the (possibly migrated) attrs object
 * @throws {Error}        - on any wrong-shape branch that cannot be migrated
 */
function normaliseCustomAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return attrs;

  const mod = attrs.module;
  const moduleAdvancedAttrs = mod && mod.advanced && mod.advanced.attributes;
  if (moduleAdvancedAttrs) {
    throw new Error(
      "custom attributes on module.advanced.attributes — Divi reads module.decoration.attributes, so zero will render. " +
      "Use theatreAttrs()/theatre: instead. Offending path: module.advanced.attributes"
    );
  }

  const topLevelAdvancedAttrs = attrs.advanced && attrs.advanced.attributes;
  if (topLevelAdvancedAttrs) {
    throw new Error(
      "custom attributes on advanced.attributes — Divi reads module.decoration.attributes, so zero will render. " +
      "Offending path: advanced.attributes"
    );
  }

  const decAttrBranch = mod && mod.decoration && mod.decoration.attributes;
  const decAttrValue = decAttrBranch && decAttrBranch.desktop && decAttrBranch.desktop.value;
  const decAttrList = decAttrValue && decAttrValue.attributes;
  if (decAttrList != null) {
    const isCanonical = Array.isArray(decAttrList) &&
      decAttrList.every(it => it && typeof it === 'object' && 'name' in it && 'value' in it);
    if (!isCanonical) {
      // Migration: a plain key→value map → canonical array (byte-identical to
      // theatreAttrs() output: targetElement:'main', value as String).
      const canMigrate = decAttrList && typeof decAttrList === 'object' && !Array.isArray(decAttrList);
      if (canMigrate) {
        decAttrValue.attributes = Object.keys(decAttrList).map(name => ({
          name: name,
          value: String(decAttrList[name]),
          targetElement: 'main',
        }));
      } else {
        throw new Error(
          "module.decoration.attributes.desktop.value.attributes must be an Array<{name,value,targetElement}> " +
          "(the shape theatreAttrs() emits); got " + (Array.isArray(decAttrList) ? 'an array of non-canonical objects' : typeof decAttrList) + ". " +
          "Offending path: module.decoration.attributes.desktop.value.attributes"
        );
      }
    }
  }

  return attrs;
}

// ─── structural modules ─────────────────────────────────────────────────────

/**
 * section({ adminLabel, background, backgroundImage, backgroundImagePosition, padding:{top,bottom}, phonePadding, preset, theatre, theatreOpts, attrs }, rows)
 * theatre: DiviTheatre preset name (ONLY when user confirmed DiviTheatre installed)
 */
function section(opts, rows) {
  const o = opts || {};
  const bgValue = prune({
    color: o.background,
    image: o.backgroundImage
      ? { url: o.backgroundImage, size: 'cover', position: o.backgroundImagePosition || 'center center' }
      : undefined,
  });
  let attrs = {
    module: {
      meta: o.adminLabel ? { adminLabel: dv(o.adminLabel) } : undefined,
      decoration: {
        background: Object.keys(bgValue).length ? dv(bgValue) : undefined,
        spacing: o.padding
          ? {
              desktop: { value: { padding: { top: o.padding.top, bottom: o.padding.bottom || o.padding.top, syncVertical: o.padding.bottom && o.padding.bottom !== o.padding.top ? 'off' : 'on', syncHorizontal: 'off' } } },
              ...(o.phonePadding ? { phone: { value: { padding: { top: o.phonePadding.top, bottom: o.phonePadding.bottom || o.phonePadding.top, syncVertical: 'off', syncHorizontal: 'off' } } } } : {}),
            }
          : undefined,
      },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('section', attrs, rows);
}

/**
 * row({ structure:'equal-columns_3', columnGap, rowGap, alignItems, maxWidth, preset, attrs }, columns)
 * Mobile wrap is applied automatically.
 */
function row(opts, columns) {
  const o = opts || {};
  let attrs = {
    module: {
      advanced: { flexColumnStructure: dv(o.structure || 'equal-columns_1') },
      decoration: {
        layout: {
          desktop: { value: prune({ flexWrap: 'nowrap', display: 'flex', columnGap: o.columnGap, rowGap: o.rowGap, alignItems: o.alignItems }) },
          phone: { value: { flexWrap: 'wrap', display: 'flex' } },
          phoneWide: { value: { flexWrap: 'wrap', display: 'flex' } },
        },
        sizing: o.maxWidth ? dv({ width: '100%', maxWidth: o.maxWidth }) : undefined,
      },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('row', attrs, columns);
}

/**
 * column({ flexType:'8_24', phoneFlexType, background, padding, radius, preset, attrs }, modules)
 * phone/phoneWide default to 24_24 when flexType isn't full width.
 */
function column(opts, modules) {
  const o = opts || {};
  const flexType = o.flexType || '24_24';
  const phoneFlex = o.phoneFlexType || '24_24';
  let attrs = {
    module: {
      decoration: {
        sizing: flexType === '24_24' ? dv({ flexType }) : dv({ flexType }, { phone: { flexType: phoneFlex }, phoneWide: { flexType: phoneFlex } }),
        background: o.background ? dv({ color: o.background }) : undefined,
        spacing: o.padding ? dv({ padding: { top: o.padding, bottom: o.padding, left: o.padding, right: o.padding, syncVertical: 'on', syncHorizontal: 'on' } }) : undefined,
        border: o.radius ? dv({ radius: { topLeft: o.radius, topRight: o.radius, bottomLeft: o.radius, bottomRight: o.radius, sync: 'on' } }) : undefined,
      },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('column', attrs, modules);
}

// ─── content modules ────────────────────────────────────────────────────────

/**
 * heading({ text, level:'h2', font:{family,size,phoneSize,weight,color,lineHeight,textAlign,letterSpacing}, preset, attrs })
 * ALWAYS sets headingLevel explicitly — exactly one h1 per page (the hero).
 * Decorative numerals etc. should use text(), not heading().
 */
function heading(opts) {
  const o = opts || {};
  const f = o.font || {};
  const desktopFont = prune({
    headingLevel: o.level || 'h2',
    family: f.family,
    size: f.size,
    weight: f.weight,
    color: f.color,
    lineHeight: f.lineHeight,
    textAlign: f.textAlign,
    letterSpacing: f.letterSpacing,
  });
  let attrs = {
    title: {
      innerContent: dv(htmlContent(o.text)),
      decoration: { font: { font: f.phoneSize ? dv(desktopFont, { phone: { size: f.phoneSize } }) : dv(desktopFont) } },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('heading', attrs, null);
}

/**
 * text({ html, font:{family,size,weight,lineHeight,color,textAlign,letterSpacing}, maxWidth, centered, preset, attrs })
 * html is raw inner HTML (<p>…</p>). Use for body copy, eyebrows, decorative numbers, footer links.
 * NOTE: never put inline `style="…"` in html — Divi strips styled modules to empty on save.
 * Style through this font object (Divi decoration), not inline CSS.
 */
function text(opts) {
  const o = opts || {};
  const f = o.font || {};
  let attrs = {
    content: {
      innerContent: dv(htmlContent(o.html)),
      decoration: Object.keys(f).length
        ? { bodyFont: { body: { font: dv(prune({ family: f.family, size: f.size, weight: f.weight, lineHeight: f.lineHeight, color: f.color, textAlign: f.textAlign, letterSpacing: f.letterSpacing })) } } }
        : undefined,
    },
    module: {
      decoration: {
        sizing: o.maxWidth ? dv({ maxWidth: o.maxWidth }) : undefined,
        spacing: o.centered ? dv({ margin: { left: 'auto', right: 'auto', syncVertical: 'off', syncHorizontal: 'off' } }) : undefined,
      },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('text', attrs, null);
}

/** Eyebrow label convenience: letter-spaced accent text (a <p>, never a heading).
 *  Styled via Divi decoration (no inline CSS — that gets stripped on save). Pass an
 *  already-uppercased label; emphasis comes from weight + letterSpacing + accent colour. */
function eyebrow(label, color, opts) {
  const o = opts || {};
  return text({
    html: `<p>${label}</p>`,
    font: { size: '12px', weight: '600', color: color, letterSpacing: '3px', textAlign: o.textAlign || 'center' },
    preset: o.preset,
  });
}

/**
 * button({ text, url, background, color, radius:'8px', padding:{v,h}, fontFamily, fontSize, preset, attrs })
 */
function button(opts) {
  const o = opts || {};
  const pad = o.padding || { v: '16px', h: '32px' };
  let attrs = {
    button: {
      innerContent: dv({ text: htmlContent(o.text), linkUrl: o.url || '#' }),
      decoration: {
        font: { font: dv(prune({ family: o.fontFamily, size: o.fontSize || '16px', color: o.color || '#ffffff', weight: '600' })) },
        background: o.background ? dv({ color: o.background }) : undefined,
        border: o.radius ? dv({ radius: { topLeft: o.radius, topRight: o.radius, bottomLeft: o.radius, bottomRight: o.radius, sync: 'on' } }) : undefined,
        spacing: dv({ padding: { top: pad.v, bottom: pad.v, left: pad.h, right: pad.h, syncVertical: 'on', syncHorizontal: 'on' } }),
      },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('button', attrs, null);
}

/** blurb({ icon:'&#xf0e7;', iconColor, title, titleLevel:'h3', body, preset, attrs }) */
function blurb(opts) {
  const o = opts || {};
  let attrs = {
    imageIcon: o.icon
      ? { innerContent: dv({ useIcon: 'on', icon: { unicode: o.icon, type: 'fa', weight: '900' } }), advanced: o.iconColor ? { color: { icon: dv(o.iconColor) } } : undefined }
      : undefined,
    title: {
      innerContent: dv({ text: htmlContent(o.title) }),
      decoration: { font: { font: dv({ headingLevel: o.titleLevel || 'h3' }) } },
    },
    content: { innerContent: dv(htmlContent(o.body)) },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('blurb', attrs, null);
}

/** image({ src, alt — REQUIRED for SEO, title, preset, attrs }) */
function image(opts) {
  const o = opts || {};
  if (!o.alt) throw new Error(`image(${o.src}): alt text is required (SEO rule)`);
  let attrs = { image: { innerContent: dv(prune({ src: o.src, alt: o.alt, titleText: o.title })) } };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('image', attrs, null);
}

/** icon({ unicode, color, preset }) */
function icon(opts) {
  const o = opts || {};
  let attrs = {
    icon: { innerContent: dv({ unicode: o.unicode, type: 'fa', weight: '900' }), advanced: o.color ? { color: dv(o.color) } : undefined },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('icon', attrs, null);
}

/** accordion(items: [{question, answer, open}]) — FAQ. Questions should be real long-tail queries. */
function accordion(items, opts) {
  const o = opts || {};
  const children = items.map((it, i) =>
    block('accordion-item', prune({
      module: it.open || (i === 0 && o.firstOpen !== false) ? { advanced: { open: dv('on') } } : undefined,
      title: { innerContent: dv(htmlContent(it.question)) },
      content: { innerContent: dv(htmlContent(it.answer)) },
    }), null)
  );
  let attrs = prune(o.attrs || {});
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('accordion', attrs, children);
}

/** numberCounter({ title, number, percent, numberColor, numberSize }) */
function numberCounter(opts) {
  const o = opts || {};
  let attrs = {
    title: { innerContent: dv(htmlContent(o.title)) },
    number: { innerContent: dv(String(o.number)), decoration: o.numberColor ? { font: { font: dv({ color: o.numberColor, size: o.numberSize || '48px', weight: '700' }) } } : undefined },
    percent: { advanced: { sign: dv(o.percent ? 'on' : 'off') } },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('number-counter', attrs, null);
}

/** divider/spacer ({ show:false, height }) */
function divider(opts) {
  const o = opts || {};
  let attrs = {
    divider: { advanced: { line: dv({ show: o.show ? 'on' : 'off' }) } },
    module: o.height ? { decoration: { sizing: dv({ height: o.height }) } } : undefined,
  };
  return block('divider', prune(attrs), null);
}

// ─── registry: presets + global colours ─────────────────────────────────────

function randomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function createBuilder() {
  const presets = {}; // moduleName -> { default, items }
  const globalColors = [];

  return {
    /** Register a global colour. Returns the variable reference string for use in any color field. */
    globalColor(slug, hex, label) {
      const id = slug.startsWith('gcid-') ? slug : `gcid-${slug}`;
      globalColors.push([id, { color: hex, status: 'active', label: label || slug }]);
      return `$variable({"type":"color","value":{"name":"${id}","settings":{}}})$`;
    },

    /** Variable reference for an already-registered colour, with optional opacity %. */
    colorVar(slug, opacity) {
      const id = slug.startsWith('gcid-') ? slug : `gcid-${slug}`;
      const settings = opacity != null ? `{"opacity":${opacity}}` : '{}';
      return `$variable({"type":"color","value":{"name":"${id}","settings":${settings}}})$`;
    },

    /** Register a preset; returns its id for modulePreset references. */
    preset(moduleName, name, attrs) {
      const id = randomId();
      if (!presets[moduleName]) presets[moduleName] = { default: id, items: {} };
      presets[moduleName].items[id] = {
        id,
        name,
        moduleName,
        version: BUILDER_VERSION,
        type: 'module',
        created: Date.now(),
        updated: Date.now(),
        attrs: prune(attrs),
        styleAttrs: prune(attrs),
      };
      return id;
    },

    /**
     * assemble({ context, content, title, slug })
     * context: 'et_builder' (page) | 'et_builder_layouts' (library)
     * content: full placeholder-wrapped string
     */
    assemble(opts) {
      const { context, content, title, slug } = opts;
      const base = { presets: { module: presets }, global_colors: globalColors, global_variables: [], images: {}, thumbnails: [] };
      if (context === 'et_builder') {
        return { context, data: { 1: content }, canvases: {}, ...base };
      }
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      return {
        context: 'et_builder_layouts',
        data: {
          1: {
            ID: 1,
            post_date: now, post_date_gmt: now,
            post_content: content,
            post_title: title || 'Landing Page',
            post_excerpt: '', post_status: 'publish', comment_status: 'closed', ping_status: 'closed',
            post_password: '', post_name: slug || 'landing-page', to_ping: '', pinged: '',
            post_modified: now, post_modified_gmt: now,
            post_content_filtered: '', post_parent: 0, menu_order: 0,
            post_type: 'et_pb_layout', post_mime_type: '', comment_count: '0', filter: 'raw',
            post_meta: { _et_pb_built_for_post_type: ['page'], _et_pb_template_type: ['layout'] },
            terms: {},
          },
        },
        ...base,
      };
    },
  };
}

module.exports = {
  BUILDER_VERSION, CRLF,
  dv, block, placeholder, merge, prune, htmlContent,
  section, row, column,
  heading, text, eyebrow, button, blurb, image, icon, accordion, numberCounter, divider,
  theatreAttrs, withTheatre, normaliseCustomAttrs,
  createBuilder, randomId,
};
