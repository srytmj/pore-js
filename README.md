# Pore.js

Source-agnostic web reader engine for manga (image-based) and text (EPUB, PDF,
CBZ). Custom rendering + pagination engine, not a wrapper.

> ### 🤖 If you are an AI agent
>
> **Read [`docs/ai-agent-guide.md`](docs/ai-agent-guide.md) first.** It is the
> single entry point: the repo map, how to run/build/test/verify, the commit
> and worklog conventions, the invariants you must not break, and the current
> milestone. From there:
> [`docs/architecture.md`](docs/architecture.md) (how the engine works inside) ·
> [`docs/integration.md`](docs/integration.md) (how to consume the packages) ·
> [`docs/agent-worklog.md`](docs/agent-worklog.md) (what recent sessions did —
> and where you append your own entry).

**Docs:** [`docs/ai-agent-guide.md`](docs/ai-agent-guide.md) ·
[`docs/architecture.md`](docs/architecture.md) ·
[`docs/integration.md`](docs/integration.md) ·
[`docs/reader-engine-design.md`](docs/reader-engine-design.md) (RFC) ·
[`docs/image-engine-spec.md`](docs/image-engine-spec.md) ·
[`docs/m8-plan.md`](docs/m8-plan.md) (current milestone) ·
[`CHANGELOG.md`](CHANGELOG.md)

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

## Integrating it in your app

Full guide: [`docs/integration.md`](docs/integration.md). The short version —

```tsx
import { ReaderProvider, Reader } from 'porejs-react';
import { CachedSource, DemoSource } from 'porejs';

const source = new CachedSource(new DemoSource()); // swap DemoSource for your own

<ReaderProvider source={source}>
  <Reader bookId="demo-book" className="reader-host" />
</ReaderProvider>
```

- **`porejs-react`** — React 19: `<Reader>`, the `useReader*` hooks, and
  **headless** components (`<SettingsPanel>`, `<TableOfContents>`,
  `<HighlightsPanel>`, `<ReaderScrubber>`, `<FootnotePopover>`,
  `<ReaderAnnouncer>`). **Ships no CSS** — you style the `data-pore-*` markup.
  `apps/demo/src/styles.css` is a complete worked example.
- **`porejs`** — framework-agnostic. `createImageEngine` /
  `createTextEngine` / `createPdfEngine` if you're not on React.
- **Sources** — implement `ReaderSource` (`getManifest`, `getPage`, `getFile`,
  `loadProgress` / `saveProgress`, optional `loadHighlights` / `saveHighlights`)
  or use a built-in: `DemoSource`, `LocalFileSource`, `CachedSource` (offline),
  `KavitaSource`, `OpdsSource`. Wrap any of them in `CachedSource` for offline +
  resume.
- **Position** (`loadProgress` / `saveProgress`) is a small opaque JSON value —
  store it verbatim; it round-trips across devices and viewport sizes.

## Status — library & portability (`v0.10.0-library`)

**Library & portability (M7):** bookmarks (`useBookmarks` + headless
`<BookmarksPanel>`, over new optional `ReaderSource.loadBookmarks?` /
`saveBookmarks?` and a new `goToCfi` engine method), a "Continue reading" shelf
on the demo home, a full-screen annotations review, versioned export / import
(`docs/portability-format.md`), and `?book=&cfi=` deep links that navigate +
pulse. All additive. See `docs/m7-plan.md`.

**Editorial UI redesign (M6):** the demo has a quiet, reading-first identity —
warm paper palette, bundled Hanken Grotesk + Literata, no decorative accent
(`docs/design-language.md`). The menu bar is one collapsible rail with settings
inline as a height-animated accordion (a new headless `Accordion` primitive; a
`layout` prop on the settings panels). A `<Reader fontFaceCss>` prop wires the
reader's Serif / Sans options to bundled webfonts. New editorial landing page.
Webtoon strips honour the reader's `maxWidth`. Mobile: the rail overlays and
starts collapsed. See `docs/m6-plan.md`.

**Reading-comfort chrome + annotation polish (M5):** the demo's menu bar sits
on the left or right edge for every engine and can auto-hide when idle
(fullscreen forces it); `<SettingsPanel>` gained an `extraTabs` prop. Highlights
now take a **note** — `updateHighlight()` on the handle / `useReaderSelection()`
— edited in a reusable headless `<HighlightsPanel>`. PDF highlights: Shift-drag
over a page to highlight a passage (`HighlightRecord` is now a `text | rect`
union; `createPdfEngine` gained the highlight API). See `docs/m5-plan.md`.
Fixed-layout two-page spreads were deferred.

**Annotations & beyond (M4):** word-level anchor offsets + a portable
`epubcfi(...)` position (`getCfi()`); text highlights with a floating
selection toolbar, persisted via `ReaderSource.loadHighlights`/`saveHighlights`
and rendered with the CSS Custom Highlight API; fixed-layout (pre-paginated)
EPUB support, scaled to fit the window; a read-only `OpdsSource` (OPDS 1.2)
catalog browser; text-to-speech (`useTts()`) with sentence-level highlight
sync and auto page-turn, backed by the browser's `SpeechSynthesis`. See
`docs/m4-plan.md`.

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

M4: [`docs/m4-plan.md`](docs/m4-plan.md) — done (F1–F6, `v0.7.0-annotate`).

M5: [`docs/m5-plan.md`](docs/m5-plan.md) — done (G1 · F2b · F2c ·
F6, `v0.8.0-comfort`; F3b deferred).

M6: [`docs/m6-plan.md`](docs/m6-plan.md) — done (D0–D7, `v0.9.0-editorial`) —
an editorial UI redesign of the demo. `docs/design-language.md` is the
reference.

M7: [`docs/m7-plan.md`](docs/m7-plan.md) — done (L0–L6, `v0.10.0-library`) —
bookmarks, home shelf, annotations review, export / import, `?cfi=` deep
links. `docs/portability-format.md` is the bundle schema.

M8: [`docs/m8-plan.md`](docs/m8-plan.md) — **scoped, not started** (H0–H10,
target `v1.0.0`) — rename to `porejs` / `porejs-react`, freeze the API, make it
embeddable in a host app, hardening (real-content corpus, robustness,
cross-browser, perf, security/a11y), npm publish, homelab deploy.

Live status: [`docs/agent-worklog.md`](docs/agent-worklog.md).

## License

MIT
