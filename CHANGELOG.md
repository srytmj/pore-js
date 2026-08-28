# Changelog

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
