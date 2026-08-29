# Pore.js — M0.5 Plan (complete the image reader)

**Status: ✅ COMPLETE (2026-08-29) — tagged `v0.2.0-m0.5`.** P1–P8 landed; P9
release below. Deferred slivers (per-book settings persistence, hi-dpi canvas
sizing, vertical-rl text flow) roll into M1 prep.

**Goal:** everything the manga/comic reader needs before the engine moves on to
EPUB (M1). Builds on `v0.1.0-m0`. Target tag: `v0.2.0-m0.5`.

**Spec:** [`image-engine-spec.md`](image-engine-spec.md) · **M0:** [`m0-plan.md`](m0-plan.md)

Sequential, one commit per task. All type/event/setting slots already exist from M0.

---

## P1 — continuous-horizontal · M ✅

- [x] `continuous.ts` generalised to an axis param (`estimateLinearLayout`, `LinearLayout {sizes,offsets,total}`); vertical wrapper kept
- [x] Engine: `axis()`, `scrollMain`/`setScrollMain`/`viewportMain`, `overflow-x:auto` for `x`
- [x] RTL horizontal: layout slots reversed (`slotToPage`) so `scrollLeft` stays positive; `pageAtOffset`/`scrollForPage` go through the slot map
- [x] `Position` `scroll` fraction over the main axis + page anchor
- [x] Keyboard `scroll-*` + wheel + turn use the main axis
- [x] Vitest: x-axis layout math; browser-verified RTL comic reads right→left, virtualised, `loc` tracks

**Done when:** a comic reads left↔right continuously, RTL included. ✅ done 2026-08-29

---

## P2 — vertical direction · S ✅

For the **image** engine, `direction: 'vertical'` only affects page progression —
it reads right→left / bottom→up, i.e. the reverse of LTR, same as RTL. (Genuine
vertical-rl text flow is a Text-engine concern, M1.)

- [x] `isReverseDirection(d)` = `rtl || vertical`; `physicalToLogical`, `resolveTap`, `swipeTurn`, spread visual order all use it
- [x] Vitest: `physicalToLogical`/`swipeTurn` under `vertical`

**Done when:** `vertical` turns the same way as RTL. ✅ done 2026-08-29
_(vertical-rl writing mode for light novels lands with the Text engine, M1)_

---

## P3 — autoscroll + paged auto-advance + next-chapter countdown · M ✅

- [x] Continuous autoscroll: `requestAnimationFrame` translate at `autoscrollSpeed` px/s (both axes); `autoscrollSmooth:false` = `setInterval` one screen per `viewport/speed` s
- [x] Pause on pointerdown + `visibilitychange→hidden`; resume 2 s after idle if still enabled
- [x] Paged: `pagedAutoAdvanceSeconds` `setInterval` → `turn('forward')`
- [x] `nextChapterAfterLastPage`: `interceptChapterBoundary` on forward turn crossing into a later chapter → `reader:end` + `reader:autoadvance {toChapter, inMs}` countdown → `goto(nextStart)`; `instant`=0 s; `off` navigates normally; cancelled (`inMs:-1`) on manual turn / pointer
- [x] `toggle-autoscroll` keybind + demo ▶/⏸ button
- [x] `prefers-reduced-motion` short-circuits `startAutoscroll`
- [x] `reader:autoscroll {running}` / `reader:autoadvance` events
- [x] Vitest (4, fake timers): paged timer cadence, chapter countdown + jump, cancel-on-turn, stepped autoscroll running state

**Done when:** webtoon autoscrolls hands-free and stops at chapter end. ✅ done 2026-08-29

---

## P4 — `bitmap` loading path · M ✅

- [x] `PageLoader`: bitmap-mode fetch also `createImageBitmap(blob)`; `getBitmap(index)`; `ImageBitmap.close()` on drop/destroy
- [x] `renderPaged` bitmap branch: `<canvas role=img aria-label>` sized to `bmp.width/height`, `drawImage`; same `applyFitStyle` CSS scales it; wide-page discovery via bitmap dims
- [x] `<img>` path unchanged for continuous / native / blob
- [x] `bitmap` + `preloadStrategy:'all'` → forced to `blob` with a warn
- [x] Settings panel: Loading method + Preload selectors (Behavior tab)
- [x] Vitest (3): loader cache/bytes, LRU eviction + revoke, bitmap decode + close; browser-verified canvas render

**Done when:** `loadingMethod:'bitmap'` renders pages to canvas. ✅ done 2026-08-29
_(devicePixelRatio hi-dpi sizing + canvas-native zoom/pan: nice-to-have follow-up; CSS scaling covers the common case)_

---

## P5 — image filters in the UI · S ✅

- [x] `applyFilters()` split out (renderPaged/renderContinuous wipe `viewport.style.cssText`, so filters re-applied after every render + on scroll)
- [x] `dimEl` overlay (`position:absolute;inset:0;pointer-events:none;z-index:1`) toggled to `opacity:.12`
- [x] Demo: brightness slider + B/W + Dim toggles
- [x] Vitest: filter string composes, dim overlay opacity

**Done when:** brightness slider + greyscale + dim toggles work live. ✅ done 2026-08-29

---

## P6 — `LocalFileSource` (drop a file) · L ✅

- [x] `LocalFileSource(files: File[] | FileList, opts?)` implementing `ReaderSource`
- [x] `.cbz` / `.zip` → `fflate.unzipSync` with a filter; entry list built once (filter rejects all, collects names), then one entry inflated per `getPage`; `__MACOSX/` skipped, natural sort
- [x] Loose image drop → filter to images, natural sort, served as the `File` blobs directly
- [x] Dimensions left to the engine's decode-time discovery (`isNaturallyWide`, webtoon `measurePage`)
- [x] Progress in-memory; demo wraps it in `CachedSource`
- [x] Demo: full-window drop zone → `LocalFileSource` swap; book `<select>` shows "(dropped)"; browser-verified with a generated CBZ
- [x] Vitest (3): CBZ natural order + per-entry inflate + range + abort; loose images + direction

**Done when:** drop a `.cbz` onto the demo and read it. ✅ done 2026-08-29

---

## P7 — full tabbed settings panel · L ✅

- [x] `reader:settingschange {settings, keymap}` event — emitted on mount, `setSettings`, `setKeymap`; `<Reader>` mirrors it into `useReaderSettings` / `useReaderKeymap` (so keybind-driven changes reflect in the UI)
- [x] `<SettingsPanel onClose>` — tabs Layout / Image fit / Behavior / Keybinds
- [x] Layout: mode, direction, spread offset, page gap, background, progress-bar style
- [x] Image fit: fit mode, stretch small, max width, brightness, greyscale, dim
- [x] Behavior: tapToTurn, scrollToTurn, double-click FS, autoscroll speed/smooth, paged timer, next-chapter
- [x] Keybinds: per-action key capture (press-a-key), multi-key, per-action + "Reset all" (`setKeymap`)
- [x] Demo: ⚙ button toggles the panel; browser-verified live fit change + 13 keybind rows
- [ ] _Per-book vs global persistence split (spec §11.3) — deferred to M1 prep (needs the per-book settings store)_

**Done when:** every setting in spec §2.3 is reachable from the UI and applies live. ✅ done 2026-08-29

---

## P8 — `url-and-title` history mode · S ✅

- [x] `reader-react`: `useReaderHistory({ mode, title, param })` — `none` / `title` / `url-and-title`
- [x] `url-and-title`: first change `replaceState`, subsequent `pushState` `?p=`; `popstate` → `reader.goto`
- [x] Demo `<Chrome>` uses it; browser-verified `?p=` + title update + back/forward paging

**Done when:** back/forward navigates pages when the setting is on. ✅ done 2026-08-29

---

## P9 — hardening + release · S ✅

- [x] Playwright: history back/forward, settings-panel live fit change, continuous-horizontal scroll (added to `reader.spec.ts`)
- [x] `prefers-reduced-motion`: `startAutoscroll` guard + `.progress` transition
- [x] Perf: `ImageBitmap.close()` on drop/destroy; autoscroll rAF + all timers cleared on `destroy`
- [x] CHANGELOG `v0.2.0-m0.5`; plan + README status
- [ ] _demo GIF — follow-up_
- [x] Tag `v0.2.0-m0.5`

---

## Dependency graph

```
P1 ─┐
P2 ─┼─→ P3 ─→ P9
P4 ─┘        ↑
P5 ─→ P7 ────┤
P6 ─────────┤
P8 ─────────┘
```

P1/P2/P4/P6 are independent after M0. P7 pulls in P5. P3 wants P1+P2 done so
autoscroll covers every continuous axis. P9 last.
