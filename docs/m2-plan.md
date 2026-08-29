# Pore.js — M2 Plan (PDF + unified shell)

**Goal:** read PDF by wrapping pdf.js and reusing the image engine's navigation
shell; unify image/text/PDF behind one `Locator` position model and one
`ReaderEngine` interface; `LocalFileSource` accepts any supported file.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §5, §8, §9, §14 ·
builds on `v0.3.0-m1`. Target tag: `v0.4.0-m2`.

Sequential, one commit per task. Deps: **pdf.js** (`pdfjs-dist`, lazy chunk).

---

## C0 — carry-over cleanup (M0.5 / M1 slivers) · S

- [ ] **Per-book settings persistence** — settings store gets a `perBook[bookId]`
      layer merged over global (spec §11.3); layout/fit/direction per-book,
      behavior/keymap/theme global; persisted (localStorage now, IndexedDB in M3)
- [ ] **Char-level anchor `offset`** — text `generateAnchor` records the char
      offset into the block (Range walk); `resolveAnchor` uses it for sub-page
      precision
- [ ] **Bundled reading fonts** — ship serif / sans / slab / OpenDyslexic woff2
      as `@font-face` in the text iframe; `fontFamily` setting already wired
- [ ] **`publisherStyles: false`** — actually strip/neutralise author `<style>` +
      `<link rel=stylesheet>` in `rewrite.ts` when off (currently only raises
      specificity)
- [ ] **Dark-theme image dim** — `filter: invert() hue-rotate()` on iframe images
      when a dark theme + opt-in
- [ ] Vitest for each

**Done when:** the deferred M1 slivers are closed.

---

## D1 — `Locator` + unified `ReaderEngine` interface · M

The three engines already share `mount / turn / goto / setSettings / on /
destroy`; formalise it and give the shell one position vocabulary.

- [ ] `Locator` — the abstract position the shell renders from:
      `{ kind: 'page'; index; total } | { kind: 'scroll'; fraction; total } |
     { kind: 'anchor'; spine; block; offset; percent }` plus a computed
      `percent`, `label`, `chapter?`
- [ ] `toLocator(Position)` / `fromLocator(Locator)` round-trip helpers
- [ ] `ReaderEngine<S>` interface in `reader-core` — the common surface
      (`goto(number | Locator | Position)`, unified event names)
- [ ] Image + text engines declared `implements ReaderEngine`; event payloads
      carry a `locator`
- [ ] `reader-react` `<Reader>` drops the `as unknown as EngineLike` cast;
      `useReaderLocation` returns a `Locator`
- [ ] Vitest: locator round-trips for each Position variant

**Done when:** one interface, one position model, no casts.

---

## D2 — PDF parsing + page metadata · M

- [ ] `packages/reader-core/src/pdf/` — lazy `import('pdfjs-dist')`, worker
      configured (bundled worker URL)
- [ ] `loadPdf(bytes) → PdfDoc`: `pageCount`, `getPage(n)` (viewport, render to
      canvas at devicePixelRatio), `getOutline() → TocEntry[]`, `getTextContent(n)`
- [ ] `PdfDoc.getPageBlob(n, scale)` → renders to an `OffscreenCanvas`/`<canvas>`
      → `convertToBlob` so the **image engine** can consume it as a normal page
- [ ] Big-PDF safety: render window only, low-res thumbnails for the scrubber
- [ ] Vitest: a tiny generated PDF (pdf-lib or a hand-written minimal PDF) →
      pageCount, text extraction, outline

**Done when:** a PDF parses to pages + outline + text.

---

## D3 — PDF engine = image engine shell + pdf.js renderer · M

- [ ] `createPdfEngine(options)` reuses the image engine internals (paged /
      continuous, zoom/pan, fit modes, gestures, preload ring) but swaps the
      page loader for the pdf.js canvas renderer
- [ ] Refactor: extract the image engine's view/nav/input core so both
      `createImageEngine` and `createPdfEngine` compose it (no copy-paste)
- [ ] `Locator` is `page`; outline → `reader:toc`; text layer rendered over the
      canvas for selection + (later) search
- [ ] `<Reader>` mounts it for `manifest.type === 'pdf'`
- [ ] Vitest (jsdom + stub pdf.js): mount, turn, goto, toc

**Done when:** `<Reader bookId>` opens a PDF and navigates like manga.

---

## D4 — `LocalFileSource` any-file + fixed-layout EPUB · S

- [ ] `LocalFileSource` detects `.pdf` → `type: 'pdf'` manifest + `getFile`
- [ ] `.epub` → `type: 'epub'` (currently only `.cbz` / images handled)
- [ ] Fixed-layout EPUB (`rendition:layout="pre-paginated"`): render each spine
      doc to a page image and feed the image engine (design doc §12) — or, if
      that's heavy, a clear "opened as fixed-layout (beta)" path
- [ ] Demo drop zone copy + accepted types updated
- [ ] Vitest: dropped `.pdf` / `.epub` → right manifest type

**Done when:** drop any supported file and it opens.

---

## D5 — shared chrome data (design doc §9) · M

- [ ] Engines emit a uniform `reader:progress { locator, percent, chapterLabel,
    pagesLeftInChapter, minutesLeft? }` derived from the `Locator`
- [ ] `minutesLeft`: image = pages left × per-page seconds (rolling avg);
      text = chars left ÷ reading speed (wpm setting)
- [ ] Chapter model unified: image `chapters[]`, text spine+TOC, PDF outline →
      `{ id, label, startLocator }[]` via one `chapters()` accessor
- [ ] `reader-react` `useReaderProgress()` hook
- [ ] Vitest: minutesLeft math, chapter mapping per engine

**Done when:** the shell can render "Ch 4 of 12 · 18 min left" for any book.

---

## D6 — hardening + release · S

- [ ] Playwright: PDF open + turn + zoom, fixed-layout notice, cross-format book switch
- [ ] Perf: pdf.js worker teardown, canvas pool, no leaked render tasks
- [ ] CHANGELOG `v0.4.0-m2`; README; docs
- [ ] Tag `v0.4.0-m2`

---

## Dependency graph

```
D1 ─→ D2 ─→ D3 ─→ D4 ─→ D5 ─→ D6
   D1 also unblocks D5
```

## Cut for M2

WhiteArchiveSource, offline page caching + SW, in-book search, vertical-JP,
a11y flow mode — all **M3**. CFI, highlights, TTS, OPDS — M4+.
