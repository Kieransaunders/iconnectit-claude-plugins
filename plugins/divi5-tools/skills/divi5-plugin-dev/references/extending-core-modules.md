# Extending Core Divi Modules

Adding custom fields/options to **existing** Divi modules (Text, Image, Button, etc.)
without building a new module. This is a different task from creating a module — you
hook into the target module's attribute schema via a JS filter, then read the saved
value in PHP at render time.

Official doc: https://dev.elegantthemes.com/docs/tutorials/module/advanced/customize-module-settings-output/common-use-cases/adding-custom-fields-to-admin-label-group/

---

## The filter hooks

| Filter | Scope |
|---|---|
| `divi.moduleLibrary.moduleAttributes.{namespace}.{module}` | One specific module |
| `divi.module.options.adminLabel.group.fields` | All modules' Admin Label group |

**Core module targets** (namespace is `divi`):

| Filter target | Module |
|---|---|
| `divi.moduleLibrary.moduleAttributes.divi.text` | Text |
| `divi.moduleLibrary.moduleAttributes.divi.image` | Image |
| `divi.moduleLibrary.moduleAttributes.divi.button` | Button |
| `divi.moduleLibrary.moduleAttributes.divi.audio` | Audio |
| `divi.moduleLibrary.moduleAttributes.divi.video` | Video |
| `divi.moduleLibrary.moduleAttributes.divi.contact-form` | Contact Form |
| `divi.moduleLibrary.moduleAttributes.{your-ns}.{your-module}` | A custom module |

Added fields support **Hover, Sticky, Presets, and Dynamic Content** like native fields.

---

## JSX — register the field

```jsx
const { addFilter } = window?.vendor?.wp?.hooks;

addFilter(
  'divi.moduleLibrary.moduleAttributes.divi.text', // target module
  'your-plugin-name',                               // unique namespace — never 'divi'
  (moduleAttributes) => {
    // Add a new attribute to the module's schema
    moduleAttributes.myCustomField = {
      type: 'object',
      settings: {
        meta: {
          // field definition — same shape as a module.json group-item
        },
      },
    };
    return moduleAttributes;
  }
);
```

- The custom value persists under `module.meta.{fieldName}` in the module's attributes.
- The third argument is the modifier callback; an optional fourth argument is priority.

---

## Asset registration (REQUIRED — different deps from a normal module)

The filter script must be registered through `PackageBuildManager` with **`lodash` and
`divi-vendor-wp-hooks`** as dependencies, enqueued in the app window only:

```php
add_action( 'divi_visual_builder_assets_before_enqueue_scripts', function() {
    if ( ! ( et_core_is_fb_enabled() && et_builder_d5_enabled() ) ) {
        return;
    }
    \ET\Builder\VisualBuilder\Assets\PackageBuildManager::register_package_build([
        'name'    => 'my-core-field-extension',
        'version' => '1.0.0',
        'script'  => [
            'src'                => MY_MODULE_URL . 'visual-builder/build/extend-text.js',
            'deps'               => [ 'lodash', 'divi-vendor-wp-hooks' ],
            'enqueue_top_window' => false,
            'enqueue_app_window' => true,
        ],
    ]);
});
```

> Timing matters: the script must load **after** `lodash` and `divi-vendor-wp-hooks`
> or the `addFilter` call races the registry and silently does nothing.

---

## Reading the value in PHP

The field lives under `module.meta`:

```php
$my_value = $attrs['module']['meta']['myCustomField']['desktop']['value'] ?? '';
```

For a core module you don't own the `render_callback`, so the typical pattern is to
hook a Divi render/output filter for that module and inject your markup, or use the
value to enqueue conditional assets.

---

## Key rules

- **Never use `'divi'` as your namespace** — it's reserved for core. Use a unique,
  plugin-specific string (`'your-plugin-name'`) everywhere you call `addFilter`.
- Custom fields added this way **must still round-trip** through Hover/Sticky/Preset
  resolution — register a preset resolver if attribute names differ (see
  [preset-resolution.md](preset-resolution.md)).
- Deps for extension scripts are `lodash` + `divi-vendor-wp-hooks`, **not** the
  `react`/`divi-module-library` set used when registering a whole module.
