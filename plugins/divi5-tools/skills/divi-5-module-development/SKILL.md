---
name: divi-5-module-development
description: Use when building or modifying Divi 5 custom modules, registering module metadata, rendering callbacks, or integrating dynamic content fields. Covers module.json, TypeScript/React VB bundles, PHP DependencyInterface registration, PackageBuildManager asset enqueueing, and dynamic option injection.
---

# Divi 5 Module Development

## Overview

Divi 5 modules use a **composition-over-inheritance** architecture (inspired by WordPress block editor / Gutenberg). Module metadata lives in `module.json`, consumed by both PHP (frontend render) and JavaScript (Visual Builder settings). The module is registered via PHP's `ModuleRegistration::register_module()` and JS's `registerModule()` inside `addAction('divi.moduleLibrary.registerModuleLibraryStore.after')`.

**Key conceptual shifts from Divi 4:**
- Divi 4: inheritance (`extends ET_Builder_Module`), one-level shortcode attributes, all features inherited until explicitly disabled.
- Divi 5: composition, multi-level nested object attributes, features added explicitly via `module.json`, frontend renderer mirrors VB renderer.
- Divi 5 **does not save rendered HTML** in the database — only module attributes are saved. Frontend re-renders from attributes.

## Attribute Format (6 Levels)

Divi 5 attributes follow a strict nested convention for breakpoints, states, and options:

| Level | Terminology | Example Keys |
|---|---|---|
| 1 | `elementAttributes` | `module`, `title`, `content`, `button` |
| 2 | `elementPart` | `innerContent`, `decoration`, `meta`, `advanced` |
| 3 | `optionAttributes` | `background`, `font`, `spacing`, `adminLabel`, `text` |
| 4 | `breakpointAttributes` | `desktop`, `tablet`, `phone` |
| 5 | `stateAttributes` | `value`, `hover`, `sticky` |
| 6 | `attributeValue` | `'Hello'`, `{ top: '10px', right: '10px' }` |

**Important:** `innerContent` has **no** `optionAttributes` — it jumps directly to `breakpointAttributes`.

```ts
const attrs = {
  title: {
    innerContent: {
      desktop: { value: 'Hello' },   // no optionAttributes here
    },
    decoration: {
      font: {                        // optionAttributes
        desktop: {                   // breakpointAttributes
          value: {                   // stateAttributes
            size: '24px',
            color: '#333',
          },
        },
      },
    },
  },
};
```

### `decoration` optionAttributes (fixed keys)

These are the only valid keys inside `decoration`. They map to built-in `Element*` style components:

`animation`, `background`, `bodyFont`, `border`, `boxShadow`, `button`, `disabledOn`, `filters`, `interactions`, `font`, `icon`, `headingFont`, `overflow`, `order`, `position`, `scroll`, `sizing`, `spacing`, `sticky`, `transform`, `transition`, `zIndex`.

## File Structure

Each module needs **6 frontend files** and **2+ PHP files**:

| File | Purpose |
|---|---|
| `module.json` | Metadata: name, attributes, settings panels, decoration groups |
| `types.ts` | TypeScript types for module attributes |
| `edit.tsx` | React component for VB canvas placeholder/preview |
| `index.ts` | Exports `{ metadata, renderers }` for registration |
| `styles.tsx` | React component for VB style rendering |
| `module-classnames.ts` | Classname generation for the module wrapper |
| `src/Divi/{Module}D5.php` | PHP `DependencyInterface`: `generate_module_json()`, `render_callback()`, `ModuleRegistration::register_module()` |
| `src/Plugin.php` | Boots the module, enqueues VB assets via `PackageBuildManager` |

## Critical Pattern: Dynamic Options in Select Fields

Divi 5 **does not** fire `divi.moduleLibrary.moduleAttributes.*` filters. `addFilter()` on these hooks is dead code for option population. The VB reads options solely from the metadata object passed to `registerModule()`, which is inlined from `module.json` at webpack build time.

**To inject dynamic options (e.g., connection dropdown, field list):**

1. **PHP** (`{Module}D5.php:generate_module_json()`): On `init`, read the source `module.json`, inject real options, write to `modules-json/{module}/module.json`. This file is registered by `ModuleRegistration::register_module()` for server-side block registration.

2. **PHP** (`Plugin.php` or bootstrap): Read the server-generated `module.json` and pass it as a JSON string via `PackageBuildManager`'s `data_top_window` / `data_app_window` script params. This triggers `wp_localize_script()` which outputs a `<script>` tag with a global JS variable **before** the bundle executes.

   ```php
   $data = [
       'filtersModuleJson' => file_get_contents($filters_path),
       'recordsModuleJson' => file_get_contents($records_path),
   ];
   PackageBuildManager::register_package_build([
       'name'   => 'my-module-vb-bundle',
       'script' => [
           'data_top_window' => $data,
           'data_app_window' => $data,
       ],
   ]);
   ```

3. **JS** (`assets/src/divi/index.ts`): Inside `addAction('divi.moduleLibrary.registerModuleLibraryStore.after')`, read the global (`MyModuleVbBundleData` — PascalCase of script name), parse the server-generated module JSON, and pass it as the **first argument** to `registerModule()` (overriding the build-time inlined metadata):

   ```ts
   const meta = JSON.parse(MyModuleVbBundleData.filtersModuleJson) ?? inlinedMetadata;
   registerModule(meta, omit(module, 'metadata'));
   ```

**Key rules:**
- The `wp_localize_script` global name is `${PascalCase(scriptName)}Data` (e.g., `my-module-vb-bundle` → `MyModuleVbBundleData`).
- Module metadata must be injected at `registerModule()` time — async fetch, `addFilter`, and post-registration store mutation are all unreliable.
- The `modules-json/` directory is overwritten by webpack on every build. PHP's `generate_module_json()` must run on every page load (`init` priority 1) to re-inject real options.
- Both `data_top_window` and `data_app_window` should be set since module settings render in the top window and the canvas in the app window.

## module.json Anatomy

```json
{
  "name": "my-plugin/module-name",
  "d4Shortcode": "my_plugin_module_name",
  "title": "Module Title",
  "titles": "Module Titles",
  "category": "module",
  "moduleClassName": "my_plugin_module_name",
  "moduleOrderClassName": "my_plugin_module_name",
  "attributes": {
    "module": {
      "type": "object",
      "selector": "{{selector}}",
      "default": {
        "meta": {
          "adminLabel": { "desktop": { "value": "Module Title" } }
        }
      },
      "settings": {
        "meta": { "adminLabel": {} },
        "decoration": {
          "layout": {}, "background": {}, "sizing": {}, "spacing": {},
          "border": {}, "boxShadow": {}, "filters": {}, "transform": {},
          "animation": {}, "overflow": {}, "disabledOn": {}, "transition": {},
          "position": {}, "zIndex": {}, "scroll": {}, "sticky": {}
        }
      }
    },
    "title": {
      "type": "object",
      "selector": "{{selector}} .my_plugin_module_name_title",
      "attributes": { "class": "my_plugin_module_name_title" },
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
            "features": {
              "dynamicContent": {
                "type": "text"
              }
            },
            "component": {
              "name": "divi/text",
              "type": "field"
            }
          }
        },
        "decoration": {
          "layout": {},
          "font": {
            "priority": 10,
            "component": {
              "props": {
                "groupLabel": "Title Font",
                "fieldLabel": "",
                "fields": { "headingLevel": { "render": false } }
              }
            }
          }
        }
      }
    }
  },
  "settings": {
    "content": "auto",
    "design": "auto",
    "advanced": "auto"
  }
}
```

### Dynamic Content Features

To enable dynamic content on a field, set `features.dynamicContent`:

```json
"features": {
  "dynamicContent": {
    "type": "text"
  },
  "preset": "content"
}
```

Supported `type` values: `text`, `image`, `url`, `date`, `number`, `color`, `background`, `icon`.

## PHP Registration (`DependencyInterface`)

```php
<?php
declare(strict_types=1);

namespace MyPlugin\Divi;

use ET\Builder\Framework\DependencyManagement\Interfaces\DependencyInterface;
use ET\Builder\Packages\ModuleLibrary\ModuleRegistration;

class MyModuleD5 implements DependencyInterface {

    public function load(): void {
        add_action('init', function () {
            self::generate_module_json(AIRLOOP_PLUGIN_DIR . 'modules-json/my-module/');

            // Re-register fresh metadata on every request.
            $registry = \WP_Block_Type_Registry::get_instance();
            if ($registry->is_registered('my-plugin/module-name')) {
                $registry->unregister('my-plugin/module-name');
            }

            ModuleRegistration::register_module(
                AIRLOOP_PLUGIN_DIR . 'modules-json/my-module/',
                ['render_callback' => [self::class, 'render_callback']]
            );
        }, 1);
    }

    private static function generate_module_json(string $json_dir): void {
        $src = AIRLOOP_PLUGIN_DIR . 'assets/src/divi/my-module/module.json';
        if (!file_exists($src)) { return; }

        $json = file_get_contents($src);
        $data = json_decode($json, false);
        if (!is_object($data)) { return; }

        // Inject dynamic options into select field.
        $options = new \stdClass();
        $options->option1 = (object)['label' => 'Option 1'];
        if (isset($data->attributes->myField->settings->innerContent->items->myField->component->props)) {
            $data->attributes->myField->settings->innerContent->items->myField->component->props->options = $options;
        }

        wp_mkdir_p($json_dir);
        file_put_contents($json_dir . 'module.json', wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    public static function render_callback(array $attrs, string $content, \WP_Block $block): string {
        // Extract values from nested attribute structure.
        $title = sanitize_text_field((string) ($attrs['title']['innerContent']['desktop']['value'] ?? ''));

        // Build HTML output.
        return sprintf(
            '<div class="et_pb_module_inner"><h2 class="my_plugin_module_name_title">%s</h2></div>',
            esc_html($title)
        );
    }
}
```

## VB Asset Enqueueing

```php
function my_plugin_enqueue_vb_assets(): void {
    if (!et_core_is_fb_enabled() || !et_builder_d5_enabled()) {
        return;
    }

    $filters_path = AIRLOOP_PLUGIN_DIR . 'modules-json/my-module/module.json';
    $records_path = AIRLOOP_PLUGIN_DIR . 'modules-json/my-other-module/module.json';

    $data = [
        'filtersModuleJson' => file_exists($filters_path) ? file_get_contents($filters_path) : '{}',
        'recordsModuleJson' => file_exists($records_path) ? file_get_contents($records_path) : '{}',
    ];

    \ET\Builder\VisualBuilder\Assets\PackageBuildManager::register_package_build([
        'name'    => 'my-module-vb-bundle',
        'version' => '1.0.0',
        'script'  => [
            'src'                => plugins_url('assets/dist/divi-module-bundle.js', __FILE__),
            'deps'               => ['react', 'jquery', 'divi-module-library', 'wp-hooks', 'divi-rest'],
            'enqueue_top_window' => false,
            'enqueue_app_window' => true,
            'data_top_window'    => $data,
            'data_app_window'    => $data,
        ],
    ]);
}
add_action('divi_visual_builder_assets_before_enqueue_scripts', 'my_plugin_enqueue_vb_assets');
```

## TypeScript Bundle Entry Point

```ts
import { omit } from 'lodash';
import { addAction } from '@wordpress/hooks';
import { registerModule } from '@divi/module-library';
import { myModule } from './my-module';

declare const MyModuleVbBundleData:
  | { filtersModuleJson: string; recordsModuleJson: string }
  | undefined;

addAction('divi.moduleLibrary.registerModuleLibraryStore.after', 'my-plugin', () => {
    const filtersMeta = tryParseJson(MyModuleVbBundleData?.filtersModuleJson) ?? myModule.metadata;
    registerModule(filtersMeta, omit(myModule, 'metadata'));
});

function tryParseJson(raw: string | undefined): Record<string, unknown> | undefined {
    if (typeof raw !== 'string' || raw === '') return undefined;
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
}
```

## Divi 5 Dynamic Content Registration (Custom Post Meta)

To make custom postmeta fields available as Dynamic Content sources in Divi 5 (like ACF fields), use two hooks:

```php
class DynamicContentIntegration {

    public function __construct() {
        add_filter('divi_module_dynamic_content_options', [$this, 'register_options'], 10, 3);
        add_filter('divi_module_dynamic_content_resolved_value', [$this, 'resolve_value'], 10, 2);
    }

    /**
     * Register dynamic content options.
     *
     * @param array  $options Existing options keyed by option id.
     * @param int    $post_id Current post id.
     * @param string $context 'edit' or 'display'.
     */
    public function register_options(array $options, int $post_id, string $context): array {
        $group = esc_html__('My Plugin', 'my-plugin');

        $meta_keys = ['_my_field_name', '_my_other_field'];
        foreach ($meta_keys as $key) {
            if (isset($options[$key])) { continue; }

            $options[$key] = [
                'id'     => $key,
                'label'  => sprintf('%s (%s)', $key, $group),
                'type'   => 'text',   // or 'image', 'url', 'number'
                'custom' => false,
                'group'  => $group,
                'fields' => [
                    'before' => ['label' => esc_html__('Before', 'my-plugin'), 'type' => 'text', 'default' => ''],
                    'after'  => ['label' => esc_html__('After', 'my-plugin'), 'type' => 'text', 'default' => ''],
                ],
            ];
        }
        return $options;
    }

    /**
     * Resolve the dynamic content value.
     *
     * @param mixed $value     Current resolved value.
     * @param array $data_args Resolution args: name, settings, post_id, etc.
     */
    public function resolve_value($value, array $data_args) {
        $name = $data_args['name'] ?? '';
        if (!is_string($name) || !str_starts_with($name, '_my_')) {
            return $value;
        }

        $post_id = (int) ($data_args['post_id'] ?? 0);
        if ($post_id <= 0) { $post_id = (int) get_the_ID(); }
        if ($post_id <= 0) { return $value; }

        $raw = get_post_meta($post_id, $name, true);
        $resolved = is_string($raw) ? $raw : '';

        $settings = $data_args['settings'] ?? [];
        $before = isset($settings['before']) ? (string) $settings['before'] : '';
        $after  = isset($settings['after']) ? (string) $settings['after'] : '';

        return '' === $resolved ? $resolved : $before . $resolved . $after;
    }
}
```

### Key Types for Dynamic Content

| `type` | Use For |
|---|---|
| `text` | Text, WYSIWYG, textarea fields |
| `image` | Featured image, attachment fields, image URLs |
| `url` | Links, permalinks, external URLs |
| `number` | Numeric values, prices, counters |
| `date` | Published date, custom date fields |
| `color` | Color picker values |
| `background` | Background image/color values |
| `icon` | Icon font selections |

## Enabling Dynamic Content on Existing Fields (3rd Party)

If modifying another module's fields from outside, use **both** JS and PHP hooks because `module.json` is used on both sides.

**JS:**
```ts
window.vendor.wp.hooks.addFilter(
    'divi.moduleLibrary.moduleAttributes.example.static-module',
    'my-plugin',
    (attributes, metadata) => {
        if (attributes.image?.settings?.innerContent?.items?.src?.features) {
            attributes.image.settings.innerContent.items.src.features.dynamicContent = { type: 'image' };
            attributes.image.settings.innerContent.items.src.features.preset = 'content';
        }
        return attributes;
    }
);
```

**PHP:**
```php
add_filter('block_type_metadata_settings', function (array $settings): array {
    if (($settings['name'] ?? '') !== 'example/static-module') { return $settings; }
    if (isset($settings['attributes']['image']['settings']['innerContent']['items']['src']['features'])) {
        $settings['attributes']['image']['settings']['innerContent']['items']['src']['features']['dynamicContent'] = ['type' => 'image'];
        $settings['attributes']['image']['settings']['innerContent']['items']['src']['features']['preset'] = 'content';
    }
    return $settings;
});
```

**Important:** Enqueue the JS script via `PackageBuildManager` with deps `['lodash', 'divi-vendor-wp-hooks']`.

## Loop Builder Integration

To make a custom post type available in Divi 5's Loop Builder and dynamic content pickers:

```php
class LoopIntegration {

    public function __construct() {
        // Register CPT with Divi builder.
        add_filter('et_builder_post_types', [$this, 'register_post_type']);

        // Divi 4 legacy dynamic content registry.
        add_filter('et_builder_dynamic_content_fields', [$this, 'register_dynamic_fields'], 10, 2);

        // Divi 5 first-class dynamic content options.
        add_filter('divi_module_dynamic_content_options', [$this, 'register_d5_options'], 10, 3);
        add_filter('divi_module_dynamic_content_resolved_value', [$this, 'resolve_d5_value'], 10, 2);
    }

    public function register_post_type(array $post_types): array {
        if (!in_array('my_custom_post_type', $post_types, true)) {
            $post_types[] = 'my_custom_post_type';
        }
        return $post_types;
    }
}
```

## Custom CSS / Loop Group

For custom CSS selectors inside modules (including loop item selectors), add `customCssFields` to `module.json` under the `module` element:

```json
{
  "attributes": {
    "module": {
      "settings": {
        "advanced": {
          "customCssFields": {
            "myCustomSelector": {
              "subName": "myCustomSelector",
              "selectorSuffix": " .my_custom_element"
            }
          }
        }
      }
    }
  }
}
```

In the Visual Builder `edit.tsx`, pass `orderClass`, `baseOrderClass`, and `isCustomPostType` to `ModuleContainer` so custom CSS placeholders resolve correctly in loops.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using `addFilter('divi.moduleLibrary.moduleAttributes.*')` for dynamic options | Divi 5 never fires these. Inject options into `module.json` before `registerModule()` is called. |
| Editing `assets/dist/*.css` directly | Webpack overwrites on build. Always edit `assets/src/*.css` and run `npm run build`. |
| Forgetting to unregister block before re-registering | `WP_Block_Type_Registry` never updates existing registrations. Call `unregister()` first in `generate_module_json()`. |
| Only setting `data_top_window` or `data_app_window` | Set both. Module settings render in the top window; canvas renders in the app window. |
| Not running `generate_module_json()` on every `init` | The `modules-json/` directory is overwritten by webpack. Regenerate on every page load. |
| Assuming `dynamicContent: false` disables it cleanly | Remove the key entirely or set it to an object with `type` to properly enable/disable. |
| Expecting Divi 4 shortcode attributes to work in D5 | D5 uses nested object attributes. Extract values from `innerContent.desktop.value` paths. |
| Bundling Divi packages in webpack | Mark `react`, `@wordpress/hooks`, `@divi/module`, `@divi/module-library` as `externals`. |

## Build Commands

```bash
npm run build   # Production bundle
npm run dev     # Watch mode
```

Divi externals (`react`, `@wordpress/hooks`, `@divi/module`, `@divi/module-library`) are provided as globals at runtime — list them as webpack `externals`, do NOT bundle them.

## Quick Reference: Attribute Value Extraction

In PHP `render_callback()`, values are nested:

```php
$value = sanitize_text_field((string) (
    $attrs['fieldName']['innerContent']['desktop']['value']['subKey'] ?? ''
));
```

For simple text fields, the `value` itself is the string. For complex fields (select, multi-select), the `value` may contain object keys.

## Quick Reference: Webpack Externals

```js
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    '@wordpress/hooks': 'window.vendor.wp.hooks',
    '@divi/module': 'window.divi.module',
    '@divi/module-library': 'window.divi.moduleLibrary',
    '@divi/rest': 'window.divi.rest',
    lodash: 'window.vendor.lodash',
  },
};
```
