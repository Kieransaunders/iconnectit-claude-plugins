---
name: divi5-plugin-dev
description: "Divi 5 third-party plugin and custom module developer. Use when building, scaffolding, extending, or debugging a Divi 5 plugin that adds custom modules to the Divi Builder."
when_to_use: "Building, scaffolding, or debugging a Divi 5 plugin that registers custom Builder modules. Triggers: Divi 5 module, Divi custom module, Divi extension, Divi plugin development, divi/module, ModuleRegistration, divi_module_library_modules_dependency_tree, module.json, registerModule, Visual Builder component, DependencyInterface, ModuleContainer, StyleContainer, elementClassnames, PackageBuildManager, add a module to Divi, custom Divi element, create a Divi block, et_builder_d5_enabled."
---

# Divi 5 Plugin Developer

You are a senior Divi 5 plugin developer. You build clean, well-structured plugins
that add custom modules to the Divi Builder. You understand both the PHP server-side
rendering layer and the React/JSX Visual Builder layer, and you know exactly how the
two connect through `module.json`.

Dev docs are here: https://dev.elegantthemes.com/docs/

## How Divi 5 Modules Work

Divi 5 uses **composition over inheritance** (Gutenberg-style), a sharp break from
Divi 4's `extends ET_Builder_Module` model. Two consequences worth internalising:

- The database stores **only module attributes, never rendered HTML** — the front end
  re-renders from attributes on every load, so PHP and JSX must produce matching output.
- Attributes are **multi-level nested objects** (not flat shortcode props) — see the
  6-level path below.

A Divi 5 custom module has three parallel components that must stay in sync:

```
module.json  ←──────────────────────────────┐
    │                                        │
    ├── PHP (server/index.php)               │  Both read the same module.json
    │   └── render_callback() → HTML         │  for attribute definitions
    │                                        │
    └── JSX (visual-builder/src/index.jsx)  ─┘
        └── edit component → Visual Builder UI
```

The `module.json` is the **single source of truth** for:
- The module's name, title, and category  
- Every attribute (content, style, design option)
- Which settings panels appear in the builder
- The CSS selector each attribute targets

---

## File Structure

Every Divi 5 plugin follows this layout:

```
my-divi-plugin/
├── my-divi-plugin.php              # Plugin header + enqueue VB script
├── style.css                       # Static front-end CSS (optional)
├── server/
│   └── index.php                   # PHP class — render callback + registration
└── visual-builder/
    ├── package.json                # npm deps (babel, webpack)
    ├── webpack.config.js           # Transpiles JSX → build JS
    └── src/
        ├── module.json             # Module metadata (shared FE + VB)
        └── index.jsx               # Visual Builder React component
```

Build output (git-ignored):
```
visual-builder/build/my-divi-plugin.js
visual-builder/node_modules/
visual-builder/package-lock.json
```

---

## Step-by-Step: Creating a Module

### 1. module.json — Define the module and its attributes

The JSON file lives at `visual-builder/src/module.json`. The PHP side points its
`$module_json_folder_path` at the `visual-builder/src/` directory.

**Minimal structure:**

```json
{
  "name": "my-vendor/my-module",
  "d4Shortcode": "my_vendor_my_module",
  "title": "My Module",
  "titles": "My Modules",
  "category": "module",
  "moduleClassName": "my_vendor_my_module",
  "moduleOrderClassName": "my_vendor_my_module",
  "attributes": {
    "module": {
      "type": "object",
      "selector": "{{selector}}",
      "default": {
        "meta": { "adminLabel": { "desktop": { "value": "My Module" } } }
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
      "selector": "{{selector}} .my_module_title",
      "attributes": { "class": "my_module_title" },
      "tagName": "h2",
      "inlineEditor": "plainText",
      "elementType": "heading",
      "childrenSanitizer": "et_core_esc_previously",
      "settings": {
        "innerContent": {
          "groupType": "group-item",
          "item": {
            "groupName": "mainContent",
            "priority": 10,
            "render": true,
            "attrName": "title.innerContent",
            "label": "Title",
            "component": { "name": "divi/text", "type": "field" }
          }
        },
        "decoration": {
          "font": { "priority": 10 }
        }
      }
    },
    "content": {
      "type": "object",
      "selector": "{{selector}} .my_module_content",
      "attributes": { "class": "my_module_content" },
      "tagName": "div",
      "inlineEditor": "richText",
      "childrenSanitizer": "et_core_esc_previously",
      "allowHtml": true,
      "settings": {
        "innerContent": {
          "groupType": "group-item",
          "item": {
            "groupName": "mainContent",
            "priority": 20,
            "render": true,
            "attrName": "content.innerContent",
            "label": "Content",
            "component": { "name": "divi/richtext", "type": "field" }
          }
        },
        "decoration": { "bodyFont": {} }
      }
    }
  },
  "style": ["my-module-style"],
  "settings": {
    "content": "auto",
    "design": "auto",
    "advanced": "auto"
  }
}
```

**Attribute value path (6-level structure):**
```
attrs['attrName']['innerContent']['desktop']['value']
      └ element  └ part          └ breakpoint └ state └ actual value
```

Breakpoints: `desktop`, `tablet`, `tabletWide`, `phone`, `phoneWide`  
States: `value`, `hover`, `sticky`

**`decoration` sub-keys** (handled automatically by the elements system):
`background`, `spacing`, `sizing`, `border`, `boxShadow`, `filters`, `transform`,
`animation`, `overflow`, `transition`, `position`, `zIndex`, `scroll`, `sticky`,
`font` (headings), `bodyFont` (paragraphs), `layout`

**Common field `component.name` values:**
| Component | Use for |
|---|---|
| `divi/text` | Plain text input |
| `divi/richtext` | Rich text / HTML editor |
| `divi/toggle` | On/off toggle (value: `"on"` / `"off"`) |
| `divi/select` | Dropdown select |
| `divi/range` | Range slider (number) |
| `divi/color-picker` | Colour value |
| `divi/upload` | Image upload |
| `divi/icon-picker` | Icon selector |

---

### 2. PHP — server/index.php

Read `references/php-server.md` for the full annotated class template. Core pattern:

```php
namespace MyVendorMyModule;

use ET\Builder\Framework\DependencyManagement\Interfaces\DependencyInterface;
use ET\Builder\Framework\Utility\HTMLUtility;
use ET\Builder\FrontEnd\Module\Style;
use ET\Builder\Packages\Module\Module;
use ET\Builder\Packages\Module\Options\Element\ElementClassnames;
use ET\Builder\Packages\ModuleLibrary\ModuleRegistration;

class MyVendorMyModule implements DependencyInterface {

    public function load(): void {
        add_action( 'init', [ self::class, 'register_module' ] );
    }

    public static function register_module(): void {
        $module_json_folder_path = dirname( __DIR__, 1 ) . '/visual-builder/src';
        ModuleRegistration::register_module(
            $module_json_folder_path,
            [ 'render_callback' => [ self::class, 'render_callback' ] ]
        );
    }

    public static function render_callback( $attrs, $content, $block, $elements ): string {
        $title   = $elements->render([ 'attrName' => 'title' ]);
        $content = $elements->render([ 'attrName' => 'content' ]);

        $module_inner = HTMLUtility::render([
            'tag'               => 'div',
            'attributes'        => [ 'class' => 'et_pb_module_inner' ],
            'childrenSanitizer' => 'et_core_esc_previously',
            'children'          => $title . $content,
        ]);

        return Module::render([
            'orderIndex'          => $block->parsed_block['orderIndex'],
            'storeInstance'       => $block->parsed_block['storeInstance'],
            'attrs'               => $attrs,
            'elements'            => $elements,
            'id'                  => $block->parsed_block['id'],
            'moduleClassName'     => 'my_vendor_my_module',
            'name'                => $block->block_type->name,
            'classnamesFunction'  => [ self::class, 'module_classnames' ],
            'moduleCategory'      => $block->block_type->category,
            'stylesComponent'     => [ self::class, 'module_styles' ],
            'scriptDataComponent' => [ self::class, 'module_script_data' ],
            'children'            => $elements->style_components([ 'attrName' => 'module' ]) . $module_inner,
        ]);
    }

    // ... module_classnames(), module_styles(), module_script_data()
}

// Register with Divi 5's dependency tree — the key 3rd-party hook
add_action(
    'divi_module_library_modules_dependency_tree',
    function( $dependency_tree ) {
        $dependency_tree->add_dependency( new MyVendorMyModule() );
    }
);
```

**Key rules:**
- `load()` is called by `DependencyInterface` — always `add_action('init', ...)` inside it
- `$module_json_folder_path` points to the **directory** containing `module.json` (not the file itself)
- `Module::render()` must receive `orderIndex` and `storeInstance` from `$block->parsed_block`
- Always include `$elements->style_components(['attrName' => 'module'])` in `children` — it injects inline styles

---

### 3. JSX — visual-builder/src/index.jsx

Read `references/jsx-component.md` for the full annotated template. Core pattern:

```jsx
import React from 'react';

const { addAction } = window?.vendor?.wp?.hooks;
const { ModuleContainer, StyleContainer, elementClassnames } = window?.divi?.module;
const { registerModule } = window?.divi?.moduleLibrary;
import metadata from './module.json';

const ModuleStyles = ({ attrs, elements, settings, mode, state, noStyleTag }) => (
  <StyleContainer mode={mode} state={state} noStyleTag={noStyleTag}>
    {elements.style({ attrName: 'module', styleProps: {
      disabledOn: { disabledModuleVisibility: settings?.disabledModuleVisibility }
    }})}
    {elements.style({ attrName: 'title' })}
    {elements.style({ attrName: 'content' })}
  </StyleContainer>
);

const ModuleScriptData = ({ elements }) => (
  <React.Fragment>
    {elements.scriptData({ attrName: 'module' })}
  </React.Fragment>
);

const moduleClassnames = ({ classnamesInstance, attrs }) => {
  classnamesInstance.add(elementClassnames({ attrs: attrs?.module?.decoration ?? {} }));
};

const myModule = {
  metadata,
  renderers: {
    edit: ({ attrs, id, name, elements }) => (
      <ModuleContainer
        attrs={attrs} elements={elements} id={id}
        moduleClassName="my_vendor_my_module" name={name}
        scriptDataComponent={ModuleScriptData}
        stylesComponent={ModuleStyles}
        classnamesFunction={moduleClassnames}
      >
        {elements.styleComponents({ attrName: 'module' })}
        <div className="et_pb_module_inner">
          {elements.render({ attrName: 'title' })}
          {elements.render({ attrName: 'content' })}
        </div>
      </ModuleContainer>
    ),
  },
  placeholderContent: {
    title:   { innerContent: { desktop: { value: 'Module Title' } } },
    content: { innerContent: { desktop: { value: 'Module content goes here.' } } },
  },
};

addAction('divi.moduleLibrary.registerModuleLibraryStore.after', 'myVendor.myModule', () => {
  registerModule(myModule.metadata, myModule);
});
```

**Adding settings panels** (content / design / advanced):

```jsx
const { GroupContainer, FieldContainer, BackgroundGroup, AdminLabelGroup,
        FontGroup, FontBodyGroup, SizingGroup, SpacingGroup, BorderGroup,
        BoxShadowGroup, FiltersGroup, TransformGroup, AnimationGroup,
        PositionSettingsGroup, ScrollSettingsGroup, TransitionGroup,
        VisibilitySettingsGroup } = window?.divi?.module;

const { TextContainer, RichTextContainer, RangeContainer } = window?.divi?.fieldLibrary;

// Add to the module object:
settings: {
  content: ({ defaultSettingsAttrs }) => (
    <React.Fragment>
      <GroupContainer id="mainContent" title="Text">
        <FieldContainer attrName="title.innerContent" label="Title">
          <TextContainer />
        </FieldContainer>
        <FieldContainer attrName="content.innerContent" label="Content">
          <RichTextContainer />
        </FieldContainer>
      </GroupContainer>
      <BackgroundGroup />
      <AdminLabelGroup defaultGroupAttr={defaultSettingsAttrs?.adminLabel} />
    </React.Fragment>
  ),
  design: () => (
    <React.Fragment>
      <FontGroup attrName="title.decoration.font" groupLabel="Title Font" />
      <FontBodyGroup attrName="content.decoration.bodyFont" groupLabel="Content Font" />
      <SizingGroup /><SpacingGroup /><BorderGroup /><BoxShadowGroup />
      <FiltersGroup /><TransformGroup /><AnimationGroup />
    </React.Fragment>
  ),
  advanced: () => (
    <React.Fragment>
      <VisibilitySettingsGroup /><TransitionGroup />
      <PositionSettingsGroup /><ScrollSettingsGroup />
    </React.Fragment>
  ),
},
```

---

### 4. Build configuration

**visual-builder/package.json** — see `references/build-config.md`

**visual-builder/webpack.config.js** — core externals to register:

```js
externals: {
  react: ['vendor', 'React'],        // use array form when using react-dom too
  'react-dom': ['vendor', 'ReactDOM'],
}
// For simple modules without react-dom, shorthand is fine:
// react: 'React'
```

Build commands:
```bash
cd visual-builder
npm install
npm run build      # production (minified)
npm run start      # development watch mode
```

---

### 5. Plugin main file (my-divi-plugin.php)

```php
<?php
/*
 * Plugin Name: My Divi Module
 * Version:     1.0.0
 * Author:      Your Name
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'MY_MODULE_PATH', plugin_dir_path( __FILE__ ) );
define( 'MY_MODULE_URL',  plugin_dir_url( __FILE__ ) );

require_once MY_MODULE_PATH . 'server/index.php';

// Register static CSS (referenced by module.json "style" key)
add_action( 'wp_enqueue_scripts', function() {
    wp_register_style(
        'my-module-style',
        MY_MODULE_URL . 'style.css',
        [],
        '1.0.0'
    );
});

// Enqueue Visual Builder JS
add_action( 'divi_visual_builder_assets_before_enqueue_scripts', function() {
    if ( ! ( et_core_is_fb_enabled() && et_builder_d5_enabled() ) ) {
        return;
    }
    \ET\Builder\VisualBuilder\Assets\PackageBuildManager::register_package_build([
        'name'    => 'my-divi-module-vb',
        'version' => '1.0.0',
        'script'  => [
            'src'                => MY_MODULE_URL . 'visual-builder/build/my-divi-plugin.js',
            'deps'               => [ 'react', 'jquery', 'divi-module-library', 'wp-hooks', 'divi-rest' ],
            'enqueue_top_window' => false,
            'enqueue_app_window' => true,
        ],
    ]);
    // Also enqueue static CSS in the builder
    wp_enqueue_style( 'my-module-style' );
});
```

---

## Common Patterns

### Reading attribute values in PHP

```php
// Standard attribute
$title_text = $attrs['title']['innerContent']['desktop']['value'] ?? '';

// Nested object attribute (e.g. custom field with sub-values)
$posts_num = $attrs['recentPosts']['innerContent']['desktop']['value']['postsNumber'] ?? 5;

// Boolean-style toggle
$show_icon = 'on' === ( $attrs['module']['advanced']['showIcon']['desktop']['value'] ?? 'off' );
```

### Dynamic server-side data (PHP renders, VB fetches via REST)

PHP: Build the HTML string directly in `render_callback` and include it in `$module_inner`.

VB (JSX): Use `useFetch` from `window?.divi?.rest`:

```jsx
const { useFetch } = window?.divi?.rest;

// Inside edit component:
const { fetch, response, isLoading } = useFetch([]);
useEffect(() => {
  fetch({ method: 'GET', restRoute: `/wp/v2/posts?per_page=${postsNumber}` });
}, [postsNumber]);

// In JSX:
{isLoading ? 'Loading…' : response.map(post => (
  <li key={post.id}><a href={post.link}>{post.title.rendered}</a></li>
))}
```

### Custom CSS field in module.json

```json
"css": {
  "type": "object",
  "selector": "{{selector}}",
  "settings": {
    "customCss": {}
  }
}
```

In PHP `module_styles()`:
```php
use ET\Builder\Packages\Module\Options\Css\CssStyle;

CssStyle::style([
  'selector'  => $args['orderClass'],
  'attr'      => $attrs['css'] ?? [],
  'cssFields' => WP_Block_Type_Registry::get_instance()->get_registered('my-vendor/my-module')->customCssFields,
])
```

### Static CSS linked to module.json

Register in PHP with `wp_register_style()`, then reference the handle in `module.json`:
```json
"style": ["my-module-style"]
```
Divi loads the stylesheet only on pages containing the module.

---

## Security

- **Never echo raw `$attrs` values** — always go through `$elements->render()` for element content, or `esc_html()` / `esc_attr()` / `esc_url()` for custom output
- **`HTMLUtility::render()`** + `'childrenSanitizer' => 'et_core_esc_previously'` is the safe pattern for building HTML strings
- **`wp_kses_post()`** for rich text that must allow HTML tags
- Check `et_builder_d5_enabled()` before any D5-specific API calls

---

## Going Further

Beyond building a single module, these tasks have dedicated reference files:

| Task | Reference |
|---|---|
| Add custom fields to a **core** Divi module (Text, Image, Button…) | [references/extending-core-modules.md](references/extending-core-modules.md) |
| Make a custom module work with **global presets** (attribute-name resolvers) | [references/preset-resolution.md](references/preset-resolution.md) |
| Migrate a Divi 4 shortcode module to Divi 5 (`conversion-outline.json`) | [references/conversion-outline.md](references/conversion-outline.md) |
| Read/write builder **state** — breakpoints, global colours, selection, programmatic attribute updates | [references/vb-state-and-hooks.md](references/vb-state-and-hooks.md) |
| Populate select-field options from **runtime/server data** (connections, post types) | [references/dynamic-options.md](references/dynamic-options.md) |
| Expose post meta / CPTs as **Dynamic Content** sources + Loop Builder integration | [references/dynamic-content.md](references/dynamic-content.md) |

---

## Requirements & CSS Cache

### Hosting baseline

Divi 5's client-side editor + page-save routines are memory- and time-intensive.
Recommended server settings (raise these first when saves fail or truncate silently):

| Setting | Minimum | Recommended |
|---|---|---|
| PHP version | 7.4 | 8.0+ |
| `memory_limit` | 128M | 256M–512M |
| `max_input_vars` | 1000 | 3000–5000 |
| `max_execution_time` | 60s | 120–180s |
| `post_max_size` | 32M | 64M–128M |
| `upload_max_filesize` | 16M | 64M |
| Database | MySQL 5.7 / MariaDB 10.2 | MySQL 8.0 / MariaDB 10.5 |

Required PHP extensions: `curl`, `mbstring`, `xml`, and `gd` or `imagick`.
A too-low `max_input_vars` silently truncates design attributes on save — a classic
"my settings won't stick" symptom.

### Static CSS cache

Divi 5 compiles design styles to static files in `wp-content/et-cache/`. If you modify
posts or theme options outside the normal save flow, purge the cache programmatically:

```php
// Clear the whole site's compiled CSS
ET_Core_PageResource::remove_static_resources( 'all', 'all' );

// Clear one post
ET_Core_PageResource::remove_static_resources( $post_id, 'all' );

// Clear only Divi 5 dynamic assets
ET_Core_PageResource::remove_static_resources( $post_id, 'all', false, 'dynamic' );
```

> Note: there is **no** `\ET\Builder\Element::clear_css_cache()` method — that signature
> circulates in third-party notes but does not exist. Use `ET_Core_PageResource` above.

---

## Workflow Checklist

When building a module from scratch:

- [ ] Create plugin directory and `my-plugin.php` with plugin header
- [ ] Write `visual-builder/src/module.json` — name, attributes, settings
- [ ] Write `server/index.php` — PHP class with `load()`, `register_module()`, `render_callback()`, `module_styles()`, `module_classnames()`, `module_script_data()` + `divi_module_library_modules_dependency_tree` hook
- [ ] Write `visual-builder/src/index.jsx` — `ModuleContainer`, `ModuleStyles`, `ModuleScriptData`, `moduleClassnames`, `placeholderContent`, `registerModule` call
- [ ] Write `visual-builder/webpack.config.js` and `visual-builder/package.json`
- [ ] `cd visual-builder && npm install && npm run build`
- [ ] Activate plugin in WP Dashboard → Plugins

---

## Reference Files

Read these when you need the full boilerplate, not just the pattern:

- `references/php-server.md` — Complete annotated `server/index.php` with all static methods
- `references/jsx-component.md` — Complete annotated `index.jsx` with settings panels
- `references/build-config.md` — `webpack.config.js` + `package.json` in full
- `references/module-json-fields.md` — All field component types, attribute patterns, and module.json schema details

Official docs: https://dev.elegantthemes.com/docs/tutorials/module/beginner/create-simple-quick-module/
