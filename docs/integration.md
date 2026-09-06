# Integrating Pore.js

How to embed the reader in your own app. Two layers:

- **`porejs-react`** — React 19. `<Reader>` + hooks + headless components.
  This is what most apps use.
- **`porejs`** — framework-agnostic. Use directly only if you are not
  on React or want to drive the engine imperatively.

```bash
npm i porejs porejs-react
```

Peer deps: `react` / `react-dom` ≥ 19 for the React package; `gsap` is an
**optional** peer (only `gsapAdapter` needs it).

> **Packaging:** **ESM only** — `"type": "module"`, Node ≥ 20, evergreen
> browsers. There is no CommonJS build; `require('porejs')` won't work. `porejs`
> hard-depends on `pdfjs-dist`, but it is only reached through `createPdfEngine`
> / `loadPdf` / `PdfImageSource` — an app that never opens a PDF tree-shakes it
> out. Lower-level building blocks (layout math, anchor internals, the
> store/emitter) are a separate opt-in deep import, `porejs/internal`, and are
> **not** covered by SemVer — see [`stability.md`](stability.md).

> **Styling model:** `porejs-react` ships **no CSS**. Every component
> renders semantic markup with `data-pore-*` hooks and (where interactive)
> Radix primitives. You bring the stylesheet. The `apps/demo` stylesheet
> (`apps/demo/src/styles.css`) is a complete worked example.

---

## 1. Minimal React integration

```tsx
import { ReaderProvider, Reader } from 'porejs-react';
import { DemoSource, CachedSource } from 'porejs';

// A source resolves book ids to manifests, pages/files, and reading position.
const source = new CachedSource(new DemoSource()); // CachedSource = offline + resume

export function App() {
  return (
    <ReaderProvider source={source}>
      <Reader bookId="demo-book" className="reader-host">
        {/* chrome goes here — see §4 */}
      </Reader>
    </ReaderProvider>
  );
}
```

`<Reader>` picks the engine from the manifest `type`: `epub` → text engine,
`pdf` → PDF engine, anything else → image engine. It mounts imperatively into
its own host `<div>` (give it `className` and size it — `flex: 1; min-height:
0`). It restores the last-read position before first paint.

### `<Reader>` props

| prop | type | notes |
|---|---|---|
| `bookId` | `string` | required. Changing it re-mounts the engine (`key` it in the demo). |
| `className` | `string` | on the host div you must size |
| `initialSettings` | `Partial<AnySettings>` | seed layout/typography for this book |
| `onPositionChange` | `(loc: ReaderLocation) => void` | every location change |
| `persistSettings` | `boolean \| SettingsPersistence` | `true` (localStorage) by default |
| `transitions` | `ReaderTransitions` | page-turn/zoom animation seam; default instant. `gsapAdapter(gsap)` for smooth. |
| `ref` | `Ref<ReaderHandle>` | imperative control — see §3 |

---

## 2. Sources — the seam

A source is any object implementing `ReaderSource`:

```ts
interface ReaderSource {
  getManifest(bookId: string): Promise<Manifest>;
  getPage(bookId: string, index: number, opts?): Promise<Blob | string>;
  getFile(bookId: string, opts?): Promise<Blob>;          // whole EPUB/PDF/CBZ
  loadProgress(bookId: string): Promise<Position | null>;
  saveProgress(bookId: string, p: Position): Promise<void>;
  // optional — annotation persistence
  loadHighlights?(bookId: string): Promise<HighlightRecord[]>;
  saveHighlights?(bookId: string, highlights: HighlightRecord[]): Promise<void>;
  loadBookmarks?(bookId: string): Promise<Bookmark[]>;
  saveBookmarks?(bookId: string, bookmarks: Bookmark[]): Promise<void>;
}
```

`HighlightRecord` is a discriminated union: `kind: 'text'` (EPUB / reflowable —
carries a DOM `range` + portable `cfi: { start, end }`) or `kind: 'rect'` (PDF /
fixed pages — carries `page` + normalised `rects`). A `Bookmark` is
`{ id, position, cfi?, page, percent, label, text?, createdAt }`. Both are
per-book collections, parallel to the single `Position` resume checkpoint.

`Manifest` is `ImageManifest` (`type: 'image'`, a page list) or `TextManifest`
(`type: 'epub' | 'pdf' | 'cbz'`). `getFile` returns the archive for text
formats; `getPage` returns per-page blobs/URLs for image books.

### Built-in sources

| source | use |
|---|---|
| `new DemoSource()` | bundled fixtures, zero backend |
| `new LocalFileSource(files)` | a `File[]` / `FileList` the user dropped — `.epub`, `.pdf`, `.cbz`/`.zip`, or loose images. Detects the type. |
| `new CachedSource(inner, opts?)` | wraps any source: local-first manifests + resume + `MediaCache` full-book download for offline. Implements `loadHighlights`/`saveHighlights` **and `loadBookmarks`/`saveBookmarks`** (local-first). Use `useDownload()` for the download UI. |
| `new KavitaSource(opts)` | a live [Kavita](https://kavitareader.com) server (HTTP, bearer auth) |
| `new OpdsSource(url, opts?)` | a read-only OPDS 1.2 catalog. `.acquire(entry)` → a `LocalFileSource` for the picked book. |
| `new PdfImageSource(inner, opts?)` | used internally by the PDF engine; you rarely construct it |

### A custom source

```ts
import type { ReaderSource, Manifest, Position } from 'porejs';

export class MyApiSource implements ReaderSource {
  constructor(private baseUrl: string, private token: string) {}

  async getManifest(bookId: string): Promise<Manifest> {
    const r = await fetch(`${this.baseUrl}/books/${bookId}`, this.#auth());
    const j = await r.json();
    // adapt your API shape to ImageManifest | TextManifest
    return { bookId, type: 'epub', title: j.title };
  }
  getFile(bookId: string) {
    return fetch(`${this.baseUrl}/books/${bookId}/file`, this.#auth()).then((r) => r.blob());
  }
  getPage() { return Promise.reject(new Error('text only')); }
  async loadProgress(bookId: string): Promise<Position | null> {
    const r = await fetch(`${this.baseUrl}/books/${bookId}/position`, this.#auth());
    return r.ok ? r.json() : null;
  }
  async saveProgress(bookId: string, p: Position) {
    await fetch(`${this.baseUrl}/books/${bookId}/position`, {
      ...this.#auth(), method: 'PUT', body: JSON.stringify(p),
    });
  }
  // optional: loadHighlights / saveHighlights for cross-device annotations
  #auth() { return { headers: { authorization: `Bearer ${this.token}` } }; }
}
```

Wrap it in `CachedSource` to get offline + a local resume fallback for free.
`Position` is a small JSON value — keep it opaque and store it verbatim.

---

## 3. Imperative control — `ReaderHandle`

```tsx
const ref = useRef<ReaderHandle>(null);
<Reader bookId={id} ref={ref} />

ref.current.turn('forward' | 'back');
ref.current.goto(pageNumber | position);
ref.current.goToHref('OEBPS/ch03.xhtml#s2');   // TOC navigation
ref.current.setSettings({ theme: 'sepia', columns: 'one' });
ref.current.chapters();                          // Chapter[]
ref.current.search(query);                       // Promise<SearchHit[]>
ref.current.getCfi();                            // portable epubcfi(...) | null
ref.current.goToCfi('epubcfi(/6/8!/4/2)');       // navigate to one (text engine)
ref.current.addHighlight({ color, note });       // from the current selection
ref.current.updateHighlight(id, { color?, note? });
ref.current.removeHighlight(id);
ref.current.listHighlights();
ref.current.ttsPlay() / ttsPause() / ttsResume() / ttsStop() / ttsSetRate(n) / ttsSetVoice(v);
```

Methods that don't apply to the active engine are safe no-ops (`getCfi()` on a
PDF returns `null`, `goToCfi()` on image/PDF does nothing, TTS on an image book
never plays).

---

## 4. Hooks (must be used inside `<Reader>`)

| hook | returns |
|---|---|
| `useReader()` | the `ReaderHandle` |
| `useReaderKind()` | `'text' \| 'image'` (PDF reports `'image'`) |
| `useReaderLocation()` | `ReaderLocation` — page, total, percent, label, chapter |
| `useReaderProgress()` | `{ page, total, percent, … }` |
| `useReaderChapters()` | `Chapter[]` |
| `useTableOfContents()` | `TocEntry[]` (nested) |
| `useReaderSettings<T>()` | `[settings, setSettings]` |
| `useReaderKeymap()` | `[keymap, setKeymap]` |
| `useReaderSearch()` | `{ query, setQuery, hits, activeIndex, go, next, prev, clear, busy }` |
| `useReaderHighlights()` | `HighlightRecord[]` |
| `useBookmarks()` | `{ bookmarks, isBookmarkedHere, supported, add(label?), remove(id), rename(id, label), goTo(bm), toggle() }` — over the handle + `source.load/saveBookmarks` |
| `useReaderSelection()` | `{ selection, highlight(opts), removeHighlight(id), updateHighlight(id, patch) }` |
| `useTts()` | `{ state, play, pause, resume, stop, setRate, setVoice, listVoices }` |
| `useFootnote()` | the footnote/endnote currently opened by a link tap |
| `useEndPage()` | end-of-chapter / end-of-book card state |
| `useReaderLoading()` | set of loading page/spine ids (for skeletons) |
| `useReaderError()` | last engine error |
| `useResumedFromPage()` | page number if the session was resumed (for a toast) |
| `useChromeVisible()` | engine's own chrome-visibility signal (tap-to-toggle) |
| `useReaderHistory(opts?)` | reflects position into the URL + `document.title` |
| `useDownload()` | `{ status, progress, download, remove }` (needs a `CachedSource`) |

---

## 5. Headless components

All render `data-pore-*` markup + Radix; you style them.

| component | what |
|---|---|
| `<SettingsPanel open onOpenChange extraTabs?>` | Radix Dialog with the typography/theme/navigation tabs. `extraTabs` appends your own (`TabDef[]`). |
| `<SettingsPanelBody>` | the tabs without the dialog shell |
| `<TableOfContents className? placeholder?>` | a native `<select>` bound to `goToHref` (`data-pore-toc`) |
| `<HighlightsPanel className? colors? emptyLabel? onJump? previewChars?>` | editable list — jump / recolour / note textarea / remove (`data-pore-hl-*`) |
| `<BookmarksPanel className? onJump? emptyLabel?>` | list — jump / inline rename / remove (`data-pore-bm-*`). Renders `null` when the source has no bookmark methods. |
| `<FootnotePopover>` | renders the footnote a link opened |
| `<ReaderScrubber>` | bottom seek bar with chapter ticks |
| `<ReaderAnnouncer>` | visually-hidden ARIA live region — mount once inside `<Reader>` |

See `apps/demo/src/Chrome.tsx` for a full chrome assembled from these +
`apps/demo/src/styles.css` for the styling.

---

## 6. Settings & persistence

`AnySettings` = `ImageEngineSettings | TextEngineSettings`. Defaults:
`DEFAULT_IMAGE_SETTINGS` / `DEFAULT_TEXT_SETTINGS`. Persistence is a global
prefs layer + a per-book layout layer; pass `persistSettings={false}` to
disable or your own `SettingsPersistence` (`createSettingsPersistence`).

---

## 7. Transitions

```tsx
import gsap from 'gsap';
import { gsapAdapter } from 'porejs-react';
<Reader transitions={gsapAdapter(gsap)} />
```

Without it, page turns / zoom / scroll are instant. The adapter is
reduced-motion aware.

---

## 8. PDF worker

pdf.js is a lazy chunk. Point it at its worker once at startup so it never
lands in your main bundle:

```ts
// Vite — the engine imports the *legacy* pdf.js build, so match it here
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { setPdfWorkerSrc } from 'porejs';
setPdfWorkerSrc(pdfWorkerUrl);
```

---

## 9. Framework-agnostic core (no React)

```ts
import { createTextEngine } from 'porejs';

const engine = createTextEngine({ container, source, bookId, settings });
const off = engine.on('reader:locationchange', (loc) => { /* … */ });
await engine.mount();
engine.turn('forward');
// engine.goto / setSettings / search / getCfi / addHighlight / on / destroy
```

`createImageEngine` and `createPdfEngine` have the same shape. Events are
`reader:*` (see `docs/architecture.md` §2 for the full list). `destroy()` tears
down listeners, observers, object URLs and the DOM subtree.
