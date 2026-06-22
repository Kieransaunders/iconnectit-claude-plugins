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
const path = require('path');
const { DEFAULT_GLYPH_SOURCE: SHARED_GLYPH_SOURCE } = require('./glyphs');
const TYPE_SCALE = require(path.join(__dirname, '../references/type-scale'));

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

/**
 * Resolve a preset reference to { id, attrs } (handles both old string IDs
 * and new { id, attrs } objects returned by createBuilder().preset()).
 * Merges preset attrs as the BASE of module attrs so inline opts override them.
 * Divi 5 only generates front-end CSS from inline block attrs — preset registry
 * entries are used by the Visual Builder only. By inlining the preset attrs we
 * ensure the page renders correctly on the front end.
 */
function applyPreset(moduleAttrs, preset) {
  if (!preset) return moduleAttrs;
  const presetId = preset && typeof preset === 'object' ? preset.id : preset;
  const presetAttrs = preset && typeof preset === 'object' ? preset.attrs : null;
  const result = presetAttrs ? merge(presetAttrs, moduleAttrs) : moduleAttrs;
  result.modulePreset = [presetId];
  return result;
}

/**
 * Attach a group preset reference to block attrs.
 * gp: { groupName, groupId, id } as returned by b.groupPreset() / b.headingPresets() etc.
 * Does NOT inline attrs — group presets are VB-only design tokens; the block just references them.
 */
function applyGroupPreset(blockAttrs, gp) {
  if (!gp) return blockAttrs;
  const result = { ...blockAttrs };
  if (!result.groupPreset) result.groupPreset = {};
  result.groupPreset[gp.groupId] = { presetId: [gp.id], groupName: gp.groupName };
  return result;
}

/** Shorthand: wrap a value in { desktop: { value } } plus optional breakpoints. */
function dv(value, breakpoints) {
  const out = { desktop: { value } };
  if (breakpoints) for (const bp of Object.keys(breakpoints)) out[bp] = { value: breakpoints[bp] };
  return out;
}

/**
 * Serialize block attrs to JSON, escaping < > & in string values to Unicode
 * escapes so WordPress's HTML processing (balanceTags, kses) cannot interpret
 * angle brackets inside the block comment as real HTML tags and corrupt the
 * comment delimiters when the post is saved.
 */
function safeBlockJson(attrs) {
  return JSON.stringify(attrs).replace(/[<>&]/g, c =>
    c === '<' ? '\\u003c' : c === '>' ? '\\u003e' : '\\u0026'
  );
}

/** Emit one block comment. children: array of strings (container) or null (self-closing). */
function block(name, attrs, children) {
  const a = { ...(attrs || {}) };
  a.builderVersion = a.builderVersion || BUILDER_VERSION;
  const json = safeBlockJson(a);
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
 * Pin scenes (Phase 05): pass a category-prefixed preset and (optionally) a runway
 * length via `distance`. The pin runtime is scroll-scrubbed, never clock-played, so
 * trigger/delay/duration are meaningless on it and are not emitted.
 *   section({ theatre: 'pin:product-reveal', theatreOpts: { distance: '200vh' } }, [...])
 * The child parts that the scene animates are marked with `theatrePart` (not here):
 *   image({ ..., theatrePart: 'media' })   text({ ..., theatrePart: 'panel' })
 *
 * @param {string} preset - DiviTheatre preset name (fade-up, stagger, pin:product-reveal, etc.)
 * @param {Object} opts   - { trigger:'onScroll'|'onLoad'|'onClick', delay:ms, duration:ms, mobile:bool, distance:'150vh' }
 */
// Canonical preset allowlist — keeps a typo (e.g. 'fadeup', 'pin:reveal') from
// silently shipping a dead data-theatre attribute. Mirrors the DiviTheatre engine
// registry (src/presets/*). Element/scene presets are bare names; pin-category
// presets carry the `pin:` prefix that the engine's category dispatch reads.
const ELEMENT_SCENE_PRESETS = new Set([
  'fade-up', 'fade-left', 'fade-right', 'scale-in',
  'stagger', 'parallax-scroll', 'hover-grow', 'hero-reveal',
]);
const PIN_PRESETS = new Set(['product-reveal']); // value form: 'pin:product-reveal'
const THEATRE_PARTS = new Set(['media', 'panel']); // ADR-001 §5 part-role allowlist
const DISTANCE_RE = /^\d+vh$/;                      // T-05-04: vh-only runway length

function isPinPreset(preset) {
  return typeof preset === 'string' && preset.startsWith('pin:');
}
function assertKnownPreset(preset) {
  if (isPinPreset(preset)) {
    const name = preset.slice(4);
    if (!PIN_PRESETS.has(name)) {
      throw new Error(
        `unknown pin preset "${preset}" — known: ${[...PIN_PRESETS].map(p => 'pin:' + p).join(', ')}`
      );
    }
    return;
  }
  if (!ELEMENT_SCENE_PRESETS.has(preset)) {
    throw new Error(
      `unknown DiviTheatre preset "${preset}" — known: ${[...ELEMENT_SCENE_PRESETS].join(', ')}, ` +
      `${[...PIN_PRESETS].map(p => 'pin:' + p).join(', ')}`
    );
  }
}

function theatreAttrs(preset, opts) {
  const o = opts || {};
  const list = [];
  // targetElement 'main' = the module's own wrapper (Divi's canonical value; an
  // empty string renders identically but Divi rewrites it to 'main' on first save).
  const add = (name, value) => list.push({ name: name, value: String(value), targetElement: 'main' });
  if (preset) {
    assertKnownPreset(preset);
    add('data-theatre', preset);
  }
  const pin = isPinPreset(preset);
  if (pin) {
    // Pin scenes are scroll-scrubbed — trigger/delay/duration do nothing. Only the
    // runway length applies. Validate vh-only; the engine falls back to 150vh on
    // anything malformed, but we refuse to emit a junk attribute at generate time.
    if (o.distance != null) {
      if (!DISTANCE_RE.test(String(o.distance))) {
        throw new Error(`data-theatre-distance must match /^\\d+vh$/ (e.g. "200vh"); got "${o.distance}"`);
      }
      add('data-theatre-distance', String(o.distance));
    }
    if (o.mobile) add('data-theatre-mobile', 'true');
  } else {
    if (o.distance != null) {
      throw new Error(`data-theatre-distance is only valid on pin: presets, not "${preset}"`);
    }
    if (o.trigger) add('data-theatre-trigger', o.trigger);
    if (o.delay != null) add('data-theatre-delay', String(o.delay));
    // duration is ignored by parallax-scroll and hero-reveal (fixed timelines) —
    // don't emit a misleading attribute for them.
    const DURATION_IGNORED = preset === 'parallax-scroll' || preset === 'hero-reveal';
    if (o.duration != null && !DURATION_IGNORED) add('data-theatre-duration', String(o.duration));
    if (o.mobile) add('data-theatre-mobile', 'true');
  }
  return list.length
    ? { module: { decoration: { attributes: { desktop: { value: { attributes: list } } } } } }
    : {};
}

/**
 * Build the custom-attributes fragment for a pin-scene child PART marker.
 * Pin children carry ONLY `data-theatre-part` (media|panel) — never a `data-theatre`
 * preset of their own. Value validated against the ADR-001 §5 allowlist; never used
 * to build a selector.
 * @param {string} part - 'media' | 'panel'
 */
function theatrePartAttrs(part) {
  if (!THEATRE_PARTS.has(part)) {
    throw new Error(`data-theatre-part must be one of: ${[...THEATRE_PARTS].join(', ')}; got "${part}"`);
  }
  return { module: { decoration: { attributes: { desktop: { value: { attributes: [
    { name: 'data-theatre-part', value: part, targetElement: 'main' },
  ] } } } } } };
}

/** Merge theatre attrs into o.attrs if o.theatre / o.theatrePart is set. Called by every module function. */
function withTheatre(o) {
  let merged = o.attrs || {};
  if (o.theatre) merged = merge(merged, theatreAttrs(o.theatre, o.theatreOpts));
  if (o.theatrePart) merged = merge(merged, theatrePartAttrs(o.theatrePart));
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
 * section({ adminLabel, bgColor, background, backgroundImage, backgroundImagePosition, padding:{top,bottom}, phonePadding, preset, theatre, theatreOpts, attrs }, rows)
 * - bgColor: plain colour string → wrapped as single-layer background
 * - background: raw decoration.background object (e.g. multi-layer array) — passed through directly
 * - backgroundImage / backgroundImagePosition: legacy single-image shorthand (ignored when background is set)
 * theatre: DiviTheatre preset name (ONLY when user confirmed DiviTheatre installed)
 */
function section(opts, rows) {
  const o = opts || {};
  let sectionBg;
  if (o.background) {
    // raw passthrough — caller supplies the full decoration.background object
    sectionBg = o.background;
  } else {
    const bgValue = prune({
      color: o.bgColor,
      image: o.backgroundImage
        ? { url: o.backgroundImage, size: 'cover', position: o.backgroundImagePosition || 'center center' }
        : undefined,
    });
    sectionBg = Object.keys(bgValue).length ? dv(bgValue) : undefined;
  }
  let attrs = {
    module: {
      meta: o.adminLabel ? { adminLabel: dv(o.adminLabel) } : undefined,
      decoration: {
        background: sectionBg,
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
  attrs = applyPreset(attrs, o.preset);
  return block('section', attrs, rows);
}

/**
 * overlaySection({ adminLabel, image:{src,parallax}, overlay:{color,blend,opacity}, padding, phonePadding, preset, theatre, theatreOpts }, rows)
 * @param {{ top?: string, bottom?: string }} [opts.padding]
 * Builds a section with a two-layer Divi 5 background: image layer (bottom) + colour overlay layer (top).
 */
function overlaySection(opts, rows) {
  const o = opts || {};
  const imgLayer = {
    image: {
      url: (o.image && o.image.src) || '',
      parallax: (o.image && o.image.parallax) || 'off',
    },
  };
  const colorLayer = {};
  if (o.overlay) {
    if (o.overlay.color != null) colorLayer.color = o.overlay.color;
    if (o.overlay.blend != null) colorLayer.blend = o.overlay.blend;
    if (o.overlay.opacity != null) colorLayer.opacity = o.overlay.opacity;
  }
  return section({
    adminLabel: o.adminLabel,
    theatre: o.theatre,
    theatreOpts: o.theatreOpts,
    preset: o.preset,
    padding: o.padding,
    phonePadding: o.phonePadding,
    background: { desktop: { value: [imgLayer, colorLayer] } },
  }, rows);
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
  attrs = applyPreset(attrs, o.preset);
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
  attrs = applyPreset(attrs, o.preset);
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
  attrs = applyPreset(attrs, o.preset);
  attrs = applyGroupPreset(attrs, o.gp);
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
  attrs = applyPreset(attrs, o.preset);
  attrs = applyGroupPreset(attrs, o.gp);
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
        // Required to enable custom button styles in Divi 5 (maps to "Use Custom Styles For Button")
        button: dv({ enable: 'on' }),
        font: { font: dv(prune({ family: o.fontFamily, size: o.fontSize || '16px', color: o.color || undefined, weight: '600' })) },
        background: o.background ? dv({ color: o.background }) : undefined,
        border: o.radius ? dv({ radius: { topLeft: o.radius, topRight: o.radius, bottomLeft: o.radius, bottomRight: o.radius, sync: 'on' } }) : undefined,
        spacing: dv({ padding: { top: pad.v, bottom: pad.v, left: pad.h, right: pad.h, syncVertical: 'on', syncHorizontal: 'on' } }),
      },
    },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  attrs = applyPreset(attrs, o.preset);
  attrs = applyGroupPreset(attrs, o.gp);
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
  attrs = applyPreset(attrs, o.preset);
  return block('blurb', attrs, null);
}

/** image({ src, alt — REQUIRED for SEO, title, preset, attrs }) */
function image(opts) {
  const o = opts || {};
  if (!o.alt) throw new Error(`image(${o.src}): alt text is required (SEO rule)`);
  let attrs = { image: { innerContent: dv(prune({ src: o.src, alt: o.alt, titleText: o.title })) } };
  attrs = prune(merge(attrs, withTheatre(o)));
  attrs = applyPreset(attrs, o.preset);
  return block('image', attrs, null);
}

/** icon({ unicode, color, preset }) */
function icon(opts) {
  const o = opts || {};
  let attrs = {
    icon: { innerContent: dv({ unicode: o.unicode, type: 'fa', weight: '900' }), advanced: o.color ? { color: dv(o.color) } : undefined },
  };
  attrs = prune(merge(attrs, withTheatre(o)));
  attrs = applyPreset(attrs, o.preset);
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
  attrs = applyPreset(attrs, o.preset);
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
  attrs = applyPreset(attrs, o.preset);
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

function createBuilder(opts) {
  const tokens = (opts && opts.tokens) || null;
  const presets = {};       // moduleName -> { default, items }
  const groupPresetsStore = {}; // groupName -> { default, items }
  const globalColors = [];
  const globalVariables = [];

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

    colorRef(label) {
      if (!tokens) {
        console.warn(`builder.colorRef('${label}'): no tokens loaded — returning undefined`);
        return undefined;
      }
      const ref = tokens.colorRef[label];
      if (!ref) {
        // Try hex fallback via colorId → colorHex chain
        const gcid = tokens.colorId && tokens.colorId[label];
        const hex  = gcid && tokens.colorHex && tokens.colorHex[gcid];
        const fallback = typeof hex === 'string' ? hex : (hex && hex.resolvesTo) || undefined;
        console.warn(`builder.colorRef('${label}'): unknown label${fallback ? `, using hex fallback ${fallback}` : ' — returning undefined'}`);
        return fallback;
      }
      return ref;
    },

    variableRef(label) {
      if (!tokens) {
        console.warn(`builder.variableRef('${label}'): no tokens loaded — returning undefined`);
        return undefined;
      }
      const ref = tokens.variableRef && tokens.variableRef[label];
      if (!ref) {
        console.warn(`builder.variableRef('${label}'): unknown label — returning undefined`);
        return undefined;
      }
      return ref;
    },

    /**
     * Unified colour accessor. Accepts a label (ET token name), a raw hex string,
     * or a gcid-* slug. Never throws — unknown inputs warn and return undefined.
     *
     * b.color('Primary Color')   → variable ref via colorRef
     * b.color('#ff6600')         → '#ff6600' (pass-through)
     * b.color('gcid-abc123')     → colorVar('gcid-abc123') variable ref string
     */
    color(input) {
      if (!input) return undefined;
      if (typeof input !== 'string') return undefined;
      if (/^gcid-/.test(input)) return this.colorVar(input);
      if (/^#[0-9a-fA-F]{3,8}$/.test(input)) return input;
      // Try as ET token label
      if (tokens && tokens.colorRef && tokens.colorRef[input]) return tokens.colorRef[input];
      if (tokens && tokens.colorId && tokens.colorId[input]) return this.colorVar(tokens.colorId[input]);
      console.warn(`builder.color('${input}'): not a recognised label, hex, or gcid — returning undefined`);
      return undefined;
    },

    /**
     * Load a preset registry fetched from GET /wp-json/divi-tools/v1/presets.
     *
     * Without { withAttrs: true }: presetRef() will THROW — no attrs means buttons
     * render default blue. Only use this when all preset CSS is already on the site
     * AND you've verified the page doesn't need attrs inlined.
     *
     * With { withAttrs: true }: registry must be fetched with ?with_attrs=1 so each
     * entry is { id, attrs } instead of a bare ID string. presetRef() then inlines
     * attrs so the page renders correctly on the front end.
     *
     * registry: the .presets object from the API response
     */
    loadPresetRegistry(registry, opts) {
      this._registry = registry || {};
      this._registryWithAttrs = !!(opts && opts.withAttrs);
    },

    /**
     * Reference an existing preset by module + name from a loaded registry.
     *
     * Throws if:
     *   - registry not loaded
     *   - registry was loaded without { withAttrs: true } (would produce default-blue buttons)
     *   - name not found in the registry
     *
     * Returns { id, attrs } — attrs are inlined by applyPreset() so front-end CSS renders.
     */
    presetRef(moduleName, name) {
      if (!this._registry) throw new Error(`presetRef('${moduleName}', '${name}'): call loadPresetRegistry() first`);
      if (!this._registryWithAttrs) {
        throw new Error(
          `presetRef('${moduleName}', '${name}'): registry was loaded without { withAttrs: true }. ` +
          `Buttons will render default blue without inlined attrs. ` +
          `Fetch with GET /presets?with_attrs=1 and pass { withAttrs: true } to loadPresetRegistry(), ` +
          `or use b.preset() to register custom presets with inline attrs.`
        );
      }
      const moduleMap = this._registry[moduleName] || this._registry[`divi/${moduleName}`] || {};
      const entry = moduleMap[name];
      if (!entry) {
        const known = Object.keys(moduleMap).join(', ') || '(none)';
        throw new Error(`presetRef('${moduleName}', '${name}'): not found. Known: ${known}`);
      }
      // Registry may return { id, attrs } (with_attrs=1) or a bare ID string (old format).
      if (typeof entry === 'string') {
        console.warn(`presetRef('${moduleName}', '${name}'): server returned a bare ID — attrs not available. Button CSS may not render.`);
        return { id: entry, attrs: null };
      }
      return { id: entry.id, attrs: entry.attrs || null };
    },

    /** Register a preset; returns its id for modulePreset references. */
    preset(moduleName, name, attrs) {
      const id = randomId();
      const prunedAttrs = prune(attrs);
      if (!presets[moduleName]) presets[moduleName] = { default: id, items: {} };
      presets[moduleName].items[id] = {
        id,
        name,
        moduleName,
        version: BUILDER_VERSION,
        type: 'module',
        created: Date.now(),
        updated: Date.now(),
        attrs: prunedAttrs,
      };
      // Return { id, attrs } so module functions can inline preset attrs for front-end CSS.
      // Divi 5 only generates front-end CSS from inline block attrs; preset registry is VB-only.
      return { id, attrs: prunedAttrs };
    },

    /**
     * Register a global variable (spacing, font size, etc.).
     * Returns the $variable()$ content ref string for use in any value field.
     * id: stable slug (with or without 'gvid-' prefix)
     */
    globalVariable(id, label, value) {
      const gvid = id.startsWith('gvid-') ? id : `gvid-${id}`;
      // Idempotent — skip if already registered with the same ID
      if (!globalVariables.some(v => v.id === gvid)) {
        globalVariables.push({ id: gvid, label, value, status: 'active', type: 'numbers' });
      }
      return `$variable({"type":"content","value":{"name":"${gvid}","settings":{}}})$`;
    },

    /** Variable ref by ID (no registration — ID must already be in globalVariables). */
    varRef(id) {
      const gvid = id.startsWith('gvid-') ? id : `gvid-${id}`;
      return `$variable({"type":"content","value":{"name":"${gvid}","settings":{}}})$`;
    },

    /**
     * Register the 4 fluid font-size global variables and return their ref strings.
     * { h1, h2, h3, body } — pass directly as the `size` field in font attrs.
     *
     * Example:
     *   const ts = b.typeScale();
     *   b.preset('divi/heading', 'H1', { title: { decoration: { font: { font: dv({ size: ts.h1, weight: '700' }) } } } })
     */
    typeScale() {
      const G = TYPE_SCALE.GVID;
      const T = TYPE_SCALE.TYPE;
      return {
        h1:   this.globalVariable(G.text3xl, 'text 3xl', T['3xl']),
        h2:   this.globalVariable(G.text2xl, 'text 2xl', T['2xl']),
        h3:   this.globalVariable(G.textXl,  'text xl',  T.xl),
        body: this.globalVariable(G.textM,   'text m',   T.m),
      };
    },

    /**
     * Register the 3 fluid spacing global variables and return their ref strings.
     * { l, m, s } — pass as margin/padding values.
     */
    spaceScale() {
      const G = TYPE_SCALE.GVID;
      const S = TYPE_SCALE.SPACE;
      return {
        l: this.globalVariable(G.spaceL, 'space l', S.l),
        m: this.globalVariable(G.spaceM, 'space m', S.m),
        s: this.globalVariable(G.spaceS, 'space s', S.s),
      };
    },

    /**
     * Register a group preset (for typography, spacing, layout, button groups).
     * Returns { groupName, groupId, id } — pass as the `gp` option to heading()/text()/button().
     *
     * groupName: 'divi/font' | 'divi/font-body' | 'divi/spacing' | 'divi/button' | 'divi/layout'
     * groupId:   key used in block's groupPreset object, e.g. 'designTitleText' | 'button' | 'module.decoration.spacing'
     * moduleName: the Divi block type this group preset belongs to
     */
    groupPreset(groupName, groupId, moduleName, name, attrs) {
      const id = randomId();
      const prunedAttrs = prune(attrs);
      if (!groupPresetsStore[groupName]) groupPresetsStore[groupName] = { default: id, items: {} };
      groupPresetsStore[groupName].items[id] = {
        type: 'group', id, name,
        version: BUILDER_VERSION,
        created: Date.now(), updated: Date.now(),
        groupName, moduleName, groupId,
        attrs: prunedAttrs,
        styleAttrs: prunedAttrs,
      };
      return { groupName, groupId, id };
    },

    /**
     * Register the 6 standard spacing group presets (margin-top and all-padding in s/m/l).
     * scale: optional { l, m, s } refs — defaults to b.spaceScale().
     * Returns { marginTopS, marginTopM, marginTopL, paddingS, paddingM, paddingL }.
     */
    spacingPresets(scale) {
      const ss = scale || this.spaceScale();
      const gp = (name, a) => this.groupPreset('divi/spacing', 'module.decoration.spacing', 'divi/text', name, a);
      const marginTop = (top) => ({ module: { decoration: { spacing: dv({ margin: { top, syncVertical: 'off', syncHorizontal: 'off' } }) } } });
      const allPad   = (val) => ({ module: { decoration: { spacing: dv({ padding: { top: val, bottom: val, left: val, right: val, syncVertical: 'on', syncHorizontal: 'on' } }) } } });
      return {
        marginTopS: gp('margin top small',  marginTop(ss.s)),
        marginTopM: gp('margin top medium', marginTop(ss.m)),
        marginTopL: gp('margin top large',  marginTop(ss.l)),
        paddingS:   gp('padding small',  allPad(ss.s)),
        paddingM:   gp('padding medium', allPad(ss.m)),
        paddingL:   gp('padding large',  allPad(ss.l)),
      };
    },

    /**
     * Register Primary + Secondary button group presets with enable:'on' and hover state.
     * opts: { primaryGcid, hoverGcid, secondaryGcid } — gcid slugs (with or without 'gcid-' prefix).
     * Defaults: primary = 'gcid-primary-color', secondary = 'gcid-secondary-color', hover = 'gcid-dmtl913igj'.
     * Returns { primary, secondary } — each is { groupName, groupId, id }.
     */
    buttonPresets(opts) {
      const o = opts || {};
      const g = (slug, def) => {
        const s = slug || def;
        return s.startsWith('gcid-') ? s : `gcid-${s}`;
      };
      const primary   = g(o.primaryGcid,   'primary-color');
      const secondary = g(o.secondaryGcid, 'secondary-color');
      const hover     = g(o.hoverGcid,     'dmtl913igj'); // Primary 700 (lightness -20)

      const cvar = (id) => `$variable({"type":"color","value":{"name":"${id}","settings":{}}})$`;
      const btnAttrs = (bgGcid) => ({
        button: { decoration: {
          button:     dv({ enable: 'on', icon: { enable: 'off' } }),
          background: Object.assign({}, dv({ color: cvar(bgGcid) }), { hover: { color: cvar(hover) } }),
          border:     Object.assign({}, dv({ styles: { all: { color: cvar(bgGcid) } } }), { hover: { styles: { all: { color: cvar(hover) } } } }),
          font:       { font: dv({ color: '#ffffff', size: '1rem' }) },
        }},
      });

      const gp = (name, bgGcid) => this.groupPreset('divi/button', 'button', 'divi/button', name, btnAttrs(bgGcid));
      return { primary: gp('Button Primary', primary), secondary: gp('Button Secondary', secondary) };
    },

    /**
     * Register h1/h2/h3 heading group presets using type-scale variable refs.
     * ts: optional refs from b.typeScale() — auto-calls typeScale() if omitted.
     * Returns { h1, h2, h3 } — each is { groupName, groupId, id }.
     * Usage: D.heading({ text: 'Hero', level: 'h1', gp: headings.h1 })
     */
    headingPresets(ts) {
      const typeRefs = ts || this.typeScale();
      const gp = (name, size, headingLevel) => this.groupPreset(
        'divi/font', 'designTitleText', 'divi/heading', name,
        { title: { decoration: { font: { font: dv(prune({ weight: '600', size, lineHeight: '1.1em', headingLevel: headingLevel !== 'h2' ? headingLevel : undefined })) } } } }
      );
      return { h1: gp('h1', typeRefs.h1, 'h1'), h2: gp('h2', typeRefs.h2, 'h2'), h3: gp('h3', typeRefs.h3, 'h3') };
    },

    /**
     * assemble({ context, content, title, slug })
     * context: 'et_builder' (page) | 'et_builder_layouts' (library)
     * content: full placeholder-wrapped string
     */
    assemble(opts) {
      const { context, content, title, slug } = opts;
      const presetsOut = { module: presets };
      if (Object.keys(groupPresetsStore).length) presetsOut.group = groupPresetsStore;
      const base = { presets: presetsOut, global_colors: globalColors, global_variables: globalVariables, images: {}, thumbnails: [] };
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
  BUILDER_VERSION, CRLF, TYPE_SCALE,
  dv, block, placeholder, merge, prune, htmlContent,
  applyGroupPreset,
  section, overlaySection, row, column,
  heading, text, eyebrow, button, blurb, image, icon, accordion, numberCounter, divider,
  theatreAttrs, theatrePartAttrs, withTheatre, normaliseCustomAttrs,
  isPinPreset, assertKnownPreset,
  createBuilder, randomId,
};
