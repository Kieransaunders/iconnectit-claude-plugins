# JSX Visual Builder Component Reference

Complete annotated `visual-builder/src/index.jsx` template.

```jsx
// ─── External library dependencies ───────────────────────────────────────────
import React from 'react';

// ─── WordPress hooks (available globally via Divi's vendor bundle) ────────────
const { addAction } = window?.vendor?.wp?.hooks;

// ─── Divi field library ───────────────────────────────────────────────────────
// These components render the input controls inside the settings panel.
const {
  TextContainer,         // Plain text field
  RichTextContainer,     // Rich text / HTML editor
  RangeContainer,        // Numeric range slider
  SelectContainer,       // Dropdown select
  ToggleContainer,       // On/Off toggle
  ColorPickerContainer,  // Colour picker
  UploadContainer,       // Image/file upload
} = window?.divi?.fieldLibrary;

// ─── Divi module API ──────────────────────────────────────────────────────────
const {
  // Layout renderers
  ModuleContainer,       // Wraps the module in the builder canvas
  StyleContainer,        // Outputs the computed style tag
  elementClassnames,     // Generates standard wrapper classnames

  // Settings panel organisers
  GroupContainer,        // Collapsible group in the settings panel
  FieldContainer,        // Single field row (label + input)
  AdminLabelGroup,       // Standard "Admin Label" group
  BackgroundGroup,       // Standard "Background" group

  // Design panel groups (use these instead of building from scratch)
  AnimationGroup,
  BorderGroup,
  BoxShadowGroup,
  FiltersGroup,
  FontGroup,             // Heading font settings
  FontBodyGroup,         // Body font settings
  SizingGroup,
  SpacingGroup,
  TransformGroup,

  // Advanced panel groups
  PositionSettingsGroup,
  ScrollSettingsGroup,
  TransitionGroup,
  VisibilitySettingsGroup,
} = window?.divi?.module;

const { registerModule } = window?.divi?.moduleLibrary;

// For server-side data fetching in the Visual Builder
const { useFetch } = window?.divi?.rest;

// Module metadata — same file that PHP points to.
import metadata from './module.json';


// ─── ModuleStyles ─────────────────────────────────────────────────────────────
// Renders the <StyleContainer> that outputs computed CSS for all attributes.
// Mirror every attribute you declare in module.json with an elements.style() call.
const ModuleStyles = ({
  attrs,
  elements,
  settings,
  orderClass,
  mode,
  state,
  noStyleTag,
}) => (
  <StyleContainer mode={mode} state={state} noStyleTag={noStyleTag}>
    {/* Always include 'module' with disabledOn */}
    {elements.style({
      attrName: 'module',
      styleProps: {
        disabledOn: {
          disabledModuleVisibility: settings?.disabledModuleVisibility,
        },
      },
    })}
    {/* One call per attribute that has decoration settings */}
    {elements.style({ attrName: 'title' })}
    {elements.style({ attrName: 'content' })}
  </StyleContainer>
);


// ─── ModuleScriptData ─────────────────────────────────────────────────────────
// Registers any JS behaviour data (hover, sticky states, etc.)
const ModuleScriptData = ({ elements }) => (
  <React.Fragment>
    {elements.scriptData({ attrName: 'module' })}
  </React.Fragment>
);


// ─── moduleClassnames ─────────────────────────────────────────────────────────
// Adds CSS classes to the outermost module wrapper.
const moduleClassnames = ({ classnamesInstance, attrs }) => {
  // Standard decoration classes (always include)
  classnamesInstance.add(
    elementClassnames({ attrs: attrs?.module?.decoration ?? {} })
  );

  // Example: conditional class based on attribute value
  // const isLarge = 'on' === (attrs?.module?.advanced?.largeLayout?.desktop?.value ?? 'off');
  // classnamesInstance.add('my-module--large', isLarge);
};


// ─── Module definition ────────────────────────────────────────────────────────
const myModule = {
  // Metadata from module.json is the bridge between PHP and JS
  metadata,

  renderers: {
    /**
     * edit — renders the module in the Visual Builder canvas.
     * Must mirror exactly what render_callback() outputs in PHP.
     */
    edit: ({ attrs, id, name, elements }) => (
      <ModuleContainer
        attrs={attrs}
        elements={elements}
        id={id}
        moduleClassName="my_vendor_my_module"   // must match module.json moduleClassName
        name={name}
        scriptDataComponent={ModuleScriptData}
        stylesComponent={ModuleStyles}
        classnamesFunction={moduleClassnames}
      >
        {/* Style components inject computed inline styles for decoration */}
        {elements.styleComponents({ attrName: 'module' })}

        {/* Inner wrapper matches PHP's et_pb_module_inner div */}
        <div className="et_pb_module_inner">
          {elements.render({ attrName: 'title' })}
          {elements.render({ attrName: 'content' })}
        </div>
      </ModuleContainer>
    ),
  },

  /**
   * settings — controls the three panels in the module settings modal.
   * If omitted, Divi uses "auto" mode and generates panels from module.json.
   * Provide this when you want custom grouping or explicit field control.
   */
  settings: {
    // Content tab
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

    // Design tab
    design: () => (
      <React.Fragment>
        <FontGroup attrName="title.decoration.font" groupLabel="Title Font" />
        <FontBodyGroup attrName="content.decoration.bodyFont" groupLabel="Content Font" />
        <SizingGroup />
        <SpacingGroup />
        <BorderGroup />
        <BoxShadowGroup />
        <FiltersGroup />
        <TransformGroup />
        <AnimationGroup />
      </React.Fragment>
    ),

    // Advanced tab
    advanced: () => (
      <React.Fragment>
        <VisibilitySettingsGroup />
        <TransitionGroup />
        <PositionSettingsGroup />
        <ScrollSettingsGroup />
      </React.Fragment>
    ),
  },

  /**
   * placeholderContent — pre-fills attribute values when the module is
   * first dragged onto the canvas, so users see something meaningful immediately.
   */
  placeholderContent: {
    module: {
      decoration: {
        background: {
          desktop: { value: { color: '#f5f5f5' } },
        },
      },
    },
    title: {
      innerContent: { desktop: { value: 'Module Title' } },
    },
    content: {
      innerContent: { desktop: { value: 'Add your content here.' } },
    },
  },
};


// ─── Register the module ──────────────────────────────────────────────────────
// This must fire after the Divi module library store is ready.
// 'd5Tut.myModule' is your unique namespace — use your vendor prefix.
addAction(
  'divi.moduleLibrary.registerModuleLibraryStore.after',
  'myVendor.myModule',
  () => {
    registerModule(myModule.metadata, myModule);
  }
);
```

---

## Dynamic data with useFetch

Use this when the Visual Builder needs to display data from a REST endpoint
(e.g. recent posts, CPT items, API results).

```jsx
import React, { useEffect, useRef } from 'react';
const { useFetch } = window?.divi?.rest;

// Inside the edit component:
const MyModuleEdit = ({ attrs, id, name, elements }) => {
  const { fetch, response, isLoading } = useFetch([]);
  const abortRef = useRef();

  const postsNumber = attrs?.options?.innerContent?.desktop?.value?.postsNumber ?? 5;

  useEffect(() => {
    // Abort any in-flight fetch when the dep changes
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    fetch({
      method: 'GET',
      restRoute: `/wp/v2/posts?context=view&per_page=${postsNumber}`,
      signal: abortRef.current.signal,
    }).catch(console.error);

    return () => abortRef.current?.abort();
  }, [postsNumber]);

  return (
    <ModuleContainer /* ... */>
      {isLoading
        ? <p>Loading…</p>
        : <ul>
            {response.map(post => (
              <li key={post.id}>
                <a href={post.link}>{post.title.rendered}</a>
              </li>
            ))}
          </ul>
      }
    </ModuleContainer>
  );
};
```

---

## Available global namespaces

| Namespace | Contents |
|---|---|
| `window.divi.module` | ModuleContainer, StyleContainer, elementClassnames, all Group* and FieldContainer |
| `window.divi.fieldLibrary` | TextContainer, RichTextContainer, RangeContainer, SelectContainer, ToggleContainer, ColorPickerContainer, UploadContainer |
| `window.divi.moduleLibrary` | registerModule |
| `window.divi.rest` | useFetch |
| `window.vendor.wp.hooks` | addAction, addFilter, removeAction, applyFilters |

---

## Reading attrs in JSX

```jsx
// Simple value
const titleText = attrs?.title?.innerContent?.desktop?.value ?? '';

// Nested sub-value
const postsNum = attrs?.options?.innerContent?.desktop?.value?.postsNumber ?? 5;

// Toggle
const isEnabled = 'on' === (attrs?.module?.advanced?.myToggle?.desktop?.value ?? 'off');

// Responsive (fall back up the chain)
const desktopVal = attrs?.title?.innerContent?.desktop?.value ?? '';
const tabletVal  = attrs?.title?.innerContent?.tablet?.value  ?? desktopVal;
```
