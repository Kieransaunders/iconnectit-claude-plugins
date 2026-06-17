# Preset Resolution for Custom Modules

Divi's global presets let a design saved on one module be applied to another. When
attribute names differ between the source and target (common for custom modules), you
must register **preset resolvers** so the preset maps correctly. Without them, applying
a preset built for a core module to your custom module silently drops mismatched values.

Official doc: https://dev.elegantthemes.com/docs/explanations/module/preset/advanced-preset-implementation/

> ⚠️ The "Documentation Roadmap" draft listed these utilities on `ET_Builder_Element`
> with `get_attr_name()` — that is **wrong**. The real classes live in
> `ET\Builder\Packages\GlobalData`. Always confirm against the official doc above.

---

## When you need a resolver

- A preset created on a **Button** is applied to your custom CTA whose attribute is
  named `cta` instead of `button` → name translation needed.
- Your module has a **composite options group** combining several attribute types and
  Divi's default primary-attribute detection guesses wrong.

If your custom module's attribute names match core conventions exactly, you may not
need a resolver at all.

---

## JavaScript resolvers (Visual Builder)

### 1. Attribute-name translation — `optionGroupPresetResolverAttrName`

Maps a source attribute name to your module's equivalent when a preset is applied.

```js
import { addFilter } from '@wordpress/hooks';

addFilter(
  'divi.optionGroupPresetResolverAttrName',
  'your-plugin-name',                 // unique namespace — never 'divi'
  ( attrName, args ) => {
    // args: { moduleName, groupId } (target)
    //       { dataModuleName, dataGroupId, dataPrimaryAttrName } (source)
    //       attrSubName (optional)
    return resolvedAttrName;
  }
);
```

### 2. Primary attribute for composite groups — `optionGroupPresetPrimaryAttrNameResolver`

Register **two** filters: a module-specific one (checked first) and a general fallback.

```js
// Module-specific (camelCase module identifier on the end)
addFilter(
  'divi.optionGroupPresetPrimaryAttrNameResolver.yourModule',
  'your-plugin-name',
  ( primaryAttrName, args ) => /* args: { groupId, groupName, moduleName } */ primaryAttrName
);

// General fallback
addFilter(
  'divi.optionGroupPresetPrimaryAttrNameResolver',
  'your-plugin-name',
  ( primaryAttrName, args ) => primaryAttrName
);
```

---

## PHP resolver (server-side render)

When the JS resolver alone isn't enough (preset values must resolve during backend
rendering), register the PHP filter inside your module's `load()`:

```php
public function load(): void {
    add_action( 'init', [ self::class, 'register_module' ] );
    add_filter(
        'divi_option_group_preset_resolver_attr_name',
        [ self::class, 'resolve_preset_attr_name' ],
        10,
        2
    );
}

public static function resolve_preset_attr_name(
    $attr_name_to_resolve,
    array $params
): ?\ET\Builder\Packages\GlobalData\GlobalPresetItemGroupAttrNameResolved {
    // ... custom mapping logic ...
    return new \ET\Builder\Packages\GlobalData\GlobalPresetItemGroupAttrNameResolved([
        'attrName'    => $resolved,
        'attrSubName' => $sub_name ?? null,
    ]);
}
```

---

## PHP utility classes

Namespace: **`ET\Builder\Packages\GlobalData`**

| Class / method | Purpose |
|---|---|
| `GlobalPresetItemGroupAttrNameResolver::get_attr_names_by_group($module, $groupId)` | List available attributes for a group |
| `GlobalPresetItemGroupAttrNameResolver::is_attr_name_suffix_matched($attr, $pattern)` | Suffix match check |
| `GlobalPresetItemGroupAttrNameResolver::replace_attr_name_prefix($attr, $newPrefix)` | Re-prefix an attribute name |
| `GlobalPresetItemGroupAttrNameResolved` | Result object returned by the PHP resolver |

---

## Key rules

- **Unique namespace, never `'divi'`** — both JS `addFilter` calls and PHP filters.
- Register the **module-specific** primary-attr resolver *and* the **general** fallback.
- Use the PHP resolver only when the JS one can't cover server-render resolution — most
  modules need only the JS resolvers.
