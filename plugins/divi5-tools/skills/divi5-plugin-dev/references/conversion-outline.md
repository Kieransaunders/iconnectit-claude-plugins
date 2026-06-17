# conversion-outline.json — Divi 4 → Divi 5 migration

If your module ever shipped a **Divi 4 shortcode** version (or you want existing pages
to upgrade cleanly), Divi 5 needs a `conversion-outline.json` to map the old shortcode
attributes onto the new attribute paths. **Without it, the module on existing pages
falls back to the legacy "Shortcode Module" wrapper and loses Visual Builder editability.**

A brand-new module with no Divi 4 history doesn't strictly need one — but adding it is
cheap insurance and avoids a runtime regex fallback (see below).

Official docs:
- https://dev.elegantthemes.com/docs/explanations/module/conversion-outline/introduction/
- https://dev.elegantthemes.com/docs/explanations/module/conversion-outline/non-responsive-attributes/

---

## Location

Same directory as `module.json`:

```
visual-builder/src/
├── module.json
└── conversion-outline.json
```

---

## Structure

Root-level objects map old (Divi 4) attribute names to new (Divi 5) attribute paths.
The `*` wildcard expands to all breakpoints and states automatically.

```json
{
  "advanced": {
    "admin_label": "module.meta.adminLabel",
    "animation":   "module.decoration.animation",
    "background":  "module.decoration.background"
  },
  "css": {
    "main_element": "css.*.mainElement"
  },
  "module": {
    "title":      "title.innerContent.*",
    "show_phone": "module.advanced.showPhone"
  },
  "deprecatedMap": ["old_custom_attr"],
  "nonResponsiveAttributes": ["show_phone"]
}
```

---

## Non-responsive attributes & the regex fallback

Some attributes end in `_phone` / `_tablet` but refer to **device functionality**, not
viewport breakpoints — e.g. `show_phone`, `enable_phone`. Divi must not treat these as
responsive variants.

Resolution order during conversion:

1. **Fast path** — look the attribute up in `nonResponsiveAttributes` (array lookup).
2. **Fallback** — if absent, run **regex pattern matching** to decide if it's a
   breakpoint suffix. This is the expensive path and adds CPU overhead on load.

So: declare every device-functionality attribute in `nonResponsiveAttributes` to skip
the regex. **Any attribute listed there must also appear in the `module` mapping.**

### Alternative — declare via PHP filter

```php
add_filter( 'divi.conversion.moduleLibrary.conversionMap', function( $map ) {
    $map['your-namespace/your-module']['nonResponsiveAttributes'] = [
        'show_phone',
        'enable_phone',
    ];
    return $map;
}, 15 );
```

---

## Key rules

- Ship `conversion-outline.json` for any module with Divi 4 lineage — required for
  clean upgrades; without it pages drop to the shortcode wrapper.
- Declare **all** attributes explicitly to avoid the regex fallback at load time.
- Every `nonResponsiveAttributes` entry must also be present in the `module` map.
- `*` wildcard handles breakpoints/states — don't enumerate them by hand.
