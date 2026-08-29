# Pore.js — M1 Plan (EPUB reflowable text engine)

**Goal:** read reflowable EPUB — sandboxed iframe + CSS multicol pagination,
`anchor` position that round-trips, typography + theme controls, TOC. Runs on
bundled Project Gutenberg fixtures. No backend.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §5, §7, §14 ·
builds on `v0.2.0-m0.5`. Target tag: `v0.3.0-m1`.

Sequential, one commit per task. The `Position` union already has the `anchor`
variant; `TextManifest` already exists.

---

## E1 — EPUB container parsing · M ✅

- [x] `packages/reader-core/src/text/epub/` — `parseEpub(bytes, {domParser?})` via `fflate.unzipSync` + `DOMParser`
- [x] `META-INF/container.xml` → `rootfile` → OPF
- [x] OPF → metadata (title/language/creator, `rendition:layout` → `fixedLayout`), namespace-agnostic manifest (`localName` filtering), spine (`idref`, `linear`, `page-progression-direction`)
- [x] TOC: EPUB3 `nav[epub:type=toc] > ol` nested tree; fallback EPUB2 `toc.ncx` `navMap`; fragments preserved (`resolveHref`)
- [x] `path.ts`: `dirOf` / `stripHash` / `fragmentOf` / `resolvePath` / `resolveHref`
- [x] `EpubBook.resource(href)` → `{ bytes, mediaType }`; `entries[]`
- [x] Vitest (6, jsdom): metadata + spine order + linear, nested nav tree w/ fragments, ncx fallback, resource + ppd + fixed-layout, missing container

**Done when:** a fixture EPUB parses to spine + TOC + resources. ✅ done 2026-08-29

---

## E2 — Text engine skeleton: one spine doc, multicol pagination · L ✅

- [x] `createTextEngine({ container, source, bookId, settings?, domParser? })` → `TextEngine` (`mount`/`goto(page|Position)`/`turn`/`setSettings`/`on`/`destroy`)
- [x] Sandboxed `<iframe sandbox="allow-same-origin">`, `srcdoc` (scripts stripped)
- [x] `rewrite.ts`: `src` / `link[href]` / `<style>` `url()` / CSS `@import`-style refs → `blob:` URLs; nested CSS `url()`; data/absolute left alone; URLs tracked for revocation
- [x] `paginate.ts`: `buildBaseStylesheet` (multicol on `body`, low-specificity typography), `pageCountFor`, `offsetForPage` (translateX)
- [x] Page turn translates `body`; `measure()` = `scrollWidth / (pageWidth+gap)`; resize + settings recompute (`ResizeObserver`)
- [x] `TextEngineSettings` + `DEFAULT_TEXT_SETTINGS`; `reader:ready`/`resumed`/`toc`/`locationchange`/`loadingstate`/`settingschange`/`end`/`start`/`error`
- [x] Fixed-layout EPUB → `reader:error` (not a crash)
- [x] Vitest (10): paginate math, resource rewrite + script strip + nested url(), engine mount/ready/toc/reject-non-epub/settingschange

**Done when:** one chapter paginates and turns page-by-page. ✅ engine done 2026-08-29 (browser pagination verified in E8)

---

## E3 — Spine-boundary navigation + virtualization + preload · M

- [ ] Turning past the last column of spine `i` loads spine `i+1` at column 0;
      turning back past column 0 loads spine `i-1` at its last column
- [ ] Book total page count = sum of spine item page counts (computed lazily;
      estimate un-measured items by character count, refine on visit)
- [ ] Preload: keep the current spine iframe + prerender `i+1` (and `i-1`) in
      hidden iframes; discard beyond ±1
- [ ] `reader:locationchange` reports a book-level page + percent
- [ ] Vitest: boundary crossing forward/back; total-page estimate

**Done when:** you can read start→finish across chapters smoothly.

---

## E4 — `anchor` position: generate + restore · L

This is the bug-prone core — isolate and unit-test hard.

- [ ] On settle: walk from the top-left visible node in the iframe → record
      `{ spine, block, offset, percent }` (block = ordinal of the nearest block
      ancestor among its siblings; offset = char offset into that block)
- [ ] Restore: resolve `spine` → find block `block` → set `offset`; scroll the
      column containing that range into view
- [ ] Fallback cascade (spec §5): exact anchor → nearest block → `percent` of
      spine → `percent` of book
- [ ] Re-resolve the anchor after every resize / font change so the page doesn't
      jump
- [ ] Wire into `source.loadProgress` / `saveProgress` (debounced, same triggers
      as the image engine)
- [ ] Vitest: DOM-walk round-trip on a fixture doc (generate → mutate slightly →
      restore lands within tolerance); percentage fallback

**Done when:** close mid-chapter, reopen, land on the same paragraph — even
after a viewport resize.

---

## E5 — Typography & theme · M

- [ ] User settings: `fontFamily` (bundled + embedded), `fontSizePct`,
      `lineHeight`, `textAlign` (justify toggle), `marginPct`, `columns` (1|2),
      `theme` (light | sepia | dark | oled)
- [ ] Injected as a **layered low-specificity** user stylesheet (target
      `body,p,div,li,...`); deliberate author styling survives
- [ ] "Publisher styles off" toggle → raise specificity / strip author CSS
- [ ] Dark themes set `color` + `background`; images dimmed via
      `filter: invert() hue-rotate()` only when opted in
- [ ] Bundle 3–4 faces (serif, sans, slab, OpenDyslexic) as `@font-face` from
      packaged woff2
- [ ] Recompute pagination + re-resolve anchor on any change
- [ ] Vitest: stylesheet string composes; column count drives page math

**Done when:** the reader restyles live without losing your place.

---

## E6 — TOC, footnotes, writing mode · M

- [ ] `useTableOfContents()` / `reader:toc` — nested entries; clicking → `goto(anchor)`
- [ ] Footnotes: intercept `a[epub:type="noteref"]` / same-doc `#` links →
      render target in a popover instead of navigating
- [ ] `page-progression-direction="rtl"` → columns flow RTL, gestures flip
- [ ] Selection bridge: `selectionchange` in the iframe → floating toolbar
      (copy, bookmark) — bookmark stored via source
- [ ] Vitest: TOC tree → flat anchors; rtl page-turn direction

**Done when:** TOC navigates, footnotes pop, an RTL EPUB reads right-to-left.

---

## E7 — Unify the shell / React · M ✅

- [x] `<Reader>` reads `manifest.type` and mounts `createImageEngine` or `createTextEngine`; `useReaderKind()`
- [x] `useReaderLocation` normalized (`page`, `label`, `position`, `percent`, `chapter?`); `handle.goto` accepts page or `Position`
- [x] `useReaderSettings<T>()` generic (image XOR text); `useTableOfContents()`
- [x] `<SettingsPanel>` delegates to `<TextSettingsPanel>` (Text / Theme tabs) for text books
- [x] Demo `<Chrome>` guards image-only controls behind `kind === 'image'`, uses `loc.percent`
- [ ] _`useReaderSearch` — M3_

**Done when:** the same `<Reader bookId>` opens an EPUB or a manga transparently. ✅ done 2026-08-29

---

## E5 — Typography & theme · M (partial ✅)

- [x] Settings: `fontSizePct`, `lineHeight`, `textAlign`, `marginPct`, `columns` (1|2), `theme` (light/sepia/dark/oled), `publisherStyles`, `fontFamily` — all in `buildBaseStylesheet` + `<TextSettingsPanel>`
- [x] Low-specificity element selectors; recompute pagination on every change; browser-verified live restyle
- [ ] `fontFamily` bundled `@font-face` (serif/sans/slab/OpenDyslexic woff2) — needs packaged fonts
- [ ] `publisherStyles: false` → strip/override author CSS
- [ ] dark-theme image dim (`filter: invert() hue-rotate()`)

_Remainder folded into E9 / follow-up._

---

## E8 — demo fixture + wiring · S ✅

- [x] `gen-fixtures.mjs` builds `demo-book/book.epub` — 3 chapters (nav TOC, `style.css`, noteref links, a `notes.xhtml`), CC0 synthetic
- [x] `DemoSource`: `manifest.json` with `"type":"epub","file":...` → `TextManifest` + `getFile` serves the blob; `getPage`/`getFile` guard by kind
- [x] Demo book picker lists "Demo Book (EPUB)"; text settings panel
- [x] Browser-verified: multicol pagination (`scrollWidth` 4984 / 1280), page turn `translateX`, live font-size + theme

**Done when:** `pnpm dev` → pick the EPUB → read it. ✅ done 2026-08-29
_(real Project Gutenberg EPUBs can be dropped in later; the synthetic one exercises every code path)_

---

## E9 — hardening + release · S

- [ ] Playwright: chapter turn, resize keeps place, theme switch, TOC jump
- [ ] Fixed-layout EPUB detected (`rendition:layout`) → friendly "not supported
      in v1" message, not a crash
- [ ] Perf: iframe teardown, blob-URL revocation, no listener leaks
- [ ] CHANGELOG `v0.3.0-m1`; docs; demo GIF
- [ ] Tag `v0.3.0-m1`

---

## Cut for M1 (per design doc §14)

CFI (anchor only) · highlights/notes · TTS · **fixed-layout EPUB** · OPDS ·
in-book search (M3) · vertical-JP text (M3).

## Dependency graph

```
E1 → E2 → E3 → E4 → E5 → E6 → E7 → E8 → E9
                E4 ← (E5 re-resolves anchors)
```

Mostly linear — the pagination core (E2–E4) must be solid before styling (E5)
and shell work (E7).
