# Divi 5 Module Attribute Reference

For attribute overrides the builder helpers don't expose directly — pass via the `attrs:` option, which deep-merges into the generated attributes.

## Heading level (SEO-critical)

Lives inside the font value (confirmed against the official Divi 5 Design System exports):

```json
"title": { "decoration": { "font": { "font": { "desktop": { "value": { "headingLevel": "h2", "size": "38px" } } } } } }
```

The builder's `heading({ level })` sets this. Default in Divi is h2 — which is why explicit levels are mandatory (otherwise pages ship without an h1).

## Responsive breakpoints

`desktop` (required baseline), `tabletWide`, `tablet`, `phoneWide`, `phone`. Only include breakpoints that differ from desktop. The builder's `dv(value, { phone: {...} })` helper builds these.

## Row layout

- `flexColumnStructure`: `equal-columns_1/2/3/4`, `offset-columns_2` (first smaller), `offset-columns_6` (second smaller), `css-grid-grids_2`
- Grid alternative: `layout.desktop.value = { display: "grid", gridColumnCount: "3", gridColumnWidths: "equal", columnGap, rowGap }` with `tablet: { gridColumnCount: "1" }`

## Column flexType (fraction of 24)

`24_24` full, `18_24` 75%, `16_24` 66%, `12_24` 50%, `8_24` 33%, `6_24` 25%, `3_5` 60%, `2_5` 40%.

## Background beyond flat colour

```json
"background": { "desktop": { "value": {
  "color": "#1a1a2e",
  "gradient": { "stops": [...], "enabled": "on" },
  "image": { "url": "...", "size": "cover", "position": "center" }
} } }
```

## Sticky/fixed, z-index, overflow

`module.decoration.position`, `.zIndex`, `.overflow` — same `dv()` shape. Check `Divi/includes/builder-5/visual-builder/packages/module-library/src/components/<module>/module.json` for any module's full attribute schema.

## Global colour variable syntax

Unescaped form (what you write in JS — serialisation handles escaping):

```
$variable({"type":"color","value":{"name":"gcid-accent","settings":{}}})$
```

With opacity: `"settings":{"opacity":10}`. Defined in `global_colors` as `["gcid-slug", {"color":"#hex","status":"active","label":"Name"}]`.

## FontAwesome icon unicodes (common)

Lightning `&#xf0e7;` Star `&#xf005;` Check-circle `&#xf058;` Cog `&#xf013;` Rocket `&#xf135;` Shield `&#xf3ed;` Chart `&#xf201;` Users `&#xf0c0;` Clock `&#xf017;` Globe `&#xf0ac;` Envelope `&#xf0e0;` Phone `&#xf095;` Map-pin `&#xf3c5;` Quote `&#xf10d;` Arrow-right `&#xf061;` Lightbulb `&#xf0eb;` Laptop-code `&#xf5fc;` Handshake `&#xf2b5;` Trophy `&#xf091;` Briefcase `&#xf0b1;` Chart-bar `&#xf080;` Coins `&#xf51e;` Key `&#xf084;` Leaf `&#xf06c;` Lock `&#xf023;` Magic `&#xf0d0;` Paper-plane `&#xf1d8;` Seedling `&#xf4d8;` Target `&#xf05b;` Thumbs-up `&#xf164;` Wrench `&#xf0ad;`

## Module catalogue (37)

**Structural:** section, row, column, group, group-carousel, placeholder
**Text/content:** text, heading, blurb, icon, icon-list, icon-list-item, divider
**Media:** image, video, video-slider, video-slider-item, slider, slide
**Interactive:** button, accordion, accordion-item, toggle, contact-form, contact-field, signup, login, search
**Specialised:** pricing-tables, pricing-table, number-counter, countdown-timer, map, map-pin, menu
**Social:** social-media-follow, social-media-follow-network

Container-child pairings (enforced by validator): accordion→accordion-item, icon-list→icon-list-item, pricing-tables→pricing-table, slider→slide, video-slider→video-slider-item, contact-form→contact-field, social-media-follow→-network.
