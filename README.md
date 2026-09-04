# Pore.js

Source-agnostic web reader engine for manga (image-based) and text (EPUB, PDF,
CBZ). Custom rendering + pagination engine, not a wrapper.

> **Design docs:** [`docs/reader-engine-design.md`](docs/reader-engine-design.md) ·
> [`docs/image-engine-spec.md`](docs/image-engine-spec.md) ·
> [`docs/m0-plan.md`](docs/m0-plan.md)

## Workspace

```
packages/
  reader-core     TypeScript, framework-agnostic — sources, image engine, position, settings
  reader-react    React 19 bindings — <Reader>, hooks
apps/
  demo            Vite app, generated fixtures — the public demo
fixtures/         provenance notes; image fixtures are generated
```

## Develop

```bash
corepack enable
pnpm install
pnpm gen:fixtures   # generate the demo image fixtures (CC0 synthetic)
pnpm dev            # run the demo at http://localhost:5173
pnpm build          # build the packages
pnpm test           # vitest (reader-core)
pnpm typecheck      # tsc -b across the workspace
pnpm lint

pnpm --filter @pore/demo e2e:install   # one-time: Playwright browser
pnpm --filter @pore/demo e2e           # end-to-end demo tests
```

Requires Node >= 20.

## Status — UI foundation (`v0.6.0-ui`)

**UI foundation:** Tailwind v4 + design tokens + dark mode in the demo; a
headless Radix component layer in `reader-react` (`<SettingsPanel>` Dialog,
`<TableOfContents>`, `<FootnotePopover>`, `SelectField` / `SliderField` /
`SwitchField` / `Tabs` primitives); an injectable animation seam
(`ReaderTransitions` / `instantTransitions` in core) with `gsapAdapter(gsap)`
for eased page turns, zoom and scroll — reduced-motion aware. The engine stays
framework- and animation-library-agnostic.

**Integration & a11y (M3):** `KavitaSource` reads from a live
[Kavita](https://www.kavitareader.com/) server; `CachedSource` v2 + `MediaCache`
download whole books for offline reading (`useDownload`); in-book search runs in
a Worker (`useReaderSearch`); vertical Japanese (`vertical-rl`) and an accessible
scrolling **flow mode**; `<ReaderAnnouncer>` for screen readers.

**PDF (M2):** `loadPdf` wraps `pdfjs-dist`; `PdfImageSource` renders pages to
webp and feeds the image engine unchanged; `createPdfEngine` adds the outline as
`reader:toc`. `<Reader>` opens a PDF, EPUB or manga transparently.

**Unified shell (M2):** one `Locator` position model + `reader:progress`
(chapter, pages-left, `minutesLeft`) + `chapters()` across all three engines;
`useReaderProgress()`. `LocalFileSource` opens a dropped `.epub` / `.pdf` too.

**EPUB (M1):** `parseEpub` (OPF / spine / TOC), `createTextEngine` — sandboxed
iframe + CSS-multicol pagination, `anchor` resume, live typography + themes, TOC
navigation, footnote popovers.

**Image reader (M0 / M0.5):** feature-complete —

- **Layout**: paged single/double (spread pairing, `spreadOffset`, late
  wide-page discovery), continuous vertical + horizontal (virtualized), LTR /
  RTL / vertical
- Fit modes, zoom/pan, image filters (brightness / greyscale / dim)
- Preload: `window` ring buffer + whole-chapter `all` (byte guard)
- Loading: `native` / `blob` / `bitmap` (canvas)
- Input: remappable keyboard, tap zones, swipe, wheel; autoscroll, paged
  auto-advance, next-chapter countdown
- Last-read checkpoint (IndexedDB via `CachedSource`)
- Sources: `DemoSource`, `LocalFileSource` (drop a `.cbz`, `.epub`, `.pdf` or
  images), `KavitaSource`, `CachedSource` (offline)
- React: `<Reader>`, `<SettingsPanel>`, `<ReaderAnnouncer>`, hooks
  (`useReaderProgress`, `useReaderSearch`, `useDownload`, `useReaderHistory`, …)

See `docs/m0-plan.md` … `docs/m3-plan.md` for the task breakdowns, and
[`CHANGELOG.md`](CHANGELOG.md).

UI foundation: [`docs/ui-foundation-plan.md`](docs/ui-foundation-plan.md) — done
(U1–U6, plus the scrubber / loading-skeleton+error / PDF-search /
RTL-horizontal / end-page follow-ups all landed on `main`).

Next: [`docs/m4-plan.md`](docs/m4-plan.md) — CFI-precise text ranges,
highlights & notes, fixed-layout EPUB, an `OpdsSource`, TTS (stretch).
**Scoped, not started** — a few open questions in that doc first.

## License

MIT
