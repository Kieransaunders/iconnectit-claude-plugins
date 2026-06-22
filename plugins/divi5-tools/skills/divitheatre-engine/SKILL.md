---
name: divitheatre-engine
description: "Theatre.js (@theatre/core 0.7.0) reference for building and debugging the DiviTheatre WordPress plugin's animation engine and motion presets. MOTION layer only."
when_to_use: "Work touching DiviTheatre's motion layer: presets in src/presets/, src/engine.js or src/preset-registry.js, baking Theatre.js sequence/keyframe state as JSON, or wiring getProject, sheet.object, sequence.play, onValuesChange, createRafDriver, scroll-pinned scenes. Also silent-failure symptoms: animation never plays, project.ready hangs, element stuck at opacity 0, definitionVersion/baked-state mismatch. Triggers: Theatre.js, @theatre/core, getProject, sheet.object, sequence, onValuesChange, rafDriver, baked state, data-theatre, DiviTheatre preset. Not for module scaffolding, page JSON, design audits, or @theatre/r3f."
---

# DiviTheatre engine — building with @theatre/core

DiviTheatre attaches premium, multi-step animations to any Divi 5 element via a `data-theatre`
attribute. Under the hood it drives **`@theatre/core` 0.7.0** — the headless animation runtime —
with **no `@theatre/studio` on the frontend** (studio is the 3MB+ visual editor; it never ships).

Your job when this skill is active is to get the Theatre.js usage *right* the first time. The
core library is small but has a few contracts that fail silently — the animation simply never
plays, or `project.ready` hangs, or the element ends up stuck hidden. Most of this skill is about
those contracts and *why* they exist, so you can reason past the rote rules when something new
comes up.

For the WordPress plugin scaffolding, module.json, render callbacks, and the Visual Builder panel,
defer to **`divi-5-module-development`** / **`divi-plugin-dev`**. This skill is the motion layer.

## How DiviTheatre uses Theatre.js (the mental model)

Theatre.js models animation as a tree: a **project** holds **sheets**, a sheet holds animatable
**objects** (sets of typed props) and one **sequence** (the timeline). You play the sequence and
read prop values back per frame to mutate the DOM.

DiviTheatre maps that onto a no-code plugin like this:

- **One shared project**, `getProject('DiviTheatre', { state: mergedState })`, created once on
  `DOMContentLoaded`. The `state` is *baked* JSON keyframes (see below) so the project is ready
  without studio.
- **One sheet per preset name** (`'fade-up'`), **one instance per element** — uniqueness comes
  from the sheet's *second* argument (`project.sheet('fade-up', String(elementId))`), **not** from
  a unique sheetId. The sheetId must match the baked-state key or there's no animation.
- Each preset is a **factory** registered in `src/preset-registry.js`. The engine
  (`src/engine.js`) reads `data-theatre`, resolves the record, builds the factory, and drives it
  via the chosen trigger (onScroll / onLoad / onClick), honouring mobile and reduced-motion guards.

Read `references/preset-authoring.md` before writing a new preset — it has the full recipe and a
copy-paste skeleton. Read `references/core-api.md` for the exact 0.7.0 API surface. Read
`references/baked-state-schema.md` when you need to hand-author or edit keyframe JSON.

## The contracts that fail silently

These are the things that don't throw a useful error — they just don't animate. Internalise the
*reason* for each so you catch violations by eye.

**1. Baked state is mandatory — `project.ready` hangs without it.**
`getProject(id, { state })` resolves `project.ready` on the next tick. Call `getProject(id)` with
*no* state and, in production with no studio attached, `project.ready` never resolves (it waits
~1s then throws). DiviTheatre merges every preset's baked `state` fragment in
`engine.js::buildMergedState()`. Always `await project.ready` before playing.

**2. The sheetId must equal the baked-state key.** Sequence state is keyed by *sheetId* under
`sheetsById`. `project.sheet('fade-up-7', ...)` has no baked sequence → the timeline is empty →
nothing moves, no error. Keep the sheetId equal to the preset's state key (`'fade-up'`) and pass
the element id as the **instance** argument: `project.sheet('fade-up', String(config._id))`.

**3. `definitionVersion` must match the core build.** Baked state carries
`definitionVersion: '0.4.0'`. This must equal `globals.currentProjectStateDefinitionVersion` in the
linked `@theatre/core`. A mismatch makes the state fail validation. If you bump `@theatre/core`,
re-verify this value in `packages/core/src/globals.ts` and update every preset + `buildMergedState`.

**4. Only animate `transform`, `opacity`, and `filter`.** Divi 5 sizes elements with fluid
`clamp()` CSS variables. If a preset writes `width`/`height`/`font-size`/`margin` it overrides those
variables and breaks responsive sizing. Keep presets on compositor-friendly props — they're also
the only ones that animate at 60fps without layout thrash.

**5. Never leave an element hidden.** Presets typically start at `opacity: 0`. Every guard path
(mobile, reduced-motion, unknown preset) must land the element on its *final* visible state, never
its start state. That's what each preset's `jumpToEnd(element)` is for (D-02).

**6. A paused/hidden tab pauses the raf driver — that is not a bug.** Theatre's default raf driver
is gated by `requestAnimationFrame`, which the browser suspends on a backgrounded tab. "The preset
never plays" in a headless/hidden context is almost always this, not a logic error. Verify playback
in a *visible* viewport, or drive a custom `createRafDriver()` and tick it manually (the pattern the
pin/scroll-scrub presets use). See `references/core-api.md` → rafDrivers.

## Core API quick reference

Everything is imported from `@theatre/core` (exposed on the frontend as `window.DiviTheatreCore`
via the IIFE bundle — see Build below). Full detail in `references/core-api.md`.

```js
const core = window.DiviTheatreCore

// 1. Project — created once, with baked state.
const project = core.getProject('DiviTheatre', { state: mergedState })
await project.ready                       // resolves next tick BECAUSE state was passed

// 2. Sheet — id matches baked key, instance id makes it unique per element.
const sheet = project.sheet('fade-up', String(elementId))

// 3. Object — typed, animatable props. Keys must match the baked trackIdByPropPath.
const obj = sheet.object('el', {
  opacity: core.types.number(0, { range: [0, 1] }),
  y:       core.types.number(50, { range: [-500, 500] }),
})

// 4. Per-frame DOM write. Pass a rafDriver as 2nd arg for scroll-scrub presets.
obj.onValuesChange((v) => {
  element.style.opacity   = String(v.opacity)
  element.style.transform = `translateY(${v.y}px)`
})

// 5. Drive the timeline.
sheet.sequence.play({ iterationCount: 1, range: [0, duration] }) // returns a Promise
sheet.sequence.position = 0                                       // scrub / reset
sheet.sequence.pause()
```

Prop type constructors live on `core.types`: `number(default, {range,label})`, `compound({...})`,
`boolean`, `string`, `stringLiteral`, `rgba`, `image`, `file`. `range` on `number` only *clamps the
editor nudge* — it does **not** clamp animated values, so keyframe values can exceed it.

## The preset factory contract

Every preset registers via `registerPreset({ name, category, factory, state, jumpToEnd, honoursDuration })`
and its `factory(element, config, project)` returns one of:

- `{ play, reset }` — engine-driven presets. `play()` runs the sequence; `reset()` sets
  `sheet.sequence.position = 0`. The engine calls these on the resolved trigger. Re-fire =
  `reset()` then `play()`.
- `{ selfManaged: true }` — the factory binds its own listeners (parallax-scroll, hover-grow, and
  all `pin` scenes). The engine builds it and steps back; it never calls `.play()`.

`category` is `'element'` (default), `'scene'`, or `'pin'`. `honoursDuration: false` tells the
engine to ignore `data-theatre-duration` (scroll-bound presets derive timing from scroll, not a
clock). Full authoring recipe + skeleton: `references/preset-authoring.md`.

## Build (esbuild → IIFE, not UMD)

`@theatre/core` is bundled with **esbuild**, `format: 'iife'`, `globalName: 'DiviTheatreCore'`,
into a single `theatre.min.js`. IIFE (not UMD) is deliberate: UMD's AMD branch collides with
RequireJS-using WP plugins. The bundle entry is just `export * from '@theatre/core'` — esbuild's
`globalName` performs the global assignment, so **do not** also write
`window.DiviTheatreCore = core` (it runs after the module body and clobbers the real exports).

Importing `@theatre/core` also sets `window.__TheatreJS_CoreBundle` — that's the flag the engine's
dual-bundle guard checks (not `window.DiviTheatreCore`). Never `npm install` inside `theatre-main/`;
it's a Yarn-workspaces monorepo. `@theatre/studio` is dev-only and must never enter the frontend
bundle.

## Debugging checklist

When an animation misbehaves, walk these in order — they map to the silent-failure contracts:

1. **Nothing plays at all** → sheetId ≠ baked key (#2), or `project.ready` not awaited / no state
   (#1), or running inside the Visual Builder (engine bails on `?et_fb=1` by design).
2. **`project.ready` hangs ~1s then errors** → no baked `state` passed to `getProject` (#1).
3. **State rejected / validation error** → `definitionVersion` mismatch with the core build (#3).
4. **Element stuck hidden after load** → a guard path skipped without calling `jumpToEnd` (#5).
5. **Plays in browser, "never plays" headless** → hidden-tab raf pause (#6), not a bug.
6. **Responsive sizing breaks when preset active** → preset writing non-transform/opacity/filter
   props over Divi's clamp() variables (#4).

## Verify your work

Theatre.js animations are visual and time-based, so a green "it ran" is not proof. Before calling a
preset done: confirm the element reaches its **final visible state** (never stuck at the start
state), confirm `jumpToEnd` lands the same final state, and exercise mobile (<768px) +
`prefers-reduced-motion` so both guard paths are covered. For scroll/pin presets, confirm the raf
driver tears down on `pagehide` (no leaked observers/loops). The repo's headless smoke tests and
`demo.html` harness are the reference checks.
