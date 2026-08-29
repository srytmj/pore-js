# Changelog

## v0.2.0-m0.5 — 2026-08-29

Completes the image reader.

### Added

- **Layout**: `continuous-horizontal` (axis-generic virtualization, RTL via
  reversed layout slots); `direction: 'vertical'` reads as reverse (RTL-like)
- **Autoscroll** (rAF smooth / stepped), **paged auto-advance** timer, and a
  **next-chapter countdown** (`interceptChapterBoundary` → `reader:autoadvance`,
  cancellable) — all `prefers-reduced-motion` aware
- **`loadingMethod: 'bitmap'`**: `createImageBitmap` → `<canvas>` render for
  paged mode; `ImageBitmap.close()` on eviction; forced to `blob` with `all`
- **Image filters** wired: brightness, greyscale, and a `dim` overlay
- **`LocalFileSource`**: drop a `.cbz`/`.zip` (one-at-a-time inflate) or loose
  images; demo has a drop zone
- **`<SettingsPanel>`** (reader-react): Layout / Image fit / Behavior / Keybinds
  tabs with per-action key capture; new `reader:settingschange` event +
  `useReaderKeymap`
- **`useReaderHistory`**: `url-and-title` mode — `?p=` URL + browser
  back/forward paginate

### Changed

- `continuous.ts` API is axis-generic (`estimateLinearLayout`, `LinearLayout`)
- reader-react settings are single-sourced from the engine via events
- 88 unit tests; Playwright suite covers the new surfaces

## v0.1.0-m0 — 2026-08-28

First milestone: the image engine and a deployable demo. No backend.

### Added

- **`@pore/reader-core`**
  - `ReaderSource` seam; `DemoSource` (fixture manifests + pages), `CachedSource`
    (local-first progress, offline write queue), `openKvStore` (IndexedDB KV)
  - Image engine (`createImageEngine`): paged single/double with spread pairing,
    `spreadOffset`, and late wide-page discovery; continuous-vertical webtoon
    with virtualization and measure-on-load scroll compensation
  - LTR / RTL; fit modes (width/height/contain/original/smart); zoom + pan
  - Preloading: `window` ring buffer and whole-chapter `all` with a
    `preloadAllMaxMB` byte guard; back-nav LRU; object-URL lifecycle
  - Input: remappable keyboard, tap zones (`tapToTurn`), swipe, wheel
    (`scrollToTurn`), double-tap, Fullscreen API, Wake Lock
  - Last-read checkpoint: `loadProgress` before first paint, debounced save
  - Position model + `clampPagePosition`; typed event emitter
- **`@pore/reader-react`**: `<Reader>`, `ReaderProvider`, `useReader`,
  `useReaderLocation`, `useReaderSettings`, `useResumedFromPage`
- **`apps/demo`**: control bar, progress bar, resume toast, `?book=` URL,
  Playwright e2e suite, Vercel config
- Tooling: pnpm workspace, tsup, Vitest (75 tests), ESLint, Prettier, CI

### Deferred to M0.5

continuous-horizontal · vertical-JP direction · autoscroll · paged auto-advance ·
`bitmap` decode path · full tabbed settings panel · image filters · `url-and-title`
history mode · CBZ via `LocalFileSource`.
