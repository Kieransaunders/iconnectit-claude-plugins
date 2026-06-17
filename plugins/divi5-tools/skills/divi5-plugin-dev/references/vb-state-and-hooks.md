# Visual Builder State: Hooks & Data Stores

For modules that need to **read or write builder state** beyond their own attributes —
reacting to the current breakpoint, reading global colours, updating an attribute
programmatically, or knowing which module is selected. The VB is a single-page React
app over a Redux-style store, exposed through these hooks.

Official doc: https://dev.elegantthemes.com/docs/code-snippets/hook-functions/

For a custom module's own content/design fields, prefer the declarative `module.json`
settings and `elements.render()` (see SKILL.md). Reach for these stores only for
genuinely interactive/stateful behaviour.

---

## Core hooks

| Hook | Signature | Returns |
|---|---|---|
| `useSelect` | `useSelect(mapSelect, deps)` | Selected store slice; re-renders on change |
| `useDispatch` | `useDispatch(storeName)` | Action dispatchers for that store |
| `useContext` | `useContext(moduleContext)` | Current module context (`moduleId`, `moduleName`) |

`moduleContext` is imported from `@divi/module` (in-browser: `window?.divi?.module`).
Always pass a dependency array to `useSelect` and wrap handlers in `useCallback` to
avoid redundant re-renders in the editor.

---

## Stores

| Store | Key selectors | Key dispatchers |
|---|---|---|
| `divi/edit-post` | `getModuleAttrs(id)`, `getModuleAttr(id, attr)`, `getChildModules(id)`, `getAncestorModules(id)` | `editModuleAttribute()`, `addModule()`, `removeModule()` |
| `divi/app-ui` | `getBreakpoint()`, `getAttributeState()` | `setView()`, `setAttributeState()`, `setElementProperty()` |
| `divi/global-data` | `getGlobalColors()`, `getGlobalVariables()` | `updateGlobalColor()`, `addGlobalVariable()`, `deleteGlobalColor()` |
| `divi/settings` | `getSetting([...])`, `checkRolePermission()`, `getEnabledBreakpointNames()` | (read-only) |
| `divi/events` | `getSelectedModules()`, `getHoveredModule()`, `getDraggedModules()` | (internal drag/select) |
| `divi/modal-library` | `isModalActive(name)`, `getModalOwner()` | `open()`, `close()` |
| `divi/page-settings` | `getSettings()` | `update()` |

---

## Read + write a module attribute

```jsx
const { useSelect, useDispatch } = window?.vendor?.wp?.data;
const { useContext, useCallback } = window?.vendor?.wp?.element ?? React;
const { moduleContext } = window?.divi?.module;

function MyField() {
  const { moduleId } = useContext(moduleContext);
  const { editModuleAttribute } = useDispatch('divi/edit-post');

  const currentValue = useSelect(
    (select) => select('divi/edit-post').getModuleAttr(moduleId, 'content'),
    [moduleId]
  );

  const handleChange = useCallback(
    (newValue) => {
      editModuleAttribute({ id: moduleId, attrName: 'content', value: newValue });
    },
    [moduleId, editModuleAttribute]
  );

  return <input value={currentValue || ''} onChange={(e) => handleChange(e.target.value)} />;
}
```

---

## Key rules

- **Focused selectors + dependency arrays.** Broad `useSelect` mappers re-render the
  component on every unrelated store change — query the narrowest slice you need.
- **`useCallback` your handlers** so child fields don't re-render needlessly.
- Treat `divi/settings` and `divi/events` as effectively read-only from a module.
- This is for interactive state only — static fields belong in `module.json`.
