# PHP Server Reference — Complete server/index.php Template

Full annotated template for a Divi 5 custom module's server-side renderer.

```php
<?php
/**
 * Server-side renderer for My Module.
 *
 * @package MyVendorMyModule
 */

namespace MyVendorMyModule;

if ( ! defined( 'ABSPATH' ) ) {
    die( 'Direct access forbidden.' );
}

use ET\Builder\Framework\DependencyManagement\Interfaces\DependencyInterface;
use ET\Builder\Framework\Utility\HTMLUtility;
use ET\Builder\FrontEnd\Module\Style;
use ET\Builder\Packages\Module\Module;
use ET\Builder\Packages\Module\Options\Element\ElementClassnames;
use ET\Builder\Packages\ModuleLibrary\ModuleRegistration;

/**
 * Module render class.
 *
 * Implements DependencyInterface so that load() is called by Divi's DependencyTree.
 */
class MyVendorMyModule implements DependencyInterface {

    /**
     * Initialise the module.
     *
     * Called by DependencyTree. Register module on 'init' so that the WP block
     * type registry is ready.
     */
    public function load(): void {
        add_action( 'init', [ self::class, 'register_module' ] );
    }

    /**
     * Register the module with Divi's block system.
     *
     * $module_json_folder_path must point to the DIRECTORY that contains module.json,
     * not the file itself. Divi reads module.json automatically.
     */
    public static function register_module(): void {
        $module_json_folder_path = dirname( __DIR__, 1 ) . '/visual-builder/src';

        ModuleRegistration::register_module(
            $module_json_folder_path,
            [
                'render_callback' => [ self::class, 'render_callback' ],
            ]
        );
    }

    // -------------------------------------------------------------------------
    // render_callback
    // -------------------------------------------------------------------------

    /**
     * Render the module HTML on the front end.
     *
     * @param array          $attrs    Block attributes saved by the builder.
     * @param string         $content  Inner block content (empty for leaf modules).
     * @param \WP_Block      $block    Parsed block object.
     * @param ModuleElements $elements Elements helper — renders attrs and styles.
     *
     * @return string Rendered HTML.
     */
    public static function render_callback( $attrs, $content, $block, $elements ): string {
        // --- Render each declared element ---
        // elements->render() reads the attribute definition from module.json and
        // outputs the right tag with inline-edited content and decoration classes.
        $title   = $elements->render( [ 'attrName' => 'title' ] );
        $content = $elements->render( [ 'attrName' => 'content' ] );

        // --- Build custom HTML with HTMLUtility ---
        // HTMLUtility::render() is Divi's safe wrapper around building HTML strings.
        // 'childrenSanitizer' => 'et_core_esc_previously' means children have already
        // been sanitised upstream and can be echoed safely.
        $module_inner = HTMLUtility::render(
            [
                'tag'               => 'div',
                'attributes'        => [
                    'class' => 'et_pb_module_inner',
                ],
                'childrenSanitizer' => 'et_core_esc_previously',
                'children'          => $title . $content,
            ]
        );

        // style_components() injects the inline <style> tag for decoration options
        // (background, spacing, border, etc.) that are stored as attributes.
        // It MUST be included as the first item in Module::render() children.
        $module_elements = $elements->style_components(
            [
                'attrName' => 'module',
            ]
        );

        return Module::render(
            [
                // Front-end only — identifies this block instance in the parser store.
                'orderIndex'          => $block->parsed_block['orderIndex'],
                'storeInstance'       => $block->parsed_block['storeInstance'],

                // Core — mirrored in the JSX edit component.
                'attrs'               => $attrs,
                'elements'            => $elements,
                'id'                  => $block->parsed_block['id'],
                'moduleClassName'     => 'my_vendor_my_module',   // matches module.json moduleClassName
                'name'                => $block->block_type->name,
                'classnamesFunction'  => [ self::class, 'module_classnames' ],
                'moduleCategory'      => $block->block_type->category,
                'stylesComponent'     => [ self::class, 'module_styles' ],
                'scriptDataComponent' => [ self::class, 'module_script_data' ],
                'children'            => $module_elements . $module_inner,
            ]
        );
    }

    // -------------------------------------------------------------------------
    // module_styles
    // -------------------------------------------------------------------------

    /**
     * Register computed CSS styles for the module.
     *
     * Style::add() collects all CSS declarations and outputs them in one
     * <style> block. Each $elements->style() call handles one attribute group
     * (background, font, spacing, etc.) automatically from module.json declarations.
     */
    public static function module_styles( array $args ): void {
        $elements = $args['elements'];

        Style::add(
            [
                'id'            => $args['id'],
                'name'          => $args['name'],
                'orderIndex'    => $args['orderIndex'],
                'storeInstance' => $args['storeInstance'],
                'styles'        => [
                    // Module wrapper styles — always include disabledOn.
                    $elements->style(
                        [
                            'attrName'   => 'module',
                            'styleProps' => [
                                'disabledOn' => [
                                    'disabledModuleVisibility' => $args['settings']['disabledModuleVisibility'] ?? null,
                                ],
                            ],
                        ]
                    ),
                    // Add one $elements->style() call for each declared attribute
                    // that has decoration settings in module.json.
                    $elements->style( [ 'attrName' => 'title' ] ),
                    $elements->style( [ 'attrName' => 'content' ] ),
                ],
            ]
        );
    }

    // -------------------------------------------------------------------------
    // module_classnames
    // -------------------------------------------------------------------------

    /**
     * Add CSS classnames to the module wrapper element.
     *
     * ElementClassnames::classnames() automatically handles Divi's standard
     * decoration classnames (animation, overflow, etc.) derived from $attrs.
     * Add custom classnames with $classnames_instance->add('my-class', $condition).
     */
    public static function module_classnames( array $args ): void {
        $classnames_instance = $args['classnamesInstance'];
        $attrs               = $args['attrs'];

        // Standard decoration classnames (always include this).
        $classnames_instance->add(
            ElementClassnames::classnames(
                [
                    'attrs' => $attrs['module']['decoration'] ?? [],
                ]
            )
        );

        // Example: conditional custom classname.
        // $show_icon = 'on' === ( $attrs['module']['advanced']['showIcon']['desktop']['value'] ?? 'off' );
        // $classnames_instance->add( 'has-icon', $show_icon );
    }

    // -------------------------------------------------------------------------
    // module_script_data
    // -------------------------------------------------------------------------

    /**
     * Register script data needed for front-end JavaScript behaviour.
     *
     * For most modules, delegating to $elements->script_data() for the 'module'
     * attribute is sufficient. Use MultiViewScriptData::set() for hover/sticky
     * state changes that need JS (see Blurb module for examples).
     */
    public static function module_script_data( array $args ): void {
        $elements = $args['elements'];

        $elements->script_data(
            [
                'attrName' => 'module',
            ]
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3rd-party registration hook — this is how Divi 5 knows about your module.
// Do NOT use 'init' for this; hook directly onto the dependency tree action.
// ─────────────────────────────────────────────────────────────────────────────
add_action(
    'divi_module_library_modules_dependency_tree',
    function ( $dependency_tree ) {
        $dependency_tree->add_dependency( new MyVendorMyModule() );
    }
);
```

---

## Reading attribute values

```php
// Simple text value
$title = $attrs['title']['innerContent']['desktop']['value'] ?? '';

// Nested object (custom attribute with sub-keys)
$posts_number = (int) ( $attrs['recentPosts']['innerContent']['desktop']['value']['postsNumber'] ?? 5 );

// Toggle (stored as "on" / "off" string)
$is_on = 'on' === ( $attrs['myAttr']['advanced']['myToggle']['desktop']['value'] ?? 'off' );

// Responsive — fall back to desktop if tablet/phone not set
$desktop_val = $attrs['title']['innerContent']['desktop']['value'] ?? '';
$tablet_val  = $attrs['title']['innerContent']['tablet']['value']  ?? $desktop_val;
$phone_val   = $attrs['title']['innerContent']['phone']['value']   ?? $tablet_val;
```

---

## Custom HTML output patterns

```php
// Single tag with escaped content
$heading = HTMLUtility::render([
    'tag'        => 'h2',
    'attributes' => [ 'class' => 'my-module-title' ],
    'children'   => esc_html( $title_text ),
]);

// Nested tags
$card = HTMLUtility::render([
    'tag'               => 'div',
    'attributes'        => [ 'class' => 'my-card' ],
    'childrenSanitizer' => 'et_core_esc_previously',
    'children'          => $heading . $body_html,
]);

// Link with conditional target
$link = HTMLUtility::render([
    'tag'        => 'a',
    'attributes' => [
        'href'   => esc_url( $url ),
        'target' => $open_new_tab ? '_blank' : null,  // null omits the attribute
    ],
    'children'   => esc_html( $link_text ),
]);
```

---

## Security rules

| Data type | Escape function |
|---|---|
| Plain text output | `esc_html()` |
| HTML attribute | `esc_attr()` |
| URL | `esc_url()` |
| Rich text (trusted) | `et_core_esc_previously` via `childrenSanitizer` |
| Rich text (untrusted) | `wp_kses_post()` |
| DB queries | `$wpdb->prepare()` |

Never call `echo` directly on `$attrs` values. Always route through `$elements->render()` for elements declared in `module.json`, or escape manually for custom HTML.
