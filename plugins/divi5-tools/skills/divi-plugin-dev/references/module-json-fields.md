# module.json Field Reference

## Top-level keys

| Key | Required | Description |
|---|---|---|
| `name` | ✅ | Block name in `vendor/slug` format, e.g. `"my-plugin/hero"` |
| `d4Shortcode` | ✅ | Divi 4 shortcode slug equivalent, e.g. `"my_plugin_hero"` |
| `title` | ✅ | Human-readable display name in the module picker |
| `titles` | ✅ | Plural form of the title |
| `category` | ✅ | `"module"` for standard modules, `"child-module"` for items inside a parent |
| `moduleClassName` | ✅ | CSS class added to module wrapper, e.g. `"my_plugin_hero"` |
| `moduleOrderClassName` | ✅ | Same as moduleClassName (used for order-based selectors) |
| `attributes` | ✅ | Object defining all module attributes |
| `style` | — | Array of `wp_register_style()` handles to auto-enqueue |
| `settings` | — | `{ "content": "auto", "design": "auto", "advanced": "auto" }` — omit panels you handle manually |
| `childrenName` | — | Array of child module block names (for parent modules) |

---

## Attribute definition

Every attribute is an object under `attributes`:

```json
"myAttr": {
  "type": "object",
  "selector": "{{selector}} .my-element",
  "tagName": "h2",
  "inlineEditor": "plainText",
  "elementType": "heading",
  "childrenSanitizer": "et_core_esc_previously",
  "allowHtml": false,
  "attributes": {
    "class": "my-element-class",
    "id": "my-element-id"
  },
  "default": {
    "innerContent": {
      "desktop": { "value": "Default text" }
    }
  },
  "settings": {
    "innerContent": { ... },
    "decoration": { ... },
    "advanced": { ... }
  }
}
```

| Property | Notes |
|---|---|
| `type` | Always `"object"` for Divi 5 attributes |
| `selector` | CSS selector. `{{selector}}` is the module's own `.et_pb_module` class |
| `tagName` | HTML element rendered by `elements->render()`. e.g. `h1`–`h6`, `div`, `p`, `span` |
| `inlineEditor` | `"plainText"` (no formatting) or `"richText"` (bold, italic, links) |
| `elementType` | `"heading"` tells Divi to treat font settings as heading font. Omit for body |
| `childrenSanitizer` | Always `"et_core_esc_previously"` — marks content as already-sanitised |
| `allowHtml` | `true` for richText attributes that store HTML |
| `attributes` | Static HTML attributes added to the rendered element |
| `default` | Default attribute values when no user value is set |

---

## settings.innerContent

Defines the content field shown in the "Content" tab of the module settings.

```json
"settings": {
  "innerContent": {
    "groupType": "group-item",
    "item": {
      "groupName": "mainContent",
      "priority": 10,
      "render": true,
      "attrName": "myAttr.innerContent",
      "label": "My Field",
      "description": "Helper text shown under the field",
      "features": {
        "dynamicContent": false,
        "hover": true,
        "sticky": false,
        "responsive": true,
        "preset": "content"
      },
      "component": {
        "name": "divi/text",
        "type": "field",
        "props": {}
      }
    }
  }
}
```

### Field component names

| `component.name` | Input type | Value format |
|---|---|---|
| `divi/text` | Plain text input | `"string"` |
| `divi/richtext` | WYSIWYG editor | `"<p>HTML</p>"` |
| `divi/toggle` | On/Off switch | `"on"` or `"off"` |
| `divi/select` | Dropdown | `"option-value"` |
| `divi/range` | Slider | `"42px"` or `"42"` |
| `divi/color-picker` | Colour | `"#FF0000"` or `"rgba(255,0,0,0.5)"` |
| `divi/upload` | Image/file upload | `{ "src": "...", "alt": "...", "id": 123 }` |
| `divi/icon-picker` | Icon selector | `{ "unicode": "&#xf004;", "type": "fa", "weight": "900" }` |

### RangeContainer props (in JSX FieldContainer)

```jsx
<RangeContainer
  min={1}
  minLimit={1}
  max={20}
  maxLimit={20}
  defaultUnit=""
  allowedUnits={['']}   // [''] for unitless, ['px', '%', 'em'] for CSS units
/>
```

### SelectContainer props

```jsx
<SelectContainer
  options={[
    { value: 'left',   label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right',  label: 'Right' },
  ]}
/>
```

---

## settings.decoration

Controls which design options appear in the Design tab for this attribute.
Use an empty object `{}` to include with defaults, or add `priority`/`component.props`
to customise.

```json
"decoration": {
  "font": {
    "priority": 10,
    "component": {
      "props": {
        "groupLabel": "Title Font",
        "fields": {
          "headingLevel": { "render": false }
        }
      }
    }
  },
  "bodyFont": {},
  "background": {},
  "spacing": {},
  "sizing": {},
  "border": {},
  "boxShadow": {},
  "filters": {},
  "transform": {},
  "animation": {},
  "overflow": {},
  "transition": {},
  "position": {},
  "zIndex": {},
  "scroll": {},
  "sticky": {},
  "layout": {},
  "disabledOn": {}
}
```

Only include the sub-keys you want to expose. Omit the rest.

---

## Module-level settings key

Controls auto-generation of settings panels. With `"auto"`, Divi builds the panel
from all attribute `settings` definitions automatically.

```json
"settings": {
  "content":  "auto",
  "design":   "auto",
  "advanced": "auto"
}
```

Override a panel by providing a JSX component in the `settings` object of your
module definition (see jsx-component.md).

---

## Selector patterns

| Pattern | Meaning |
|---|---|
| `{{selector}}` | The module wrapper itself (`.et_pb_module.my_slug`) |
| `{{selector}} .child` | A descendant element |
| `{{selectorPrefix}}` | Parent module's selector (use in child modules) |
| `{{baseSelector}}` | This element's own selector within the parent |

---

## Child modules

For parent/child relationships (e.g. Accordion → Accordion Item):

**Parent `module.json`:**
```json
{
  "name": "my-plugin/accordion",
  "category": "module",
  "childrenName": ["my-plugin/accordion-item"]
}
```

**Child `module.json`:**
```json
{
  "name": "my-plugin/accordion-item",
  "category": "child-module"
}
```

In PHP, `$child_modules_content` contains rendered child HTML — include it in `render_callback`:

```php
$children = HTMLUtility::render([
    'tag'               => 'div',
    'attributes'        => [ 'class' => 'my-accordion-items' ],
    'childrenSanitizer' => 'et_core_esc_previously',
    'children'          => $child_modules_content,
]);
```

---

## Complete minimal module.json

```json
{
  "name": "my-plugin/simple",
  "d4Shortcode": "my_plugin_simple",
  "title": "Simple Module",
  "titles": "Simple Modules",
  "category": "module",
  "moduleClassName": "my_plugin_simple",
  "moduleOrderClassName": "my_plugin_simple",
  "attributes": {
    "module": {
      "type": "object",
      "selector": "{{selector}}",
      "default": {
        "meta": { "adminLabel": { "desktop": { "value": "Simple Module" } } }
      },
      "settings": {
        "meta": { "adminLabel": {} },
        "decoration": {
          "background": {}, "spacing": {}, "sizing": {}, "border": {},
          "boxShadow": {}, "filters": {}, "transform": {}, "animation": {},
          "overflow": {}, "transition": {}, "position": {}, "zIndex": {},
          "scroll": {}, "sticky": {}, "disabledOn": {}, "layout": {}
        }
      }
    },
    "title": {
      "type": "object",
      "selector": "{{selector}} .my_plugin_simple_title",
      "attributes": { "class": "my_plugin_simple_title" },
      "tagName": "h2",
      "inlineEditor": "plainText",
      "elementType": "heading",
      "childrenSanitizer": "et_core_esc_previously",
      "settings": {
        "innerContent": {
          "groupType": "group-item",
          "item": {
            "groupName": "mainContent", "priority": 10, "render": true,
            "attrName": "title.innerContent", "label": "Title",
            "component": { "name": "divi/text", "type": "field" }
          }
        },
        "decoration": { "font": {} }
      }
    }
  },
  "settings": { "content": "auto", "design": "auto", "advanced": "auto" }
}
```
