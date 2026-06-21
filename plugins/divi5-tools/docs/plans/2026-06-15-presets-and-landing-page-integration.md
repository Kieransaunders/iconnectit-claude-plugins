# DiviTheatre Presets + Landing-Page Skill Integration Plan

> **✅ STATUS: COMPLETE (2026-06-17).** Both workstreams delivered and verified.
> - **Part A (DiviTheatre plugin):** trigger system + all 8 presets shipped (fade-up/left/right, scale-in, stagger, parallax-scroll, hover-grow, hero-reveal), plus extras (blur-in, product-reveal). Plugin at v1.1.0.
> - **Part B (landing-page skill):** `theatreAttrs()` helper, SKILL.md consent gate, divi-theatre.md catalogue, taste.md + layout-patterns.md + example-page.js updates. Validator passes 0 errors / 0 warnings; unit tests 2/2 pass.
>
> Retained for historical reference only — do not re-execute.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the DiviTheatre preset library (FR-014 through FR-028) and integrate DiviTheatre as an optional motion layer in the divi5-tools landing-page JSON generator, with a mandatory user-consent gate before emitting any `data-theatre` attributes.

**Architecture:** Two parallel workstreams. Workstream A extends the DiviTheatre plugin itself (preset factories, trigger system, tests). Workstream B extends the divi5-tools landing-page skill (builder helper for custom attributes, SKILL.md consent gate, reference docs). The two meet at a JSON attribute contract: the landing-page generator emits `module.advanced.attributes` with `data-theatre` keys, which Divi 5 renders as HTML data attributes on the module wrapper.

**Tech Stack:** Theatre.js 0.7.0 (`@theatre/core`), esbuild IIFE bundles, vanilla JS frontend, PHP 7.4+ enqueue, Divi 5 block system. Landing-page skill: Node.js builder library, JSON export format.

**DiviTheatre repo:** `/Users/boss/Local Sites/divi-5-airtable-plugin/app/public/wp-content/plugins/DiviTheatre`
**Landing-page skill repo:** `/Volumes/External/iConnectIT claude plugins/plugins/divi5-tools/skills/landing-page`

---

## Part A: DiviTheatre Plugin (for the plugin developer)

> **Context:** Phase 1 (core engine + `fade-up` preset) is complete and working. This plan picks up at Phase 2: the remaining 7 presets and the full trigger system. Read `CLAUDE.md`, `MVP_discussion.md`, and `.swarm/spec.md` before starting. Follow the GSD workflow (`/gsd-execute-phase`) for code changes inside this repo.

### Reference: Preset factory contract

Every preset file lives at `src/presets/<name>.js`, self-registers via `registerPreset()`, and exports three things:

1. **Factory function** `(element, config, project) => { play, reset }` or `{ play, reset, selfManaged: true }`
2. **Baked Theatre.js state fragment** (keyframe data so `project.ready` resolves without `@theatre/studio`)
3. **jumpToEnd function** `(element) => void` (applies final visible state for reduced-motion / mobile skip)

See `src/presets/fade-up.js` for the canonical pattern. The sheet base name in the baked state MUST match the first arg to `project.sheet()`. Uniqueness comes from the instance ID (second arg), never the sheet name.

### Reference: Trigger system (FR-022 to FR-028)

Currently the engine only supports `onLoad` (plays immediately after `project.ready`). The trigger system needs to be added to `src/engine.js`:

- `onScroll` (default): IntersectionObserver at threshold 0.15, unobserve after first trigger
- `onLoad`: play on DOMContentLoaded after delay
- `onClick`: play on `e.target === el` click, fire once, unbind
- `data-theatre-delay="<ms>"`: delay all trigger paths (non-numeric/negative = 0)
- `data-theatre-duration="<ms>"`: override preset duration (ignored by `parallax-scroll` and `hero-reveal`)
- `data-theatre-mobile="true"`: override the <768px mobile skip
- IntersectionObserver fallback: if unavailable, `onScroll` plays immediately on load

Presets that manage their own triggers (`parallax-scroll` with rAF, `hover-grow` with mouse events) return `selfManaged: true` and handle their own listener binding inside the factory.

---

### Task A1: Add trigger system to engine.js

**Files:**
- Modify: `src/engine.js`

**Step 1: Refactor the element-processing loop**

Replace the immediate `preset.play()` call with a trigger resolver that reads `data-theatre-trigger`, `data-theatre-delay`, `data-theatre-duration`, and `data-theatre-mobile` from the element's dataset.

```javascript
function resolveTrigger(el, defaultTrigger) {
  var trigger = el.dataset.theatreTrigger || defaultTrigger || 'onScroll'
  var delay = parseInt(el.dataset.theatreDelay, 10)
  if (isNaN(delay) || delay < 0) delay = 0
  var duration = parseInt(el.dataset.theatreDuration, 10)
  if (isNaN(duration) || duration < 0) duration = null
  var mobileOverride = el.dataset.theatreMobile === 'true'
  return { trigger: trigger, delay: delay, duration: duration, mobileOverride: mobileOverride }
}
```

**Step 2: Implement onScroll with IntersectionObserver**

```javascript
function playOnScroll(el, preset, config) {
  if (!('IntersectionObserver' in window)) {
    playWithDelay(preset, config)
    return
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        io.unobserve(el)
        playWithDelay(preset, config)
      }
    })
  }, { threshold: 0.15 })
  io.observe(el)
}
```

**Step 3: Implement playWithDelay and onClick**

```javascript
function playWithDelay(preset, config) {
  if (config.delay > 0) {
    setTimeout(function () { preset.play() }, config.delay)
  } else {
    preset.play()
  }
}

function playOnClick(el, preset, config) {
  el.addEventListener('click', function handler(e) {
    if (e.target !== el) return
    el.removeEventListener('click', handler)
    playWithDelay(preset, config)
  })
}
```

**Step 4: Update the main element loop**

For `selfManaged` presets, call the factory and let it bind its own listeners. For standard presets, branch on trigger type. Honour `mobileOverride` in the <768px guard.

**Step 5: Build and smoke test**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/engine.js
git commit -m "feat: add trigger system (onScroll, onLoad, onClick, delay, duration, mobile override)"
```

---

### Task A2: fade-left preset (FR-015)

**Files:**
- Create: `src/presets/fade-left.js`
- Modify: `src/engine.js` (add side-effect import)

Copy `src/presets/fade-up.js` as `src/presets/fade-left.js`. Rename all references: `fade-up` to `fade-left`, translateY to translateX, y-axis keyframes (50 to 0) to x-axis keyframes (-50 to 0). The sheet name in the baked state MUST be `'fade-left'` and match `project.sheet('fade-left', ...)`. Add `import './presets/fade-left.js'` to `src/engine.js`.

---

### Task A3: fade-right preset (FR-016)

Same as A2 but translateX 50 to 0 (from the right). Sheet name `'fade-right'`.

---

### Task A4: scale-in preset (FR-017)

**Files:**
- Create: `src/presets/scale-in.js`

Scale 0.9 to 1 with opacity 0 to 1, two simultaneous flat tracks. The baked state needs three tracks: `op01` (opacity), `sc01` (scale). The `onValuesChange` handler writes both `opacity` and `transform: scale(...)`.

---

### Task A5: stagger preset (FR-018)

**Files:**
- Create: `src/presets/stagger.js`

Animate each direct child of the tagged element with `fade-up` motion, offset by 100ms in DOM order. This preset creates multiple sheet objects (one per child) and plays them with staggered delays. The factory should query `element.children` and create a sheet per child with incremental instance IDs.

The tagged element is the parent (e.g., a Divi Row). Each child module inside it gets its own fade-up sequence with `delay = index * 100ms`.

---

### Task A6: parallax-scroll preset (FR-019)

**Files:**
- Create: `src/presets/parallax-scroll.js`

This preset is `selfManaged: true`. It uses `requestAnimationFrame` + `IntersectionObserver` (NOT scroll listeners). As the element scrolls through the viewport, translate it on the Y axis based on scroll position.

```javascript
function parallaxScrollFactory(element, config, project) {
  var core = window.DiviTheatreCore
  var sheet = project.sheet('parallax-scroll', String(config._id))
  var obj = sheet.object('el', {
    y: core.types.number(0, { range: [-200, 200] }),
  })
  obj.onValuesChange(function (values) {
    element.style.transform = 'translateY(' + values.y + 'px)'
  })
  var rafId = null
  var ticking = false
  function updatePosition() {
    var rect = element.getBoundingClientRect()
    var viewportH = window.innerHeight
    var progress = (viewportH - rect.top) / (viewportH + rect.height)
    var clamped = Math.max(0, Math.min(1, progress))
    sheet.sequence.position = clamped * 0.8
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        if (!ticking) { ticking = true; loop() }
      } else {
        ticking = false
        if (rafId) cancelAnimationFrame(rafId)
      }
    })
  })
  io.observe(element)
  function loop() {
    if (!ticking) return
    updatePosition()
    rafId = requestAnimationFrame(loop)
  }
  return {
    play: function () {},
    reset: function () {
      ticking = false
      if (rafId) cancelAnimationFrame(rafId)
      sheet.sequence.position = 0
    },
    selfManaged: true,
  }
}
```

jumpToEnd for parallax = clear transform.

---

### Task A7: hover-grow preset (FR-020)

**Files:**
- Create: `src/presets/hover-grow.js`

`selfManaged: true`. On `mouseenter`, scale to 1.08. On `mouseleave`, reverse along the same curve. Uses Theatre.js sequence play forward/reverse.

---

### Task A8: hero-reveal preset (FR-021)

**Files:**
- Create: `src/presets/hero-reveal.js`

A choreographed 1.8s sequence on a section: background fade (0 to 0.4s), headline scale+translate (0.3 to 0.9s), subtext rise (0.7 to 1.2s), CTA fade (1.0 to 1.5s). The factory queries child modules inside the section by their adminLabel or DOM position and creates sheet objects for each.

Auto-detect by querying `.et_pb_module` children and matching heading/text/button module types.

---

### Task A9: Test all presets manually in Divi 5

Add Text modules with these attributes (via Advanced then Attributes):
- `data-theatre="fade-left" data-theatre-trigger="onScroll"`
- `data-theatre="scale-in" data-theatre-trigger="onLoad" data-theatre-delay="300"`
- `data-theatre="stagger"` on a Row with 3 child columns
- `data-theatre="parallax-scroll"` on an Image
- `data-theatre="hover-grow"` on a Button
- `data-theatre="hero-reveal"` on a Section with heading + text + button

Verify on desktop (scroll, hover, click), mobile (<768px all visible), and reduced-motion (all visible). Check Performance panel for zero scroll listeners on parallax.

---

### Task A10: Build manifest update + version bump

```bash
npm version minor
npm run build
git add -A
git commit -m "feat: complete preset library + trigger system"
```

---

## Part B: Landing-Page Skill Extension

> **Context:** This work happens in the divi5-tools repo. The goal is to make the JSON generator aware of DiviTheatre as an OPTIONAL motion layer. The user MUST be asked before any `data-theatre` attributes are emitted, or told to download/install DiviTheatre if they want motion.

### Task B1: Add theatreAttrs() helper to divi-builder.js

**Files:**
- Modify: `skills/landing-page/scripts/divi-builder.js`

Add a helper that injects custom data attributes into any module's `module.advanced.attributes` path. Add a `theatre` shortcut option to each module function.

---

### Task B2: Create references/divi-theatre.md

**Files:**
- Create: `skills/landing-page/references/divi-theatre.md`

Preset catalogue, trigger options, motion dial mapping, download/install instructions.

---

### Task B3: Update SKILL.md with DiviTheatre consent gate

**Files:**
- Modify: `skills/landing-page/SKILL.md`

Add a motion-layer question to Stage 1 with three paths: Yes / No but want it / No. Never emit `data-theatre` without consent.

---

### Task B4: Update taste.md motion section

**Files:**
- Modify: `skills/landing-page/references/taste.md`
- Modify: `skills/design-review/references/taste.md`

Add note about optional DiviTheatre integration under the MOTION dial.

---

### Task B5: Update layout-patterns.md limitations table

**Files:**
- Modify: `skills/landing-page/references/layout-patterns.md`

Show which limitations DiviTheatre solves.

---

### Task B6: Update example-page.js with commented DiviTheatre usage

**Files:**
- Modify: `skills/landing-page/examples/example-page.js`

---

### Task B7: Run validator and confirm clean

---

## Delivery Checklist

- [x] Part A: All 7 DiviTheatre presets implemented and tested
- [x] Part A: Trigger system (onScroll, onLoad, onClick, delay, duration, mobile) working
- [x] Part A: Reduced-motion and mobile guards verified on every preset
- [x] Part A: Zero scroll event listeners in parallax-scroll (rAF only)
- [x] Part B: `theatreAttrs()` helper in divi-builder.js
- [x] Part B: SKILL.md consent gate (Yes / No but want it / No)
- [x] Part B: `references/divi-theatre.md` preset catalogue
- [x] Part B: taste.md and layout-patterns.md updated
- [x] Part B: example-page.js shows commented DiviTheatre usage
- [x] Part B: validator passes on example output
- [x] Part B: No `data-theatre` attributes emitted without explicit user consent
