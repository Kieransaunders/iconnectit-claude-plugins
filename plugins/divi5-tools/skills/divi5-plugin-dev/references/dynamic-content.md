# Dynamic Content Sources & Loop Builder Integration

How to expose custom data (post meta, custom post types) to Divi 5's **Dynamic Content**
picker and **Loop Builder**, and how to enable Dynamic Content on fields you don't own.

> **Source:** empirical, from a production plugin (Airloop). These hook names are not in
> the public dev-docs pages we could fetch — confirm against your Divi 5 build before
> relying on them, as filter names can shift between releases.

---

## Register custom post meta as a Dynamic Content source

Two filters: one to advertise the option, one to resolve its value at render.

```php
class DynamicContentIntegration {

    public function __construct() {
        add_filter('divi_module_dynamic_content_options', [$this, 'register_options'], 10, 3);
        add_filter('divi_module_dynamic_content_resolved_value', [$this, 'resolve_value'], 10, 2);
    }

    /**
     * @param array  $options Existing options keyed by id.
     * @param int    $post_id Current post id.
     * @param string $context 'edit' or 'display'.
     */
    public function register_options(array $options, int $post_id, string $context): array {
        $group = esc_html__('My Plugin', 'my-plugin');
        foreach (['_my_field_name', '_my_other_field'] as $key) {
            if (isset($options[$key])) { continue; }
            $options[$key] = [
                'id'     => $key,
                'label'  => sprintf('%s (%s)', $key, $group),
                'type'   => 'text', // text | image | url | number | date | color | background | icon
                'custom' => false,
                'group'  => $group,
                'fields' => [
                    'before' => ['label' => __('Before', 'my-plugin'), 'type' => 'text', 'default' => ''],
                    'after'  => ['label' => __('After', 'my-plugin'),  'type' => 'text', 'default' => ''],
                ],
            ];
        }
        return $options;
    }

    /** @param array $data_args Resolution args: name, settings, post_id, etc. */
    public function resolve_value($value, array $data_args) {
        $name = $data_args['name'] ?? '';
        if (!is_string($name) || !str_starts_with($name, '_my_')) {
            return $value;
        }
        $post_id = (int) ($data_args['post_id'] ?? 0) ?: (int) get_the_ID();
        if ($post_id <= 0) { return $value; }

        $raw      = get_post_meta($post_id, $name, true);
        $resolved = is_string($raw) ? $raw : '';
        $settings = $data_args['settings'] ?? [];
        $before   = (string) ($settings['before'] ?? '');
        $after    = (string) ($settings['after'] ?? '');

        return '' === $resolved ? $resolved : $before . $resolved . $after;
    }
}
```

### Dynamic Content `type` values

| `type` | Use for |
|---|---|
| `text` | Text, WYSIWYG, textarea |
| `image` | Featured image, attachment, image URL |
| `url` | Links, permalinks, external URLs |
| `number` | Numeric values, prices, counters |
| `date` | Published / custom date fields |
| `color` | Colour-picker values |
| `background` | Background image/colour |
| `icon` | Icon-font selections |

---

## Enable Dynamic Content on a field you don't own (3rd party)

Because `module.json` drives both sides, set the feature in **both** JS and PHP.

**JS** — hook the target module's attributes filter:

```ts
window.vendor.wp.hooks.addFilter(
    'divi.moduleLibrary.moduleAttributes.example.static-module',
    'my-plugin',
    (attributes) => {
        const src = attributes.image?.settings?.innerContent?.items?.src;
        if (src?.features) {
            src.features.dynamicContent = { type: 'image' };
            src.features.preset = 'content';
        }
        return attributes;
    }
);
```

Enqueue this script via `PackageBuildManager` with deps `['lodash', 'divi-vendor-wp-hooks']`.

**PHP** — mirror it through `block_type_metadata_settings`:

```php
add_filter('block_type_metadata_settings', function (array $settings): array {
    if (($settings['name'] ?? '') !== 'example/static-module') { return $settings; }
    $features = &$settings['attributes']['image']['settings']['innerContent']['items']['src']['features'] ?? null;
    if (isset($features)) {
        $features['dynamicContent'] = ['type' => 'image'];
        $features['preset']         = 'content';
    }
    return $settings;
});
```

To enable Dynamic Content on **your own** module's field, just declare it in
`module.json`:

```json
"features": { "dynamicContent": { "type": "text" }, "preset": "content" }
```

> Don't set `dynamicContent: false` to disable — remove the key entirely, or set it to
> an object with a `type`.

---

## Loop Builder + custom post type

Make a CPT available to the Loop Builder and dynamic-content pickers:

```php
class LoopIntegration {
    public function __construct() {
        add_filter('et_builder_post_types', [$this, 'register_post_type']);            // Builder + Loop
        add_filter('et_builder_dynamic_content_fields', [$this, 'register_fields'], 10, 2); // D4 legacy DC
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

### Custom CSS selectors for loop items

For per-item custom-CSS selectors, add `customCssFields` under the `module` element in
`module.json`:

```json
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
```

In `edit.tsx`, pass `orderClass`, `baseOrderClass`, and `isCustomPostType` to
`ModuleContainer` so custom-CSS placeholders resolve correctly inside loops.
