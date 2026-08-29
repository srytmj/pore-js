# Changelog

## v0.5.0-m3 — 2026-08-29

Platform integration, offline, in-book search, vertical text, and an accessible
flow mode. **The engine fundamentals are complete** — UI/animation work starts
next (`docs/ui-foundation-plan.md`).

### Added — a real library server

- **`KavitaSource`** — `ReaderSource` over [Kavita](https://www.kavitareader.com/)'s
  REST API. `bookId` = a Kavita `chapterId`; plugin-key auth exchanged for a JWT
  with one transparent re-auth on 401; `chapter-info` drives the manifest
  (Archive/Image → `image`, Epub, Pdf); pages via `/api/Reader/image`, files via
  `/api/Download/chapter` (`KavitaDownloadForbiddenError` on 403); progress
  round-tripped through `/api/Reader/progress`

### Added — offline

- **`MediaCache`** — IndexedDB blob store (its own DB) for downloaded pages /
  files with LRU whole-book eviction against a byte budget (default 500 MB)
- **`CachedSource` v2** — `getPage` / `getFile` serve the cached blob first;
  `download(bookId, { signal, onProgress })` (resumable), `downloadStatus`
  (`none` / `partial` / `complete`), `removeDownload`. `cache: false` keeps the
  progress-only behaviour.
- `reader-react` `useDownload(bookId)`; demo download button + a dependency-free
  service worker (SWR shell, cache-first fixtures + workers)

### Added — in-book search

- **`search/`** — normalised substring index + snippet/match-range extraction;
  `SearchController` runs queries in a Worker (own bundle entry) with a
  synchronous fallback, latest-query-wins
- Text engine `search(query)` / `gotoHit(hit)` + `reader:searchresults`;
  `reader-react` `useReaderSearch()` (debounced, `next`/`prev`); demo search panel

### Added — vertical & accessible reading

- **Vertical writing mode** (`vertical-rl`) — `TextEngineSettings.verticalText`
  (`auto` | `on` | `off`; `auto` = RTL progression + Japanese language). RTL and
  vertical books swap the horizontal keys; `reader:ready` carries `vertical`.
- **Flow mode** — `TextEngineSettings.flowMode` (`paged` | `flow` | `auto`;
  `auto` follows `forced-colors`). A single scrolling column, no transforms;
  `turn()` scrolls one screen, manual/AT scrolling stays in sync.
- Image page `alt` text gains chapter context; `<ReaderAnnouncer>` — a hidden
  `aria-live` region for chapter/progress announcements
- Playwright + `@axe-core/playwright` coverage for all of the above

## v0.4.0-m2 — 2026-08-29

PDF support and one unified position/chrome model across image, text and PDF.

### Added — PDF

- **`pdf/parse.ts`** — lazy `pdfjs-dist` (legacy build, Node + browser);
  `loadPdf(bytes) → PdfDoc` with `pageCount`, `pageSize`, `outline`
  (bookmarks → `#page=N`), `textContent`, `renderToBlob` (`OffscreenCanvas` →
  webp, `maxDim` memory cap)
- **`PdfImageSource`** — adapts a PDF into an `ImageManifest` + rendered page
  blobs (outline → `chapters[]`, progress proxied); the image engine consumes
  it unchanged
- **`createPdfEngine`** — `createImageEngine` over a `PdfImageSource`, adding
  `reader:toc` from the outline; `<Reader>` mounts it for `manifest.type: 'pdf'`

### Added — unified shell

- **`Locator`** `{ position, page, total, percent, label, chapter? }` — the one
  shape every engine emits in `reader:locationchange`; `ReaderEngine<S,E>`
  interface + `CommonEngineEvents`
- **`reader:progress`** `{ locator, percent, chapterLabel, chapterIndex,
  chapterCount, pagesLeftInChapter, minutesLeft }` from every engine;
  `PaceEstimator` (EMA of seconds-per-page) drives `minutesLeft`
- **`chapters(): Chapter[]`** on every engine — `{ id, label, startPage,
  startPercent }`; `chapterProgress()` maps page → chapter
- **`LocalFileSource`** opens a dropped `.epub` / `.pdf` (served whole through
  `getFile`), and sniffs OPF `rendition:layout=pre-paginated` → `fixedLayout`
- **`reader-react`** — `useReaderProgress()`, `handle.chapters()`
- Per-book settings persistence (`createSettingsPersistence`, `<Reader
  persistSettings>`); `publisherStyles: false` strips author CSS; `dimImages`

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
