# @theatre/core 0.7.0 — API reference (DiviTheatre-relevant surface)

Verified against the bundled monorepo source (`theatre-main/packages/core/src`). Only the parts
DiviTheatre actually uses on the frontend. Studio-only and React-only APIs are omitted.

## Contents
- [Top-level exports](#top-level-exports)
- [getProject](#getproject)
- [project.sheet](#projectsheet)
- [sheet.object](#sheetobject)
- [Prop types (core.types)](#prop-types-coretypes)
- [sheet.sequence](#sheetsequence)
- [onValuesChange](#onvalueschange)
- [createRafDriver](#createrafdriver)
- [onChange / val](#onchange--val)
- [Stability notes](#stability-notes)

## Top-level exports

From `coreExports.ts`, the public surface is: `getProject`, `onChange`, `val`, `types`,
`createRafDriver`, `notify`. On the DiviTheatre frontend these are reached via
`window.DiviTheatreCore.*` (the IIFE global), e.g. `window.DiviTheatreCore.getProject(...)`,
`window.DiviTheatreCore.types.number(...)`.

## getProject

```ts
getProject(id: string, config?: { state?: ProjectState }): IProject
```

- Returns the project for `id`, creating it if needed. **Idempotent per id**, but calling it twice
  with *different* config objects throws in dev (`deepEqual` check). Call once per id, or with
  identical config.
- `config.state` is the **baked JSON** (see `baked-state-schema.md`). Passing it makes
  `project.ready` resolve on the next microtask. **Omitting it** means the project waits for a
  studio to supply state; with no studio (production frontend) `project.ready` never resolves and
  throws after ~1s.
- `project.ready` is a `Promise<void>`. Always `await` it before `sheet.sequence.play()` — playing
  early throws "Sequence can't be played … before the project has finished loading."

```js
const project = core.getProject('DiviTheatre', { state: mergedState })
await project.ready
```

## project.sheet

```ts
project.sheet(sheetId: string, instanceId?: string): ISheet
```

- `sheetId` selects the baked sequence — **it must match a key under `state.sheetsById`** or the
  sheet has an empty timeline (silent no-op).
- `instanceId` (optional) creates an independent *instance* of the same sheet. This is how
  DiviTheatre gives every element its own playhead while sharing one baked definition:
  `project.sheet('fade-up', String(elementId))`.
- Each sheet has exactly **one** `sequence`.

## sheet.object

```ts
sheet.object(key: string, props: object, opts?: { reconfigure?: boolean }): ISheetObject
```

- `key` must match the object key in the baked state (`'el'` in DiviTheatre presets) and the
  `tracksByObject` key.
- `props` is a map of prop name → prop type (or a plain default value as shorthand). Prop names must
  match `trackIdByPropPath` in the baked state (`'["opacity"]'`, `'["y"]'`).
- Returns an object whose `.props` is a pointer tree, `.value` is the current values, and
  `.onValuesChange(cb)` subscribes to per-frame changes.
- Calling `sheet.object()` twice with the same key throws unless `opts.reconfigure: true`.

## Prop types (core.types)

All constructors are on `core.types` (the `types` export). Signatures from `propTypes/index.ts`:

| Constructor | Signature | Notes |
|---|---|---|
| `number` | `number(default, { range?, nudgeFn?, nudgeMultiplier?, label? })` | `range: [min,max]` only clamps editor nudging — **does not clamp animated/keyframe values**. |
| `compound` | `compound({ ...props }, { label? })` | A JS-object prop. Nestable. Shorthand: pass a plain object to `sheet.object`. |
| `boolean` | `boolean(default, { label? })` | |
| `string` | `string(default, { label? })` | |
| `stringLiteral` | `stringLiteral(default, { [value]: Label }, { as?: 'menu'\|'switch', label? })` | Enum-style. |
| `rgba` | `rgba({ r,g,b,a }, { label? })` | Channels 0–1; `a` 0–1. |
| `image` | `image(defaultId, { label? })` | Asset prop. |
| `file` | `file(defaultId, { label? })` | Asset prop. |

DiviTheatre presets almost always use `number` (for `opacity`, `x`, `y`, `scale`, `rotate`, blur
amount, etc.) and write them into `transform` / `opacity` / `filter`.

```js
const obj = sheet.object('el', {
  opacity: core.types.number(0, { range: [0, 1] }),
  scale:   core.types.number(0.8, { range: [0, 4] }),
  blur:    core.types.number(8,   { range: [0, 40] }),
})
```

## sheet.sequence

```ts
sequence.play(conf?: {
  iterationCount?: number          // default 1
  range?: [number, number]         // sub-range of the timeline, in seconds
  rate?: number                    // playback speed multiplier
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternateReverse'
  rafDriver?: IRafDriver           // tick source (default: core raf)
}): Promise<boolean>               // resolves true if finished, false if interrupted

sequence.pause(): void
sequence.position: number          // getter+setter — seconds along the timeline; set to scrub
sequence.pointer                   // pointer to { playing, position, length }
sequence.attachAudio(args): Promise // audio-synced playback (not used by DiviTheatre presets)
```

- **Play once** (entrance presets): `sequence.play({ iterationCount: 1, range: [0, duration] })`.
- **Reset**: `sequence.position = 0` (this is what every preset's `reset()` does).
- **Scrub** (parallax / pin): set `sequence.position` each frame from scroll progress, driven by a
  custom rafDriver — do **not** call `play()`.
- `play()` returns a Promise you can await to chain steps.

## onValuesChange

```ts
obj.onValuesChange(cb: (values) => void, rafDriver?: IRafDriver): () => void
```

- Fires every frame the object's values change; `values` mirrors the `props` shape.
- This is where you mutate the DOM. Keep it cheap — it runs at frame rate.
- Returns an **unsubscribe** function. For self-managed/pin presets, store it and call it on
  teardown so listeners don't leak.
- Pass a `rafDriver` as the 2nd arg to throttle/redirect when this callback runs (e.g. a custom
  scene driver for scroll-scrub). Without it, the core raf driver is used.

```js
const unsub = obj.onValuesChange((v) => {
  el.style.opacity   = String(v.opacity)
  el.style.transform = `translateY(${v.y}px) scale(${v.scale})`
}, sceneDriver)
```

## createRafDriver

```ts
createRafDriver(conf?: { name?: string }): IRafDriver  // has .tick(time:number)
```

Custom tick source. Use it to (a) keep Theatre in sync with another animation lib, or (b) manually
control ticking for scroll-scrub, recording, or tests.

```js
const driver = core.createRafDriver({ name: 'dt-scene' })
// drive it yourself — e.g. inside your own IO-gated rAF loop:
function frame(t) { driver.tick(t); rafId = requestAnimationFrame(frame) }
```

Pass the driver to both `onValuesChange(cb, driver)` and `sequence.play({ rafDriver: driver })` (or
just set `sequence.position` under your own loop) so the whole scene ticks from one source. Drivers
can expose `start`/`stop`; Theatre calls them when it has/has-no scheduled work. **Remember the
hidden-tab pause**: a raf-based driver suspends on backgrounded tabs by design.

## onChange / val

```ts
onChange(pointer, cb, rafDriver?): () => void   // subscribe to a single pointer
val(pointer): T                                  // read a pointer's current value once
```

Lower-level than `onValuesChange`. `onChange(obj.props.position.x, cb)` watches one prop; `val(...)`
reads it synchronously. DiviTheatre rarely needs these — `onValuesChange` covers the per-object
case — but they're useful for one-off reads or watching a single derived value.

## Stability notes

- **Stable / safe to rely on**: `getProject`, `project.sheet`, `sheet.object`, `sheet.sequence`,
  `sequence.play/pause/position`, `obj.onValuesChange`, `types.*`, `createRafDriver`, `onChange`,
  `val`.
- **Avoid**: anything prefixed `__experimental_` (e.g. `sequence.__experimental_getKeyframes`) and
  any `@theatre/studio` import on the frontend.
