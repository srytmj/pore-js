# Pore.js — M0 Plan (Image Engine + DemoSource)

**Goal:** a deployable demo that reads bundled manga fixtures — paged
(single/double) + continuous-vertical, LTR/RTL, fit/zoom/pan, preload, remappable
keys + touch + click zones, and a **last-read checkpoint** that survives reload.
No backend.

**Spec:** [`image-engine-spec.md`](image-engine-spec.md) · **Design:**
[`reader-engine-design.md`](reader-engine-design.md) §6, §14

Tasks are sequential — each builds on the previous and lands as its own PR /
commit. Size: S ≈ half a day, M ≈ 1–2 days, L ≈ 3–4 days.

---

## T0 — Spec reconciliation & core type freeze · S

Close the gaps flagged after the scaffold so downstream tasks build on stable types.

- [x] `ImageManifest` uses `type: 'image'` (not `kind`); `pageCount` present
- [x] `ImagePage` carries metadata only; bytes come from `source.getPage`
- [ ] Move `LayoutMode`, `FitMode`, `Direction` to a single `types.ts` re-exported everywhere
- [ ] `reader-core` exports reviewed against spec §10 (`mount`, `goto`, `turn`, `setSettings`, `setKeymap`, `destroy`, `on`)
- [ ] ADR note in `docs/adr/0001-core-surface.md`

**Done when:** `pnpm typecheck` green; the public API of `reader-core` matches spec §10 on paper (implementations still stubbed).

---

## T1 — DemoSource + real fixtures · M

Make `DemoSource` actually serve content.

- [ ] Add fixtures: one short RTL manga chapter (~20 pages) + one webtoon strip (~10 tall panels), CC0/CC-BY, with `SOURCE.md` + `LICENSE` per folder
- [ ] `apps/demo/public/fixtures/<id>/` layout: `manifest.json` + numbered images
- [ ] `DemoSource.getManifest` → fetch + validate `manifest.json` → `ImageManifest`
- [ ] `DemoSource.getPage` → fetch image as `Blob`, honor `AbortSignal`
- [ ] `DemoSource` progress: in-memory now; IndexedDB wired in T7
- [ ] Vitest: manifest parse, natural sort, `getPage` abort rejects

**Done when:** a test loads the fixture manifest and pulls page 3 as a `Blob`.

---

## T2 — Image engine skeleton + paged-single · L

The first thing on screen.

- [ ] `createImageEngine({ container, source, bookId, settings })` → `{ goto, turn, setSettings, on, destroy }`
- [ ] Event emitter (`image/types.ts` `ImageEngineEvents`), typed `on`/`off`
- [ ] Mount lifecycle: `getManifest` → build spread list (all singles for now) → first paint
- [ ] Render current page as `<img decoding="async">`, `loadingMethod: 'blob'` (fetch → objectURL → revoke on evict)
- [ ] Fit modes: `width` / `height` / `contain` / `original` via `object-fit` + container sizing
- [ ] `turn('forward' | 'back')` swaps page; direction-aware (RTL inverts)
- [ ] `goto(pageIndex)` with clamp
- [ ] Emits `reader:ready`, `reader:locationchange`, `reader:loadingstate`, `reader:end`, `reader:start`
- [ ] Resize observer recomputes fit
- [ ] Vitest (jsdom): mount → ready fires with manifest; `turn` past end fires `reader:end`; RTL turn direction

**Done when:** demo shows fixture page 1, arrow-key/`turn()` moves through it, fit modes visibly change.

---

## T3 — Preload (window + all) + loading states · M

- [ ] `preloadStrategy: 'window'`: ring buffer `[current - preloadBehind, current + preloadAhead]` (2 / 4)
- [ ] `AbortController` per request; cancel on window move (rapid flip test)
- [ ] LRU (~12) of raw blobs to skip refetch on back-nav
- [ ] Object URL lifecycle: revoke on eviction, never revoke an in-view page
- [ ] `preloadStrategy: 'all'`: enqueue whole chapter, order active→end→start, ~6 concurrent, decode stays lazy (spec §5.2)
- [ ] Byte guard: up-front estimate from manifest `width×height` → skip `all` if over `preloadAllMaxMB`; running blob-byte total → stop + hand off to `window` on crossing; reset per chapter
- [ ] `bitmap` + `all` → force `blob` + warn
- [ ] Webtoon: no special-casing — byte guard is the only limit
- [ ] Per-index state machine → `reader:loadingstate` (`idle`/`loading`/`loaded`/`error`); `reader:error { error: 'preload-all-capped' }`
- [ ] Vitest: flipping 1→10 rapidly issues ≤ window-size live fetches (window); `all` enqueues every page in order and halts at the MB cap

**Done when:** `window` flipping never queues 50 requests; `all` on a short chapter fetches everything ahead of the reader and respects the MB guard on a large one.

---

## T4 — paged-double + spread pairing + spreadOffset · M

- [ ] Spread builder: walk pages in reading order, pair into 1–2, `spreadOffset` shifts start
- [ ] Wide page (`isWide` explicit, or aspect after natural load) → solo spread; re-pair on late discovery
- [ ] Direction controls on-screen order (LTR left-first, RTL right-first) + `pageGap`
- [ ] `toggle-spread-offset` action; persists per-book (spec §11.3)
- [ ] `Position.value` = leading page of the pair
- [ ] Recompute spreads on resize / mode change, keep leading page in view
- [ ] Vitest: pairing with/without offset; wide page splits a pair; RTL order

**Done when:** double-spread reads correctly RTL, wide pages sit solo, offset toggle fixes a deliberately misaligned fixture.

---

## T5 — continuous-vertical (webtoon) + virtualization · L

- [ ] Virtualized vertical list: render spreads intersecting `[vp - behind·vh, vp + ahead·vh]`
- [ ] Off-screen items → spacer of known/estimated height; refine on first measure, compensate scroll
- [ ] `Position` type `scroll` (fraction + nearest-page anchor)
- [ ] `pageGap` (default 0 for webtoon)
- [ ] Keyboard scroll (`scroll-up`/`down`, Space, Home/End), wheel = native scroll
- [ ] Preload adapts to a viewport-scaled window
- [ ] Vitest: scrollbar height stable as images measure in; anchor round-trips through resize

**Done when:** webtoon fixture scrolls smoothly, scrollbar doesn't jump, position restores after a window resize.

---

## T6 — Input layer (keyboard remap + touch + click zones) · M

Unify what T2–T5 stubbed.

- [ ] Keyboard: `resolveAction` from `keymap`; physical→logical map via `direction`
- [ ] Touch: swipe = turn (direction-aware), vertical swipe in continuous = scroll, pinch = zoom, double-tap = zoom toggle / fullscreen
- [ ] Click zones: left/center/right thirds; `tapToTurn` = `directional`/`always-forward`/`never` (center always toggles chrome → emits `reader:chrometoggle`)
- [ ] `scrollToTurn` in paged modes (`off`/`wheel`/`keys`/`both`)
- [ ] Zoom/pan: 0.25×–5×, drag-pan when zoomed, `<canvas>` swap for active page > 1×
- [ ] `cycle-fit`, `first-page`, `last-page`, `toggle-fullscreen` (Fullscreen API), Wake Lock while reading
- [ ] Vitest + Playwright: rebinding a key takes effect; RTL swipe direction; click-zone thirds

**Done when:** all of spec §6.2's input matrix works; keybind editor round-trips (even without the fancy UI).

---

## T7 — Last-read checkpoint + IndexedDB · M

- [ ] `IndexedDbProgressStore` keyed by `bookId` (`idb` micro-helper or hand-rolled, no dep bloat)
- [ ] `CachedSource` decorator: `loadProgress`/`saveProgress` hit IndexedDB; passthrough for the rest
- [ ] Engine `mount`: `await source.loadProgress` **before first paint**; skeleton until resolved; emit `reader:resumed`
- [ ] Restore resolution per spec §2.2.1 (`clampPagePosition` for `page`; anchor-then-fraction for `scroll`)
- [ ] Debounced save (~800 ms) + on page-turn settle, `visibilitychange→hidden`, layout change, `destroy`
- [ ] Offline write queue → flush on `online`
- [ ] Playwright: read to page 8 → reload → lands on page 8, no flash of page 1; resize between visits still lands right

**Done when:** close the tab mid-chapter, reopen, you're where you left off.

---

## T8 — Demo wiring + minimal control bar · M

- [ ] `reader-react`: `<Reader bookId onPositionChange initialSettings>` mounts core into a ref'd container; `useReaderLocation`, `useReaderSettings`
- [ ] History: core emits `reader:locationchange`; demo applies `historyMode` (`title` default)
- [ ] Minimal inline control bar (spec §11.1): layout, direction, fit, spread offset — 4 controls
- [ ] Fixture picker (manga / webtoon), progress bar (normal style), page counter
- [ ] `"Resumed from p.X — restart?"` toast
- [ ] Deploy config for `pore.suryatmaja.dev` (static host; SW deferred to M3)

**Done when:** `pnpm dev` → pick a book → read it with the 4 controls → reload resumes. Deployable build.

---

## T9 — M0 hardening · S

- [ ] Playwright matrix: paged-single, paged-double RTL, webtoon — turn, resize, restore
- [ ] A11y pass: controls are real buttons + labels, focus order, `prefers-reduced-motion` kills autoscroll/animated turns
- [ ] Perf check: 40-page chapter, rapid flip, memory doesn't grow unbounded (object URL revocation)
- [ ] README quickstart + a GIF; `docs/` links updated
- [ ] Tag `v0.1.0-m0`

**Done when:** green CI, deployed demo, tagged.

---

## Deferred to M0.5 (explicitly not in M0)

continuous-horizontal · vertical direction · autoscroll · paged auto-advance ·
`bitmap` loading · full tabbed settings panel · image filters (brightness/
greyscale/dim) · `url-and-title` history mode · CBZ via `LocalFileSource`.

## Dependency graph

```
T0 → T1 → T2 → T3 → T4
              T2 → T5
        T4,T5 → T6 → T7 → T8 → T9
```

T3 and T5 can overlap once T2 lands. T7 needs the `Position` shapes from T4 (page)
and T5 (scroll).
