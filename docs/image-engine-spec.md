# Pore.js — Image Engine Spec (Manga)

**Status**: Draft / RFC
**Owner**: Surya
**Last Updated**: 2026-08-28
**Supersedes**: "Image Engine (Manga)" section of `reader-engine-design.md`
**References**: MangaDex web reader, cubari/teal-style manga readers (see `/docs/references/`)

---

## 1. Purpose & Scope

The Image Engine renders **image-based books** (manga, comics, webtoon, CBZ, and PDF-as-images via the PDF engine shell). It owns layout, navigation, fit/zoom/pan, preloading, and input. It does **not** own chrome (top/bottom bars, TOC) — that is the Unified Shell's job — but it emits the events and exposes the state the shell binds to.

This spec merges the original design doc with UX patterns observed in MangaDex and comparable readers, and adds features those references imply that the doc did not name explicitly (autoscroll, spread offset, rich progress bar, keybind remapping, image filters, history mode).

### In scope (M0)

- 4 layout modes: paged-single, paged-double, continuous-vertical, continuous-horizontal
- Direction: LTR / RTL / vertical
- Fit modes + zoom + pan
- Spread pairing + spread offset
- Preload ring buffer + fetch cancellation + loading-method switch
- Input: keyboard (remappable), touch, click zones, wheel
- Autoscroll (continuous) + paged auto-advance timer
- Next-chapter-after-last-page behavior
- Image filters: brightness, greyscale, dim
- Progress model + rich progress bar state
- Settings store (global + per-book override)

### Out of scope

- Chrome rendering, TOC UI, scrubber UI (Unified Shell)
- Text/EPUB (Text Engine)
- Chapter list, comments, "report chapter", uploader info — platform concerns
- Fixed-layout EPUB

---

## 2. Data Model

### 2.1 Manifest (image book)

```ts
interface ImageManifest {
  bookId: string;
  type: 'image'; // discriminant, matches reader-engine-design.md §4
  title: string;
  direction: 'ltr' | 'rtl' | 'vertical'; // author/source default
  pageCount: number;
  pages: ImagePage[];
  // optional chapter grouping for "next chapter" behavior
  chapters?: { id: string; label: string; startIndex: number }[];
  preferredLayout?: LayoutMode;
}

interface ImagePage {
  index: number; // 0-based, global across the book
  width?: number; // intrinsic px, if known (enables no-CLS layout + spread pairing)
  height?: number;
  isWide?: boolean; // explicit "display solo in double mode"; else derived from width/height
  chapterId?: string;
}
```

**Page bytes are not in the manifest.** The manifest carries only metadata
(dimensions, wide flag, chapter). Actual image data is fetched lazily via
`source.getPage(bookId, index, { variant?, signal? })` → `Blob | string` — keeps
the engine source-blind (`reader-engine-design.md` §4). A CBZ, a folder of images,
and the Platform API all present the same `ImageManifest`.

`isWide` resolution order: explicit `isWide` → `width/height` aspect ratio > `wideThreshold` (default `1.0`, i.e. landscape) → after natural load, re-evaluate and re-pair if needed.

### 2.2 Position

Unchanged from `reader-engine-design.md`:

```ts
type Position =
  | { type: 'page'; value: number; total: number } // paged image / PDF
  | { type: 'scroll'; value: number; total: number }; // continuous (webtoon)
```

- `page.value` is the **leading page index** of the current view (for double spread, the first page of the pair in reading order).
- `scroll.value` is a **fraction 0..1** of total scrollable content (resilient to viewport resize), plus the engine keeps an internal anchor to the nearest page for precise restore.
- Save is debounced (default 800 ms) and also fired on: page turn settle, visibilitychange→hidden, layout-mode change, unmount.

### 2.2.1 Last-read checkpoint (resume)

The reader must **never restart from page 1** if the user has opened the book before.

- **On `mount`**: engine calls `source.loadProgress(bookId)` _before_ first paint. If a `Position` returns, the engine restores to it and only then reveals content (brief skeleton, no flash of page 1).
- **Restore resolution**:
  - `page` → clamp to `[0, total-1]`; if `total` changed (re-sync), scale by ratio and snap to nearest spread.
  - `scroll` → restore by the stored page anchor first, then fine-tune with the fraction; fall back to fraction alone if the anchored page no longer exists.
- **Cross-device**: with `WhiteArchiveSource`, `loadProgress` hits the platform (last-writer-wins). With `DemoSource` / `LocalFileSource`, progress persists in **IndexedDB** keyed by `bookId`.
- **Offline**: writes queue in IndexedDB and flush to the source on reconnect; local restore always works from the IndexedDB copy even if the network read fails.
- **Shell affordance**: if the restored position is > 1 spread from the start, Shell shows a dismissable "Resumed from p.X — restart?" toast for a few seconds.
- Engine emits `reader:resumed { position, page }` (or `reader:resumed { position: null }` for a fresh open) so the host can react.

### 2.3 Settings

```ts
interface ImageEngineSettings {
  // --- Layout ---
  layout: 'paged-single' | 'paged-double' | 'continuous-vertical' | 'continuous-horizontal';
  direction: 'ltr' | 'rtl' | 'vertical';
  spreadOffset: 0 | 1; // shift double-spread pairing by one page
  pageGap: number; // px between pages (paged-double + continuous)

  // --- Fit / sizing ---
  fit: 'width' | 'height' | 'contain' | 'original' | 'smart';
  stretchSmallPages: boolean; // upscale pages smaller than viewport
  maxWidth: number | null; // clamp px (null = no clamp)
  maxHeight: number | null;

  // --- Interface (state only; Shell renders) ---
  headerVisible: boolean;
  progressBar: {
    style: 'hidden' | 'lightbar' | 'normal';
    position: 'bottom' | 'left' | 'right';
    thickness: number; // px
    showPageCounterWhenHidden: boolean;
  };
  cursorHint: 'none' | 'overlay' | 'cursor';
  background: 'theme' | 'white' | 'black';

  // --- Image filters ---
  brightness: number; // 0.2..1.0, multiplies
  greyscale: boolean;
  dim: boolean; // subtle dark overlay for OLED/night

  // --- Behavior ---
  tapToTurn: 'directional' | 'always-forward' | 'never';
  scrollToTurn: 'off' | 'wheel' | 'keys' | 'both'; // paged modes only
  doubleClickFullscreen: boolean;
  nextChapterAfterLastPage: 'off' | 'instant' | 3 | 5 | 10; // seconds
  historyMode: 'none' | 'title' | 'url-and-title';

  // --- Autoscroll (continuous) ---
  autoscroll: boolean;
  autoscrollSpeed: number; // px/s
  autoscrollSmooth: boolean; // true = continuous, false = one screen per tick at same rate
  pagedAutoAdvanceSeconds: number; // 0 = off; timer flips pages in paged modes

  // --- Fit-change side effects ---
  autoScrollUpOnFit: ('width' | 'height' | 'none')[]; // which fit modes reset scroll to top
  autoScrollOffset: number; // px

  // --- Performance ---
  preload: boolean; // master on/off
  preloadStrategy: 'window' | 'all'; // ring buffer vs whole-chapter (default 'window')
  preloadAhead: number; // strategy 'window': pages ahead, default 4
  preloadBehind: number; // strategy 'window': pages behind, default 2
  preloadAllMaxMB: number; // strategy 'all': byte guard, default 512
  loadingMethod: 'native' | 'blob' | 'bitmap'; // <img src=url> | <img src=blobURL> | createImageBitmap off-thread
}
```

Keybindings are stored separately (see §7.1).

**Persistence scope** (see §11.3): Layout + Fit fields and `direction` are
**per-book overridable** (`perBook[bookId]` merged over global defaults); Behavior
fields, `keymap`, and image filters are **global only**.

---

## 3. Layout Modes

| Mode                      | Behavior                                                                                                                                                        | Position type |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **paged-single**          | One page per screen. Page-turn advances by 1.                                                                                                                   | `page`        |
| **paged-double**          | Two adjacent pages side by side, paired per reading direction. Wide pages render solo. First page can render solo (cover) unless `spreadOffset` says otherwise. | `page`        |
| **continuous-vertical**   | Virtualized vertical stream (webtoon). Pages stack top→bottom with `pageGap`.                                                                                   | `scroll`      |
| **continuous-horizontal** | Virtualized horizontal stream, flow respects `direction` (RTL = right→left).                                                                                    | `scroll`      |

Reference mapping: MangaDex "Single / Double / Long Strip / Wide Strip" →
`paged-single` / `paged-double` / `continuous-vertical` / `continuous-horizontal`.

### 3.1 Spread pairing (paged-double)

- Pages are grouped into "spreads" of 1–2 pages.
- Walk pages in reading order. Start index shifted by `spreadOffset`.
- A page that is `isWide` occupies its own spread; the walk resumes pairing after it.
- Direction controls on-screen order: LTR → [left=first, right=second]; RTL → [right=first, left=second].
- `spreadOffset` toggle ("Offset Double Spreads" in refs) lets the reader fix misaligned pairs mid-book without changing page data.
- Resize / mode change / late `isWide` discovery → recompute spreads, keep the current leading page in view.

### 3.2 Virtualization (continuous)

- Render only spreads intersecting `[viewport - preloadBehind*vh, viewport + preloadAhead*vh]`.
- Off-screen items collapse to a spacer of their known (or estimated) dimension to keep the scrollbar stable.
- Estimated dimension is refined on first real measure; scroll position is compensated so content doesn't jump.

---

## 4. Fit, Zoom, Pan

### 4.1 Fit modes

| Mode         | Definition                                                                          |
| ------------ | ----------------------------------------------------------------------------------- |
| **width**    | Page width = viewport width (minus margins). Vertical scroll if taller.             |
| **height**   | Page height = viewport height. Horizontal centering; page-turn on overflow.         |
| **contain**  | Fit entirely within viewport, preserve aspect. No scroll within page.               |
| **original** | Intrinsic pixel size (1:1), pan both axes.                                          |
| **smart**    | `contain`, but allow zoom past 100% with pan; double-tap / `I` cycles zoom presets. |

Reference "Contain to width" + "Contain to height" checkboxes (independent booleans) map to our single `fit` enum:

- width only → `width`
- height only → `height`
- both → `contain`
- neither → `original`

We keep the enum internally; the settings UI _may_ present the two-checkbox form and translate.

`stretchSmallPages`, `maxWidth`, `maxHeight` clamp the computed size after fit.

### 4.2 Zoom / pan

- Zoom range 0.25×–5× (relative to fit size). Wheel+Ctrl, pinch, double-tap.
- Pan: drag (mouse/touch) when zoomed; momentum on touch.
- Zoom is **not** persisted across page turns by default; `smart` mode keeps zoom+pan offset until changed.
- `autoScrollUpOnFit`: when the fit mode changes to a listed value, reset scroll to top + `autoScrollOffset` px.

---

## 5. Preloading & Loading Method

`preload: false` disables all speculative fetching — only the visible page(s) load.
With `preload: true`, `preloadStrategy` picks between two policies.

### 5.1 `preloadStrategy: 'window'` (default) — ring buffer

- Maintain decoded pages for indices `[current - preloadBehind, current + preloadAhead]` (defaults 2 / 4).
- On rapid navigation, **cancel** in-flight fetches/decodes that fall outside the new window (`AbortController` per request).
- Evict decoded bitmaps outside the window; keep a small LRU (e.g. last 12) of raw blobs to avoid refetch on back-navigation.
- Safe for long webtoon chapters and low-memory devices. This is the default.

### 5.2 `preloadStrategy: 'all'` — whole chapter

- Once the manifest is read, enqueue a fetch for **every page in the current
  chapter** (or the whole book if it has no chapter grouping).
- **Fetch order:** active page → forward to chapter end → then backward to
  chapter start. Concurrency capped (~6 parallel requests) so the active-page
  path is never starved.
- **Decode stays lazy** — pages are held as `Blob`s (or object URLs); each is
  decoded only when it enters/nears the viewport. Holding blobs is cheap; holding
  hundreds of decoded bitmaps is not.
- **Webtoon is fine here** — a tall-panel chapter is just more blobs, and the
  byte guard below is the only limit. No webtoon-specific fallback.
- **Byte guard (`preloadAllMaxMB`, default 512):**
  - If manifest pages carry `width`/`height`, estimate total bytes up front; if
    the estimate exceeds the cap, don't start `all` — fall back to `window` and
    emit `reader:error { error: 'preload-all-capped' }` (Shell shows a notice).
  - Regardless of estimate, track the **running total of fetched blob bytes**; on
    crossing `preloadAllMaxMB`, stop enqueuing new fetches and let the `window`
    ring buffer take over from the current position. Already-fetched blobs stay.
  - Crossing a chapter boundary resets the running total and re-arms `all` for
    the new chapter.
- **`bitmap` + `all` is disallowed** (memory). If both are set, `all` runs with
  `blob` loading and a console warning.
- New-chapter transition (via `nextChapterAfterLastPage`) triggers a fresh `all`
  pass for that chapter.

### 5.3 Loading method (`loadingMethod`)

### 5.2 Loading method (`loadingMethod`)

| Value      | Mechanism                                                                                                   | Trade-off                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **native** | `<img src="<url>">`, `decoding="async"`, `loading` managed by engine                                        | Simplest; browser cache; no cancel granularity on decode                   |
| **blob**   | fetch → `Blob` → `URL.createObjectURL` → `<img>`                                                            | Works with auth headers / signed URLs; explicit lifecycle; revoke on evict |
| **bitmap** | fetch → `createImageBitmap` (off main thread) → draw to `<canvas>` or `<img>` via `transferFromImageBitmap` | Smoothest large-page decode; higher memory; canvas path needed             |

Default: `blob` (matches platform's signed media URLs, and is the only method
compatible with `preloadStrategy: 'all'`). `bitmap` recommended for
`original`/`smart` at high zoom.

Rendering baseline: native `<img>` with `decoding="async"`. Switch the _current_ page to `<canvas>` only when zoomed > 1× (perf) or when `loadingMethod = bitmap`.

---

## 6. Navigation & Behavior

### 6.1 Page turn

- **Forward / back** are direction-aware. RTL: "next" = visually left. Vertical: "next" = down.
- Paged modes: turn = swap spread. Continuous: "turn" = scroll by ~1 viewport (respecting `autoscrollSmooth` stepping semantics for keyboard).
- At **book end**: fire `reader:end`. If `nextChapterAfterLastPage != off` and chapters exist, show a countdown affordance (Shell renders) and auto-advance; `instant` skips the countdown.
- At **book start** going back: fire `reader:start` (Shell may load previous chapter).

### 6.2 Input matrix

| Input                       | Paged                                                             | Continuous                                      |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Arrow / A D / Num4 Num6     | turn ± (direction-aware)                                          | scroll ± 1 screen                               |
| W S / Num8 Num2             | (unused / zoomed pan)                                             | scroll up / down                                |
| Space / Shift+Space         | turn forward / back                                               | scroll down / up                                |
| Home / End                  | first / last spread                                               | scroll to top / bottom                          |
| Wheel                       | turn if `scrollToTurn` ∈ {wheel, both}, else zoom w/ Ctrl         | scroll                                          |
| Swipe                       | turn (direction-aware)                                            | native scroll; horizontal swipe ignored         |
| Pinch / double-tap          | zoom                                                              | zoom                                            |
| Tap left/center/right third | per `tapToTurn`: back / toggle chrome / forward (mirrored in RTL) | center = toggle chrome; edges = per `tapToTurn` |
| Double-click                | fullscreen if `doubleClickFullscreen`                             | same                                            |

`tapToTurn`:

- `directional` — left third = back, right third = forward (mirrored for RTL), center = chrome
- `always-forward` — left & right both = forward, center = chrome
- `never` — only center toggles chrome; edges do nothing

### 6.3 Autoscroll (continuous only)

- `autoscroll` on → engine drives scroll at `autoscrollSpeed` px/s.
- `autoscrollSmooth = true` → `requestAnimationFrame` continuous translate.
- `autoscrollSmooth = false` → jump one viewport every `viewportPx / speed` seconds (same average rate, discrete steps).
- Pauses on: user scroll/drag, chrome open, tab hidden, zoom > 1×. Resumes after an idle timeout (2 s) unless user turned it off.
- At book end: same `nextChapterAfterLastPage` handling.

### 6.4 Paged auto-advance

- `pagedAutoAdvanceSeconds > 0` → timer flips forward every N seconds in paged modes. Pauses with chrome / zoom / hidden tab.

### 6.5 History mode

| Value           | Effect                                                                                 |
| --------------- | -------------------------------------------------------------------------------------- |
| `none`          | URL and document.title never change on page turn                                       |
| `title`         | `document.title` reflects `Ch X · p.Y`                                                 |
| `url-and-title` | also `history.replaceState` the page into the URL; back/forward buttons navigate pages |

Engine emits `reader:locationchange`; Shell (or host app) decides how to reflect it. Default `title`.

---

## 7. Keybindings

### 7.1 Model

```ts
type ActionId =
  | 'toggle-menu'
  | 'turn-forward'
  | 'turn-back'
  | 'scroll-up'
  | 'scroll-down'
  | 'chapter-forward'
  | 'chapter-back'
  | 'toggle-fullscreen'
  | 'cycle-fit'
  | 'toggle-spread-offset'
  | 'first-page'
  | 'last-page'
  | 'toggle-autoscroll';

interface Keymap {
  [action: ActionId]: string[];
} // e.g. { "turn-forward": ["ArrowRight","d","6"] }
```

- Multiple keys per action. A physical key binds to **one** action (last-write-wins with a warning).
- Per-action reset + global "reset all to defaults".
- Stored in settings store under `keymap`, persisted to localStorage, per-book override allowed.
- Defaults follow MangaDex: `turn page right` = →/D/Num6, `turn page left` = ←/A/Num4, `scroll up` = W/Num8, `scroll down` = S/Num2, `chapter back` = `.`, `chapter forward` = `,`, `toggle menu` = M, `fullscreen` = F, `cycle fit` = I, `offset double spreads` = O.

Note: "turn page right/left" are **physical**; the engine maps physical→logical via `direction` (RTL swaps).

---

## 8. Image Filters

- `brightness` → CSS `filter: brightness()` on the page container.
- `greyscale` → `filter: grayscale(1)`.
- `dim` → semi-transparent black overlay (`~12%`) above pages, below chrome.
- Filters compose: `filter: brightness(b) grayscale(g)`.
- All are view-only, cheap, and do not affect preload/decoding.

---

## 9. Events (engine → host)

```ts
interface ImageEngineEvents {
  'reader:ready': { manifest: ImageManifest };
  'reader:resumed': { position: Position | null; page: number };
  'reader:locationchange': { position: Position; page: number; chapter?: string; label: string };
  'reader:layoutchange': { layout: LayoutMode; spreads: number };
  'reader:loadingstate': { index: number; state: 'idle' | 'loading' | 'loaded' | 'error' };
  'reader:end': { auto: 'off' | 'instant' | number };
  'reader:start': {};
  'reader:zoomchange': { scale: number };
  'reader:error': { index?: number; error: unknown };
}
```

Progress persistence goes through `ReaderSource.saveProgress`; the engine never talks to the network directly.

---

## 10. Core / React Split

| Concern                                                       | `reader-core`                              | `reader-react`                           |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Layout, virtualization, fit/zoom/pan, preload, input handling | ✅ imperative, mounts into a container ref | —                                        |
| Settings store (Zustand vanilla), persistence, per-book merge | ✅                                         | binds via hook                           |
| Keymap resolution                                             | ✅                                         | rebinding UI                             |
| Progress model + debounced save                               | ✅                                         | —                                        |
| Event emitter                                                 | ✅                                         | `useReaderLocation`, `useReaderSettings` |
| Chrome (bars, scrubber, countdown, settings panel)            | —                                          | ✅                                       |
| Settings panel UI (the MangaDex-style tabbed modal)           | —                                          | ✅ (reads/writes core store)             |

Core exposes: `mount(el, { source, bookId, settings })`, `goto(target)`, `turn(dir)`, `setSettings(patch)`, `setKeymap(patch)`, `destroy()`, `on(event, cb)`.

---

## 11. Resolved Decisions

Resolved 2026-08-28.

### 11.1 Settings panel scope for M0 — **minimal bar; full panel in M0.5**

Core carries the **complete** `ImageEngineSettings` from day one (every field live and
functional). M0 UI ships only an inline control bar: layout mode, direction, fit
mode, spread offset — the four controls used mid-read. Keybind editor, behaviors,
filters, and progress-bar styling move to a tabbed panel in M0.5. Adding the panel
later is pure `reader-react` work since core is already complete.

_Trade-off accepted:_ the M0 demo looks less polished than MangaDex.

### 11.2 `bitmap` loading path — **deferred to M0.5; `<img>` + `createImageBitmap` → canvas for the active page only, no worker**

M0 ships `native` + `blob` only. If `loadingMethod: "bitmap"` is selected in M0 it
falls back to `blob` with a console warning. When implemented in M0.5: decode via
`createImageBitmap` (already off-thread) and paint the **active page** to `<canvas>`;
all fit/zoom/pan math is reimplemented for that canvas path. No `OffscreenCanvas` /
worker in v1 — over-engineering. Revisit only if profiling shows `blob` stutters on
large pages.

### 11.3 Spread-offset persistence — **per-book, sticky**

`spreadOffset` is stored under `perBook[bookId]`. More broadly:

| Scope                               | Settings                                       |
| ----------------------------------- | ---------------------------------------------- |
| **Per-book override** (over global) | everything in Layout + Fit groups, `direction` |
| **Global only**                     | Behaviors, `keymap`, image filters             |

Rationale: layout/fit are properties of _the book_ (a scanlation that starts on an
even page, a webtoon that wants vertical+single); behaviors/keys/filters are
properties of _the reader_.

### 11.4 History `url-and-title` mode — **core emits, host executes**

Core never touches `window.history` or `document.title`. It emits
`reader:locationchange { position, page, label }`; the host app decides:

- `historyMode: "none"` → ignore
- `historyMode: "title"` → `document.title = label`
- `historyMode: "url-and-title"` → `history.replaceState(...)` + title

`historyMode` lives in the settings store as a **hint** the host reads via
`useReaderSettings()`. `reader-react` may ship an optional `useReaderHistory()`
helper that wires the default behavior, but core stays embeddable anywhere without
seizing the URL. URL scheme (`/read/:bookId/:page` vs `?p=`) belongs to the host
router.

### 11.5 Webtoon gap / stitch — **`pageGap` numeric only; stitch mode deferred (low priority)**

`pageGap` (default `0` for webtoon, `~16` for comics) covers the normal case. A
"stitch adjacent" mode (seamlessly merge pages that are one sliced image) is niche —
most webtoons ship pre-sliced and read continuously at `pageGap: 0`. If a fixture
ever needs it, add `webtoonStitch: boolean` (forces exact-0 gap, kills sub-pixel
borders, sets `image-rendering`). Not on the roadmap. See §12 → Deferred.

### 11.6 CBZ — **`LocalFileSource` concern; engine stays source-blind**

`LocalFileSource` unzips the `.cbz` with `fflate`, natural-sorts image entries, and
returns a standard `{ type: "image" }` `ImageManifest` with per-page blob loaders.
`getPage(i)` inflates **only** entry `i` on demand (keep the ZIP central directory /
index in the source) so a 200 MB archive never fully decompresses into memory. The
engine only ever sees `ImageManifest` + `Blob` — consistent with "everything above
the source is source-blind" (`reader-engine-design.md` §4).

---

## 12. Milestone Fit

- **M0 core**: paged-single/double, continuous-vertical, LTR/RTL, fit modes, zoom/pan, spread pairing+offset, preload ring buffer + `native`/`blob`, keyboard (remappable) + touch + click zones, DemoSource, **last-read checkpoint (IndexedDB) with restore-before-paint**.
- **M0.5 (stretch)**: continuous-horizontal, vertical direction, autoscroll, paged auto-advance, `bitmap` loading, full tabbed settings panel, image filters, history modes.
- **Deferred** (not on the roadmap): `webtoonStitch` mode (§11.5), per-page fit
  overrides, `OffscreenCanvas`/worker decode path (§11.2).
