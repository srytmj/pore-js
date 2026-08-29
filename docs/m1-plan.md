# Pore.js — M1 Plan (EPUB reflowable text engine)

**Goal:** read reflowable EPUB — sandboxed iframe + CSS multicol pagination,
`anchor` position that round-trips, typography + theme controls, TOC. Runs on
bundled Project Gutenberg fixtures. No backend.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §5, §7, §14 ·
builds on `v0.2.0-m0.5`. Target tag: `v0.3.0-m1`.

Sequential, one commit per task. The `Position` union already has the `anchor`
variant; `TextManifest` already exists.

---

## E1 — EPUB container parsing · M

- [ ] `packages/reader-core/src/text/epub/` — parse with `fflate.unzipSync`
- [ ] `META-INF/container.xml` → OPF path
- [ ] OPF → `metadata` (title, language, `page-progression-direction`),
      `manifest` (id → { href, mediaType, properties }), `spine` (ordered idrefs)
- [ ] Nav: EPUB3 `nav.xhtml` (`epub:type="toc"`) → tree; fallback EPUB2 `toc.ncx`
- [ ] `EpubBook` object: `spine: SpineItem[]`, `toc: TocEntry[]`, `metadata`,
      `resource(href) → Blob` (lazy inflate + MIME)
- [ ] `DomParser` via the platform (`new DOMParser()`); no XML lib
- [ ] Vitest: a hand-built minimal EPUB (zipSync) → spine order, TOC tree,
      resource lookup, ncx fallback

**Done when:** a fixture EPUB parses to spine + TOC + resources.

---

## E2 — Text engine skeleton: one spine doc, multicol pagination · L

- [ ] `createTextEngine({ container, source, bookId, settings })` → `TextEngine`
      (mirrors `ImageEngine`: `mount`/`goto`/`turn`/`setSettings`/`on`/`destroy`)
- [ ] Render the current spine item in a **sandboxed `<iframe>`**
      (`sandbox="allow-same-origin"`, no `allow-scripts`)
- [ ] Resource resolver: rewrite `href`/`src`/CSS `url()` → `blob:` URLs before
      injecting the doc
- [ ] Inject the base stylesheet: `column-width: <vw>; column-gap; height: <vh>;
    overflow: hidden` on `html`; `img,svg,table { max-width:100%; break-inside:avoid }`
- [ ] Page count for the spine item = `scrollWidth / pageWidth`; page turn =
      translate the scroll by `pageWidth`
- [ ] Recompute on resize (debounced)
- [ ] Emits `reader:ready`, `reader:locationchange` (page within spine for now),
      `reader:loadingstate`
- [ ] Vitest (jsdom): mount → ready; `turn` advances the column offset; page
      count math (stub `scrollWidth`)

**Done when:** one chapter paginates and turns page-by-page.

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

## E7 — Unify the shell / React · M

- [ ] `createReaderEngine(manifest.type)` picks image vs text engine behind one
      `ReaderEngine` interface (superset; `TurnDirection`, `on`, `goto(anchor|page)`)
- [ ] `<Reader>` handles both; `useReaderLocation` returns a `Locator`
      (spine+anchor | pageIndex | scroll%) with uniform `percent` / label
- [ ] `<SettingsPanel>` gains a Typography tab when the book is text
- [ ] `useTableOfContents`, `useReaderSearch` (stub for M3)
- [ ] Vitest / RTL: `<Reader>` mounts a text book from `DemoSource`

**Done when:** the same `<Reader bookId>` opens an EPUB or a manga transparently.

---

## E8 — Gutenberg fixtures + demo · S

- [ ] Add 2 public-domain EPUBs to `fixtures/` (one plain prose, one with
      structure: TOC depth, images, a table) + `LICENSE`/`SOURCE.md`
- [ ] `DemoSource` serves them (`getFile` → the `.epub` blob); `getManifest` →
      `TextManifest`
- [ ] Demo book picker lists them; Typography controls in the panel
- [ ] `gen:fixtures` untouched (EPUBs are checked in, not generated)

**Done when:** `pnpm dev` → pick a Gutenberg book → read it.

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
