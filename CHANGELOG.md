# Changelog

## Unreleased

### Added — EPUB navigation UX

- **End page**: the last chapter ends on a centred "The End" card (an extra
  page) so progress reaches a true **100%**; `TextEngineSettings.endBehavior`
  (`continuous` | `endpage`) makes every chapter pause on an end-of-chapter card
  with a Continue button. `reader:endpage` event + `useEndPage()`.
- **Menu placement**: `TextEngineSettings.menuPosition` (`top` | `left` |
  `right`) and `menuReveal` (`hover` | `click` | `dblclick`) for side menus;
  engine emits `reader:chrometoggle`, `useChromeVisible()`; demo `Chrome`
  positions/reveals the bar and shows a centred menu on the end page.
- Settings panel gains a **Navigation** tab for the above.

### Fixed — EPUB reader (post-M1 feedback)

- **Book-like layout**: the text engine now centres a capped reading measure
  (~33em, grows with font size) inside a clipped `#pore-viewport` / `#pore-flow`
  wrapper — no more full-width lines or columns bleeding in from adjacent pages;
  1 or 2 columns per page per the setting, dropping to 1 when it won't fit
  (`computeTextLayout`)
- **Input**: the text engine had none — added keyboard (← → ↑ ↓ A/D/H/L,
  Space / Shift+Space, PageUp/Down, Home/End, M), mouse wheel (throttled), and
  left/right/centre click zones, wired on both `root` and the iframe document
  (iframe events don't bubble)

## v0.3.0-m1 — 2026-08-29

EPUB reflowable text engine.

### Added

- **`@pore/reader-core` — `text/`**
  - `parseEpub` — `container.xml` → OPF (metadata / namespace-agnostic manifest /
    spine) → EPUB3 nav or EPUB2 ncx TOC; `EpubBook.resource()`; path helpers
  - `createTextEngine` — sandboxed `<iframe srcdoc>` (scripts stripped),
    `body` CSS-multicol pagination via `translateX`, `ResizeObserver` reflow
  - `rewrite.ts` — `src` / `href` / CSS `url()` → `blob:` URLs, revoked on teardown
  - `paginate.ts` — `buildBaseStylesheet` (low-specificity typography), page math
  - `anchor.ts` — `generateAnchor` / `resolveAnchor` (exact block → nearest →
    spine-percent); resume lands on the paragraph, resize holds the fraction
  - `TextEngineSettings` — font family/size, line-height, justify, margins,
    columns (1–2), theme (light/sepia/dark/oled), publisher-styles toggle
  - `goToHref` (TOC), footnote / same-doc link interception → `reader:footnote`
  - fixed-layout EPUB detected → `reader:error`, not a crash
- **`@pore/reader-react`**
  - `<Reader>` mounts the image **or** text engine by `manifest.type`;
    `useReaderKind`, `useTableOfContents`, `useFootnote`, generic
    `useReaderSettings<T>`, normalized `location.percent`
  - `<SettingsPanel>` → `<TextSettingsPanel>` (Text / Theme) for EPUBs
- **`apps/demo`** — `demo-book/book.epub` fixture (generated), book picker,
  "Contents…" dropdown, footnote popover; `DemoSource` serves EPUB fixtures

### Cut for M1

CFI, highlights/notes, TTS, fixed-layout EPUB, OPDS, in-book search, vertical-JP
text, RTL column flow, char-level anchor offset, selection/bookmark bridge.

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
