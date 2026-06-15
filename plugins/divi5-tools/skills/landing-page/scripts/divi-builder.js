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

function placeholder(children) {
  return ['<!-- wp:divi/placeholder -->', ...children, '<!-- /wp:divi/placeholder -->'].join(CRLF);
}

// ─── DiviTheatre motion helper ──────────────────────────────────────────────

/**
 * Build a `module.advanced.attributes` attrs fragment for DiviTheatre data-theatre
 * attributes. ONLY call this when the user has explicitly confirmed DiviTheatre
 * is installed. Never emit data-theatre attributes without consent.
 *
 * Usage in a module:  section({ theatre: 'hero-reveal', theatreOpts: { trigger: 'onLoad' } }, [...])
 * Or standalone:      attrs: D.theatreAttrs('fade-up', { trigger: 'onScroll', delay: 200 })
 *
 * @param {string} preset - DiviTheatre preset name (fade-up, stagger, parallax-scroll, etc.)
 * @param {Object} opts   - { trigger:'onScroll'|'onLoad'|'onClick', delay:ms, duration:ms, mobile:bool }
 */
function theatreAttrs(preset, opts) {
  const o = opts || {};
  const dataAttrs = {};
  if (preset) dataAttrs['data-theatre'] = preset;
  if (o.trigger) dataAttrs['data-theatre-trigger'] = o.trigger;
  if (o.delay != null) dataAttrs['data-theatre-delay'] = String(o.delay);
  // duration is ignored by parallax-scroll and hero-reveal (fixed timelines) —
  // don't emit a misleading attribute for them.
  const DURATION_IGNORED = preset === 'parallax-scroll' || preset === 'hero-reveal';
  if (o.duration != null && !DURATION_IGNORED) dataAttrs['data-theatre-duration'] = String(o.duration);
  if (o.mobile) dataAttrs['data-theatre-mobile'] = 'true';
  return Object.keys(dataAttrs).length
    ? { module: { advanced: { attributes: { desktop: { value: dataAttrs } } } } }
    : {};
}

/** Merge theatre attrs into o.attrs if o.theatre is set. Called by every module function. */
function withTheatre(o) {
  if (!o.theatre) return o.attrs || {};
  return merge(o.attrs || {}, theatreAttrs(o.theatre, o.theatreOpts));
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
      innerContent: dv(o.text),
      decoration: { font: { font: f.phoneSize ? dv(desktopFont, { phone: { size: f.phoneSize } }) : dv(desktopFont) } },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  if (o.preset) attrs.modulePreset = [o.preset];
  return block('heading', attrs, null);
}

/**
 * text({ html, font:{family,size,lineHeight,color,textAlign}, maxWidth, centered, preset, attrs })
 * html is raw inner HTML (<p>…</p>). Use for body copy, eyebrows, decorative numbers, footer links.
 */
function text(opts) {
  const o = opts || {};
  const f = o.font || {};
  let attrs = {
    content: {
      innerContent: dv(o.html),
      decoration: Object.keys(f).length
        ? { bodyFont: { body: { font: dv(prune({ family: f.family, size: f.size, lineHeight: f.lineHeight, color: f.color, textAlign: f.textAlign })) } } }
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

/** Eyebrow label convenience: uppercase, letter-spaced accent text (a <p>, never a heading). */
function eyebrow(label, color, opts) {
  const o = opts || {};
  return text({
    html: `<p style="text-transform:uppercase;letter-spacing:3px;font-size:12px;font-weight:600;color:${color};text-align:${o.textAlign || 'center'};">${label}</p>`,
    font: { textAlign: o.textAlign || 'center' },
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
      innerContent: dv({ text: o.text, linkUrl: o.url || '#' }),
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
      innerContent: dv({ text: o.title }),
      decoration: { font: { font: dv({ headingLevel: o.titleLevel || 'h3' }) } },
    },
    content: { innerContent: dv(o.body) },
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
      title: { innerContent: dv(it.question) },
      content: { innerContent: dv(it.answer) },
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
    title: { innerContent: dv(o.title) },
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
  dv, block, placeholder, merge, prune,
  section, row, column,
  heading, text, eyebrow, button, blurb, image, icon, accordion, numberCounter, divider,
  theatreAttrs, withTheatre,
  createBuilder, randomId,
};
