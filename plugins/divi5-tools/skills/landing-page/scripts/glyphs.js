/**
 * glyphs.js — single source of truth for the banned-glyph set.
 *
 * Used by validate.js (TASTE / RS-GLYPH rule) and — as a no-op import — by
 * divi-builder.js so the "what the generator avoids emitting" and "what the
 * validator flags" lists cannot drift apart. The emitter does not rewrite
 * author copy in Phase 0; actual substitution remains a validator/`--fix`
 * concern (spec §4 RS-GLYPH, Phase 0 plan T5).
 *
 * Default set = em-dash + en-dash (literal chars). The HTML entity forms of
 * those two dashes are matched as well when the default set is in use; this
 * preserves the historical behaviour of the old hard-coded DASH_RE.
 *
 * `buildGlyphRe(source)` is pure: pass a custom source string to override
 * (e.g. '—–…' to also ban the ellipsis).
 */

'use strict';

const DEFAULT_GLYPH_SOURCE = '—–'; // em-dash + en-dash

/**
 * Build a case-insensitive global regex that matches any character (or HTML
 * entity form, when the default set is in use) from the source string.
 *
 * @param {string} [source] - override string; omit/undefined for the default dashes-only set.
 * @returns {RegExp}
 */
function buildGlyphRe(source) {
  const src = source != null ? String(source) : DEFAULT_GLYPH_SOURCE;
  const alternatives = [];
  if (src === DEFAULT_GLYPH_SOURCE) {
    alternatives.push('&mdash;', '&ndash;', '&#8212;', '&#8211;', '&#x2014;', '&#x2013;');
  }
  for (const ch of Array.from(src)) {
    alternatives.push(ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
  return new RegExp(alternatives.join('|'), 'gi');
}

module.exports = { DEFAULT_GLYPH_SOURCE, buildGlyphRe };
