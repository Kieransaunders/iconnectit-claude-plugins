# Baked Theatre.js state schema (DiviTheatre presets)

DiviTheatre ships **no `@theatre/studio`**, so it can't author keyframes at runtime. Instead each
preset carries a baked `state` fragment — the same JSON the studio would export — and
`engine.js::buildMergedState()` merges them into one object passed to `getProject(id, { state })`.
This is what lets `project.ready` resolve without studio.

This file is the schema reference for hand-authoring or editing that JSON. Source of truth for the
shape: a studio export (`*.theatre-project-state.json`) under
`theatre-main/packages/playground/...`; for `definitionVersion`, `packages/core/src/globals.ts`.

## Top-level shape

```jsonc
{
  "sheetsById": {
    "<sheetId>": { "sequence": { /* … */ } }
  },
  "definitionVersion": "0.4.0",   // MUST equal core's currentProjectStateDefinitionVersion
  "revisionHistory": []
}
```

- `sheetsById` is keyed by **sheetId** — this is the key `project.sheet('<sheetId>', instance)` must
  match. Per preset there's exactly one key (e.g. `'fade-up'`).
- `definitionVersion` is a hard gate. If it doesn't match the linked `@theatre/core` build, the
  state fails validation and the project won't load. Current value: **`'0.4.0'`**. Re-verify on any
  `@theatre/core` upgrade.
- `revisionHistory` can be an empty array for baked presets.

## The sequence

```jsonc
"sequence": {
  "subUnitsPerUnit": 30,            // timeline resolution (frames/sec equivalent); 30 is standard
  "length": 0.8,                    // timeline length in seconds
  "type": "PositionalSequence",
  "tracksByObject": {
    "<objectKey>": {                // matches sheet.object('<objectKey>', …) — 'el' in DiviTheatre
      "trackData": { /* one track per animated prop */ },
      "trackIdByPropPath": { /* prop path -> trackId */ }
    }
  }
}
```

## A track (one per animated prop)

```jsonc
"op01": {                                   // trackId — arbitrary short string, must be unique in object
  "type": "BasicKeyframedTrack",
  "__debugName": "el.[\"opacity\"]",        // human label; cosmetic
  "keyframes": [
    {
      "id": "op0",                          // unique within track
      "position": 0,                        // seconds
      "connectedRight": true,               // interpolate to the next keyframe
      "handles": [0.5, 1, 0.5, 0],          // bezier control handles (see below)
      "value": 0                            // the prop value at this position
    },
    {
      "id": "op1",
      "position": 0.8,
      "connectedRight": true,
      "handles": [0.5, 1, 0.5, 0],
      "value": 1
    }
  ]
}
```

And the prop-path → trackId map for the object:

```jsonc
"trackIdByPropPath": {
  "[\"opacity\"]": "op01",
  "[\"y\"]": "y01"
}
```

The prop path is the *bracketed* form of the prop name as used in `sheet.object`. A top-level prop
`opacity` → `["opacity"]`. A nested compound prop `position.x` → `["position","x"]`.

## Handles (easing)

`handles` is `[outX, outY, inX, inY]` — the bezier control points leaving the current keyframe and
entering the next. The values used across DiviTheatre presets:

- **`[0.5, 1, 0.5, 0]`** — ease-out (fast start, gentle settle). The default for entrance presets.
- `[0.5, 0, 0.5, 1]` — ease-in.
- `[0.42, 0, 0.58, 1]` — ease-in-out.
- `[0, 0, 1, 1]` — linear.

If you're unsure, copy the easing pattern from an existing preset rather than inventing handle
values — they're easy to get visibly wrong.

## Invariants checklist (get these right or it silently won't play)

1. **sheetId** key in `sheetsById` == the string passed to `project.sheet(sheetId, …)`.
2. **objectKey** in `tracksByObject` == the key passed to `sheet.object(key, …)` (`'el'`).
3. Every animated prop has **both** a `trackData` entry **and** a `trackIdByPropPath` entry pointing
   to the same trackId.
4. Prop paths in `trackIdByPropPath` are the bracketed form of the prop names declared in
   `sheet.object`.
5. `keyframes` are ordered by `position`; first at `0`, last at `sequence.length`.
6. `definitionVersion` matches the core build (`'0.4.0'`).
7. Animate only props you then write into `transform` / `opacity` / `filter` in `onValuesChange`.

## Authoring options

- **Hand-write** small presets (1–2 props, 2 keyframes each) directly from the skeleton above —
  fastest for simple fades/slides.
- **Generate with studio offline**: run `@theatre/studio` in a throwaway dev page, author visually,
  export the JSON, then paste the fragment into the preset and strip it back to the keys above. Use
  this for complex multi-prop / multi-keyframe sequences. Studio still never ships in the plugin
  bundle.
