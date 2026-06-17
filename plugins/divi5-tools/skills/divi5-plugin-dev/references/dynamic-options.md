# Runtime-Driven Select Options (server data → Visual Builder)

When a module's select/dropdown field needs options that only exist at **runtime** —
e.g. a list of API connections, post types, or remote fields — you cannot ship them in
the static `module.json`. This file documents the injection pattern for that case.

> **Source:** empirical, from a production plugin (Airloop). The official docs cover
> module registration and `addFilter` field extension, but not this runtime
> data-injection mechanism — verify behaviour against your Divi 5 version.

---

## Reconciling the filter question

A common claim is *"`divi.moduleLibrary.moduleAttributes.*` is dead code in Divi 5."*
That is **overstated**. The truth is split by what you're changing:

| Goal | Mechanism |
|---|---|
| Add a field / enable a feature (e.g. dynamicContent) on a module's schema | ✅ `divi.moduleLibrary.moduleAttributes.{ns}.{module}` JS filter — see [extending-core-modules.md](extending-core-modules.md) |
| Populate a select field's **option list from runtime data** | ❌ Filter timing is unreliable — inject into `module.json` **before** `registerModule()` (this file) |

So: use the filter for schema/feature changes; use module.json injection for live
option *data*.

---

## The pattern (3 steps)

### 1. PHP — regenerate module.json with real options on every load

The VB reads options from the metadata passed to `registerModule()`, which is inlined
from `module.json` at webpack build time. To inject live data, write a fresh
`module.json` server-side on every `init`, then register it.

```php
class MyModuleD5 implements DependencyInterface {

    public function load(): void {
        add_action('init', function () {
            self::generate_module_json(MY_PLUGIN_DIR . 'modules-json/my-module/');

            // WP_Block_Type_Registry never updates an existing registration —
            // unregister before re-registering with fresh metadata.
            $registry = \WP_Block_Type_Registry::get_instance();
            if ($registry->is_registered('my-plugin/module-name')) {
                $registry->unregister('my-plugin/module-name');
            }

            ModuleRegistration::register_module(
                MY_PLUGIN_DIR . 'modules-json/my-module/',
                ['render_callback' => [self::class, 'render_callback']]
            );
        }, 1); // priority 1 — webpack overwrites modules-json/ on build, so regenerate early
    }

    private static function generate_module_json(string $json_dir): void {
        $src = MY_PLUGIN_DIR . 'assets/src/divi/my-module/module.json';
        if (!file_exists($src)) { return; }

        $data = json_decode(file_get_contents($src), false);
        if (!is_object($data)) { return; }

        // Inject runtime options into the select field's component props.
        $options = new \stdClass();
        $options->option1 = (object) ['label' => 'Option 1'];
        $props = $data->attributes->myField->settings->innerContent->items->myField->component->props ?? null;
        if ($props) {
            $props->options = $options;
        }

        wp_mkdir_p($json_dir);
        file_put_contents(
            $json_dir . 'module.json',
            wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}
```

### 2. PHP — pass the generated JSON to the bundle as a JS global

Use `PackageBuildManager`'s `data_top_window` / `data_app_window` (these trigger
`wp_localize_script`, emitting a `<script>` global **before** the bundle runs).

```php
$data = [
    'filtersModuleJson' => file_exists($filters_path) ? file_get_contents($filters_path) : '{}',
];
\ET\Builder\VisualBuilder\Assets\PackageBuildManager::register_package_build([
    'name'    => 'my-module-vb-bundle',
    'version' => '1.0.0',
    'script'  => [
        'src'                => plugins_url('assets/dist/divi-module-bundle.js', __FILE__),
        'deps'               => ['react', 'jquery', 'divi-module-library', 'wp-hooks', 'divi-rest'],
        'enqueue_top_window' => false,
        'enqueue_app_window' => true,
        'data_top_window'    => $data, // settings render in the top window
        'data_app_window'    => $data, // canvas renders in the app window — set BOTH
    ],
]);
```

### 3. JS — read the global and pass it as the first arg to registerModule()

The global name is **`${PascalCase(scriptName)}Data`** (so `my-module-vb-bundle` →
`MyModuleVbBundleData`). Override the build-time metadata at registration time:

```ts
import { omit } from 'lodash';
import { addAction } from '@wordpress/hooks';
import { registerModule } from '@divi/module-library';
import { myModule } from './my-module';

declare const MyModuleVbBundleData: { filtersModuleJson: string } | undefined;

addAction('divi.moduleLibrary.registerModuleLibraryStore.after', 'my-plugin', () => {
    const meta = tryParseJson(MyModuleVbBundleData?.filtersModuleJson) ?? myModule.metadata;
    registerModule(meta, omit(myModule, 'metadata'));
});

function tryParseJson(raw?: string) {
    if (typeof raw !== 'string' || raw === '') return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
}
```

---

## Key rules

- Inject options at `registerModule()` time. Async fetch, `addFilter`, and
  post-registration store mutation are all unreliable for option *data*.
- Global name = `${PascalCase(scriptName)}Data`.
- Set **both** `data_top_window` and `data_app_window` (settings vs. canvas).
- `generate_module_json()` must run on every `init` — webpack overwrites
  `modules-json/` on each build.
- Always `unregister()` the block before re-registering — the registry never updates
  an existing entry.
