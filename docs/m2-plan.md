# Pore.js — M2 Plan (PDF + unified shell)

**Goal:** read PDF by wrapping pdf.js and reusing the image engine's navigation
shell; unify image/text/PDF behind one `Locator` position model and one
`ReaderEngine` interface; `LocalFileSource` accepts any supported file.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §5, §8, §9, §14 ·
builds on `v0.3.0-m1`. Target tag: `v0.4.0-m2`.

Sequential, one commit per task. Deps: **pdf.js** (`pdfjs-dist`, lazy chunk).

---

## C0 — carry-over cleanup (M0.5 / M1 slivers) · S ✅

- [x] **Per-book settings persistence** — `reader-react/settings-store.ts`:
      localStorage, global prefs + per-book layout layer (spec §11.3);
      `<Reader persistSettings>` seeds on mount, saves on change (`1a5460a`)
- [x] **`publisherStyles: false`** — `rewrite.ts` `stripAuthorCss` removes
      `<style>` / `<link rel=stylesheet>` / inline `style=`; engine re-renders
      the spine on toggle
- [x] **Dark-theme image dim** — `dimImages` setting → `filter: invert() hue-rotate()`
      on iframe images when the theme is dark
- [ ] **Char-level anchor `offset`** — _still deferred_: block-level anchor
      already resumes to the right paragraph; sub-paragraph precision needs a
      caret/Range walk that jsdom can't test. Low payoff, revisit if it bites.
- [ ] **Bundled reading fonts** — _needs asset files_: `fontFamily` switches the
      CSS stack (serif/sans/slab work today); OpenDyslexic needs a bundled woff2
      the maintainer adds. Folds into the UI milestone's asset pass.

**Done when:** the deferred M1 slivers are closed. ✅ (2 remain, both blocked on
non-code inputs) 2026-08-29

---

## D1 — `Locator` + unified `ReaderEngine` interface · M ✅

- [x] `Locator` = `{ position, page, total, percent, label, chapter? }` in
      `reader-core/src/reader-engine.ts` — the one shape every engine emits in
      `reader:locationchange`
- [x] `ReaderEngine<S, E>` interface + `CommonEngineEvents`
- [x] Image + text `reader:locationchange` payloads normalised to `Locator`
      (image gains `total`/`percent`; text drops `totalPages`/`spine`, label uses
      the chapter name, `chapter` = spine idref)
- [x] `reader-react` `ReaderLocation = Locator`; `<Reader>` locationchange
      handler is typed, no `as {…}` cast
- [x] Vitest: image `reader:locationchange` carries `{page,total,percent}`
      (`create-image-engine.test`); browser-verified both formats

**Done when:** one position model. ✅ done 2026-08-29
_(`Position` stays the engine-native precise anchor; `Locator` wraps it for the
shell — no separate `toLocator`/`fromLocator` needed)_

---

## D2 — PDF parsing + page metadata · M ✅

- [x] `packages/reader-core/src/pdf/parse.ts` — lazy
      `import('pdfjs-dist/legacy/build/pdf.mjs')` (legacy build runs in Node +
      browsers); `pdfjs-dist` external in tsup
- [x] `loadPdf(bytes) → PdfDoc`: `pageCount`, `pageSize(n)`, `outline` (bookmarks
      resolved to `#page=N`), `textContent(n)`, `destroy()`
- [x] `renderToBlob(n, {scale, maxDim})` → `OffscreenCanvas` → webp `Blob` for
      the image engine (browser only; `maxDim` caps big-page memory)
- [x] Vitest (3, pdf-lib fixture): page count + size, per-page text, empty outline

**Done when:** a PDF parses to pages + outline + text. ✅ done 2026-08-29
_(scrubber thumbnail strip → D5/UI)_

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
