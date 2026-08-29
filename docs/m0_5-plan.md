# Pore.js — M0.5 Plan (complete the image reader)

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

## P4 — `bitmap` loading path · M

- [ ] `PageLoader` `bitmap` branch: `fetch` → `createImageBitmap` → keep the `ImageBitmap`
- [ ] Renderer: draw the active page to a `<canvas>` sized to devicePixelRatio; fit/zoom/pan math ported to canvas transform
- [ ] Only the active (or zoomed) page uses canvas; neighbours stay `<img>`
- [ ] `bitmap` + `preloadStrategy:'all'` still forced to `blob` (memory)
- [ ] Close/`ImageBitmap.close()` on eviction
- [ ] Vitest: loader returns a bitmap handle; canvas fit math

**Done when:** high-zoom pages stay crisp with `loadingMethod:'bitmap'`.

---

## P5 — image filters in the UI · S ✅

- [x] `applyFilters()` split out (renderPaged/renderContinuous wipe `viewport.style.cssText`, so filters re-applied after every render + on scroll)
- [x] `dimEl` overlay (`position:absolute;inset:0;pointer-events:none;z-index:1`) toggled to `opacity:.12`
- [x] Demo: brightness slider + B/W + Dim toggles
- [x] Vitest: filter string composes, dim overlay opacity

**Done when:** brightness slider + greyscale + dim toggles work live. ✅ done 2026-08-29

---

## P6 — `LocalFileSource` (drop a file) · L

- [ ] `LocalFileSource(files: File[] | FileList)` implementing `ReaderSource`
- [ ] `.cbz` / `.zip` → `fflate` unzip, natural-sort image entries, per-entry lazy inflate (keep the central directory, inflate on `getPage`)
- [ ] Folder / multi-file image drop → sort → manifest
- [ ] Dimensions probed lazily (first decode) → feeds `isWide` + webtoon layout
- [ ] Progress: in-memory (wrap in `CachedSource` for persistence)
- [ ] Demo: drag-and-drop zone → opens the dropped book
- [ ] Vitest: CBZ fixture (tiny generated zip) → manifest + `getPage` inflate + abort

**Done when:** drop a `.cbz` onto the demo and read it.

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

## P9 — hardening + release · S

- [ ] Playwright: autoscroll, vertical mode, CBZ drop, settings panel round-trip, history back/forward
- [ ] `prefers-reduced-motion` audit across new motion
- [ ] Perf: `ImageBitmap` close on evict; autoscroll rAF cancelled on destroy
- [ ] CHANGELOG `v0.2.0-m0.5`; docs links; demo GIF
- [ ] Tag `v0.2.0-m0.5`

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
