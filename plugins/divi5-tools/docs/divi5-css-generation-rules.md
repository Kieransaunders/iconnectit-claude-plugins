# Divi 5 CSS Generation Rules — Hard-Won Knowledge

Discovered during the Rub You Well landing page import fidelity work (2026-06-19).
These rules govern what Divi 5 actually renders vs what silently fails.

---

## 1. Preset background colors require raw hex — NOT variable refs

**Rule:** Any `decoration.background.*.value.color` inside a preset's `attrs` must be a raw hex string (e.g. `#fdf7f2`). Variable references (`$variable({...})$`) do NOT generate CSS via the preset class system.

**Why:** Divi 5 generates section/row/column background CSS via a preset class:
```css
.preset--module--divi-section--{id} { background-color: #fdf7f2 !important; }
```
This CSS is generated at save time from the raw hex in the preset attr. When the value is a variable ref, Divi's preset CSS generator skips it — it only resolves variable refs at render time for *inline* attrs, not preset class generation.

**What works:**
```js
// ✅ Raw hex in preset background — generates CSS
b.preset('divi/section', 'Section – Cream', {
  module: { decoration: { background: D.dv({ color: '#fdf7f2' }) } }
})

// ❌ Variable ref in preset background — NO CSS generated
b.preset('divi/section', 'Section – Cream', {
  module: { decoration: { background: D.dv({ color: CREAM }) } } // CREAM = globalColor ref
})
```

**Font colors in presets are fine with variable refs** — Divi resolves those at render time via the font CSS pipeline, not the preset class system.

---

## 2. Buttons require "Use Custom Styles" to be enabled

**Rule:** The Divi 5 button module ignores all decoration attrs (background, border, font size) unless `button.decoration.button.desktop.value.enable` is `'on'`.

**Attr path (from Divi source `_all_modules_conversion_outline.php`):**
```
custom_button => button.decoration.button.*.enable
```

**In the builder:**
```js
b.preset('divi/button', 'Button – Primary', {
  button: { decoration: {
    button:     D.dv({ enable: 'on' }),  // ← REQUIRED or all styling is ignored
    background: D.dv({ color: '#c9715a' }),
    font:       { font: D.dv({ color: WHITE }) },  // font color CAN use variable ref
    ...
  }}
})
```

Also add to `divi-builder.js` `button()` function so every button block gets it automatically — even without a preset.

---

## 3. CSS cache must be cleared after preset import

**Rule:** After calling `GlobalPreset::process_presets_for_import()`, the CSS cache must be manually cleared. Without this, the preset class CSS is never generated for newly imported preset IDs.

**Why:** `process_presets_for_import()` calls `et_update_option()` directly. But Divi only clears the CSS cache inside `GlobalPreset::save_data()`:
```php
ET_Core_PageResource::remove_static_resources('all', 'all', true, 'all', true);
```
`process_presets_for_import()` never calls `save_data()`, so the cache is never cleared.

**Fix in `PageImporter.php`:** Add after `$presets_imported = true;`:
```php
if ( class_exists( 'ET_Core_PageResource' ) ) {
    ET_Core_PageResource::remove_static_resources( 'all', 'all', true, 'all', true );
}
```

---

## 4. Variable refs work for font/text colors, NOT for backgrounds/borders

| Color location | Use variable ref? | Use raw hex? |
|---|---|---|
| `decoration.background.*.value.color` in preset | ❌ No CSS generated | ✅ Required |
| `button.decoration.background` in preset | ❌ No CSS generated | ✅ Required |
| `decoration.font.font.*.value.color` in preset | ✅ Works | Avoid (validator will flag) |
| `button.decoration.font.font.*.value.color` | ✅ Works | Avoid (validator will flag) |
| `decoration.border.styles.*.color` in preset | ❌ Untested, assume no | ✅ Use raw hex |
| Inline block attrs (non-preset) | ✅ Works for both | ✅ Works for both |

---

## 5. Preset accumulation — repeated imports pile up presets

Every import creates new preset IDs via `process_presets_for_import()`. After several test imports, the WordPress site accumulates hundreds of stale presets (visible in the export as IDs starting with the import timestamp: `6a2e...`).

**Impact:** Doesn't break anything functionally but bloats the global preset registry.  
**Clean-up:** Manually delete stale presets via Divi's preset manager, or add a cleanup step to `PageImporter.php` that removes presets from the same import batch if they share a name with existing ones.

---

## 6. The applyPreset() inlining pattern

`applyPreset(attrs, preset)` in `divi-builder.js` merges preset attrs as the base of a block's inline attrs, then adds `modulePreset: [id]`. This means:

- Blocks get BOTH the `modulePreset` reference (for Divi's preset class CSS) AND inline attrs (for editor display)
- Any raw hex in preset attrs ends up inlined in the block — which is correct for backgrounds (Divi reads inline attrs for the editor) but may generate validator warnings if not exempted
- The validator's ET token check should skip `decoration.background` paths since they legitimately require raw hex

---

## 7. Inline block backgrounds (non-preset) — untested verdict

The social proof strip section uses `D.block('section', { module: { decoration: { background: D.dv({ color: '#c9715a' }) } } })` without a preset. Whether Divi renders this inline background on the front end (vs only in the builder) is unconfirmed — needs a test import to verify.

---

---

## 8. Preset-first workflow — the recommended pattern

Instead of generating presets + page together (fragile, causes CSS cache issues, accumulates stale presets), use a two-step approach:

**Step 1 — Import presets separately** via `POST /wp-json/divi-tools/v1/presets/import`
- Calls `process_presets_for_import()` then `save_data()` → CSS generated immediately with stable IDs
- Returns `id_mappings` so you know the final IDs

**Step 2 — Fetch registry** via `GET /wp-json/divi-tools/v1/presets`
- Returns `{ "divi/button": { "Filled - Primary Color": "klcvu0qk4f", ... } }`
- Save as `references/et-preset-registry.json`

**Step 3 — Generate page using registry IDs**
```js
b.loadPresetRegistry(registry);
const P = { btn: b.presetRef('divi/button', 'Filled - Primary Color') };
// assemble() with delete layout.presets — no re-registration
```

**Step 4 — Import page only** (no presets key) → references existing IDs → CSS already generated → renders perfectly

**ET official presets** (`Divi-5-Launch-Freebie_Presets.json`) provide 272 named presets across 81 modules. Import once with `node scripts/setup-et-presets.js`. Available names include:
- Sections: `Section Preset 1`
- Buttons: `Filled - Primary Color`, `Filled - White`, `Filled - Black`, `Text - Primary Color`
- Headings: `Heading 1` through `Heading 6`, `Heading 1 Big`
- Text: `Dark Text`, `Light Text`, `Small Text`, `Tag - Dark`, `Tag - Light`
- Columns: `Contained - Dark`, `Contained - Light`, `Outlined - Dark`, `Outlined - Light`

---

---

## 9. CSS cache is per-page and must be regenerated after import

**Rule:** After importing a page that references preset IDs, the page-specific CSS cache must be regenerated. Simply importing and viewing the page is not enough if a stale CSS file exists from a previous import.

**Divi's CSS cache structure:**
```
wp-content/et-cache/{post_id}/
  et-core-unified-{post_id}.min.css        ← preset CSS for above-fold presets
  et-core-unified-deferred-{post_id}.min.css  ← preset CSS for below-fold presets
  et-divi-dynamic-{post_id}.css            ← inline/dynamic CSS (NOT where preset CSS lives)
```

**The "wrong file" trap:** Preset CSS is NOT in `et-divi-dynamic-*.css`. It's in `et-core-unified-*.min.css` and `et-core-unified-deferred-*.min.css`. Always check the unified files.

**Fix:** Delete all CSS files in `et-cache/{post_id}/` then curl/visit the page once to force regeneration:
```bash
rm -f /path/to/wp-content/et-cache/1719/*.css
curl -s http://localhost:10015/rub-you-well-massage-frome/ > /dev/null
```

**Above-fold vs deferred:** Divi splits preset CSS between the main and deferred files based on position in the page. Sections in the lower half of the page end up in the deferred file, which loads after the initial paint. Both files are served on page load — there's no rendering issue once the cache is regenerated.

---

## Next Steps

1. ✅ **Section backgrounds rendering** — confirmed 2026-06-19: all 6 sections render correct colors after CSS cache regeneration
2. ✅ **Terracotta strip** — renders `rgb(201,113,90)` correctly via `secAccent` preset
3. **Clean up stale presets** — the site has hundreds of accumulated test-import presets
4. **Update `divi-builder.js` docs** — add JSDoc for the `button.decoration.button: dv({ enable: 'on' })` requirement
5. ✅ **Captured in SKILL.md** — preset-first workflow documented
6. **Test other modules** — do blurbs, images, headings follow the same preset-class CSS pattern? Or do they use inline attrs directly?
7. **Add CSS cache clear to post-import step** — after importing a page, always delete `et-cache/{post_id}/*.css` and curl the page once
