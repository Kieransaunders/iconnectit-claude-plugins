# Authoring a new DiviTheatre preset

A preset is a single file in `src/presets/<name>.js` that self-registers on import. To ship it you
also add one side-effect import line to `src/engine.js`. That's the whole surface.

## The factory contract

`registerPreset({ name, category, factory, state, jumpToEnd, honoursDuration })`:

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Matches the `data-theatre` value. Must be globally unique (duplicate throws). |
| `factory` | yes | `(element, config, project) => { play, reset }` **or** `{ selfManaged: true }`. |
| `state` | for clock presets | Baked keyframe JSON (see `baked-state-schema.md`). Merged into the project state. |
| `jumpToEnd` | strongly recommended | `(element) => void` — applies the final visible state for mobile / reduced-motion skips. |
| `category` | no (default `'element'`) | `'element'` \| `'scene'` \| `'pin'`. Drives engine dispatch. |
| `honoursDuration` | no (default `true`) | `false` = ignore `data-theatre-duration` (scroll-bound presets). |

`config` passed to the factory carries: `_id` (unique element id — use as the sheet instance id),
`duration` (seconds; already defaulted/converted from `data-theatre-duration`), `delay`, `trigger`,
and for pin/scene presets `_activeObservers` / `_activePinDrivers` teardown registries.

## Two factory return shapes

- **`{ play, reset }`** — engine-driven (entrance animations on onScroll / onLoad / onClick). The
  engine calls `play()` on the trigger and `reset()`+`play()` to re-fire. This is the common case.
- **`{ selfManaged: true }`** — the factory binds its own listeners (scroll scrub, hover, pin
  scenes) and the engine steps back. Used when timing comes from scroll position or pointer events
  rather than a one-shot clock. Register teardown into `config._activeObservers` /
  `config._activePinDrivers` so `pagehide` cleans up.

## Skeleton — a standard entrance preset

This mirrors `src/presets/fade-up.js`. Copy it, rename, change the two prop tracks and the
`onValuesChange` writes.

```js
// src/presets/fade-scale.js
import { registerPreset } from '../preset-registry.js'

// Baked keyframes: opacity 0->1 and scale 0.85->1 over 0.8s, ease-out handles.
const FADE_SCALE_STATE = {
  sheetsById: {
    'fade-scale': {                         // == the sheetId used in factory; == data-theatre value
      sequence: {
        subUnitsPerUnit: 30,
        length: 0.8,
        type: 'PositionalSequence',
        tracksByObject: {
          el: {                             // == sheet.object('el', …)
            trackData: {
              op01: {
                type: 'BasicKeyframedTrack',
                __debugName: 'el.["opacity"]',
                keyframes: [
                  { id: 'op0', position: 0,   connectedRight: true, handles: [0.5, 1, 0.5, 0], value: 0 },
                  { id: 'op1', position: 0.8, connectedRight: true, handles: [0.5, 1, 0.5, 0], value: 1 },
                ],
              },
              sc01: {
                type: 'BasicKeyframedTrack',
                __debugName: 'el.["scale"]',
                keyframes: [
                  { id: 'sc0', position: 0,   connectedRight: true, handles: [0.5, 1, 0.5, 0], value: 0.85 },
                  { id: 'sc1', position: 0.8, connectedRight: true, handles: [0.5, 1, 0.5, 0], value: 1 },
                ],
              },
            },
            trackIdByPropPath: {
              '["opacity"]': 'op01',
              '["scale"]': 'sc01',
            },
          },
        },
      },
    },
  },
  definitionVersion: '0.4.0',               // MUST match core build
  revisionHistory: [],
}

registerPreset({
  name: 'fade-scale',
  category: 'element',

  factory: function fadeScaleFactory(element, config, project) {
    const core = window.DiviTheatreCore
    // sheetId 'fade-scale' (matches baked key); uniqueness via the instance id.
    const sheet = project.sheet('fade-scale', String(config._id))
    const obj = sheet.object('el', {
      opacity: core.types.number(0,    { range: [0, 1] }),
      scale:   core.types.number(0.85, { range: [0, 4] }),
    })

    // Per-frame DOM write — only transform/opacity/filter (keeps Divi clamp() sizing intact).
    obj.onValuesChange(function (v) {
      element.style.opacity   = String(v.opacity)
      element.style.transform = 'scale(' + v.scale + ')'
    })

    return {
      play: function () {
        return sheet.sequence.play({ iterationCount: 1, range: [0, config.duration] })
      },
      reset: function () {
        sheet.sequence.position = 0
      },
    }
  },

  state: FADE_SCALE_STATE,

  // Never leave the element hidden — land the final visible state.
  jumpToEnd: function (element) {
    element.style.opacity   = '1'
    element.style.transform = 'scale(1)'
  },
})
```

Then register it for shipping by adding one line to `src/engine.js`:

```js
import './presets/fade-scale.js'   // alongside the other preset imports
```

## Scroll-scrub / pin presets (self-managed)

When timing comes from scroll rather than a clock:

1. Set `category: 'scene'` or `'pin'` and `honoursDuration: false`.
2. In the factory, create a `core.createRafDriver({ name })` and bind
   `obj.onValuesChange(fn, sceneDriver)` to it.
3. Drive `sheet.sequence.position` from scroll progress (0 → length), or tick the driver inside an
   IntersectionObserver-gated rAF loop so it only runs while on screen.
4. Push the IO into `config._activeObservers` and the rAF stop-fn into `config._activePinDrivers`
   so `pagehide` tears them down.
5. Return `{ selfManaged: true }`.

See `src/presets/parallax-scroll.js` (scrub) and `src/presets/product-reveal.js` + `src/pin-scene.js`
(pin) for the worked implementations.

## Pre-ship checklist

- [ ] `name`, baked `sheetsById` key, and the `project.sheet(...)` first arg are **all identical**.
- [ ] `sheet.object('el', …)` key matches `tracksByObject.el` and every prop has a track + a
      `trackIdByPropPath` entry.
- [ ] `onValuesChange` writes **only** `transform` / `opacity` / `filter`.
- [ ] `jumpToEnd` lands the **same final state** the animation ends on (test it at <768px and with
      reduced-motion).
- [ ] `definitionVersion` is `'0.4.0'` (or the current core value).
- [ ] Side-effect import added to `src/engine.js`.
- [ ] Self-managed presets register teardown and disconnect on `pagehide`.
