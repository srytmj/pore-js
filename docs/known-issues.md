# Known issues & bug log

Running list of bugs, limitations and papercuts — what's open, what got fixed,
and what's deliberately left alone. New entries at the top of each section.
Milestone plans (`docs/m*-plan.md`) hold the "why deferred" detail; this file is
the index.

Severity: 🔴 broken feature · 🟠 degraded / edge case · 🟡 papercut / nice-to-have

---

## Open — fix if/when motivated

### 🟡 No engine-level performance scenario harness

`size-limit` gates bundle size and `perf.test.ts` guards the pure hot-paths
(`buildSpreads`, search index, CFI). There's no measurement of **first-page
TTI, `paginate` ms, or peak heap** for a real 1000-page PDF / 400-chapter EPUB /
3000-image webtoon in a real browser — that needs Playwright +
`performance.measureUserAgentSpecificMemory()`. Follow-up, not `1.0`-blocking.
*(M8 H6)*

### 🟡 `porejs` "all engines" import is +130 kB if the bundler inlines dynamic imports

`createPdfEngine` reaches pdf.js only through a **dynamic `import()`**
(`pdf/parse.ts`). Vite / webpack / Rollup code-split it into a lazy chunk by
default (so `import { createPdfEngine }` costs ~4 kB up front; pdf.js loads when
a PDF opens). A bundler configured to inline dynamic imports, or `size-limit`
without the `ignore`, sees the full ~130 kB brotli. Not a bug — but worth a
louder note in `integration.md` and maybe a `porejs/pdf` subpath export so the
split is explicit. *(found M8 H6)*

### 🟠 No load-time guard rails on the engines

A source that hangs forever in `getManifest()` / `getFile()`, a manifest with
100 000 pages, or an image page 100 000 px wide will not crash (H4 proved the
parse layer is safe) but also won't time out or clamp — the reader just spins.
Planned as additive `<Reader>` options (`loadTimeoutMs`, `maxManifestPages`,
`maxPageDim`); own small task, not `1.0`-blocking. *(M8 H4)*

### 🟠 Firefox e2e unverified on the maintainer's Windows box

`browserType.launch: spawn UNKNOWN` — an AV / Mark-of-the-Web quarantine of the
Playwright Firefox binary, not a code issue. Firefox **is** in the CI matrix and
green there. If CI ever flags a real Firefox-only bug it lands here. To run
locally: reinstall (`pnpm --filter @pore/demo exec playwright install firefox`)
and unblock the `.exe`. *(M8 H5)*

### 🟠 PDF pages are larger on Safari / no-`OffscreenCanvas` browsers

The WebP → PNG fallback (needed because Safari can't encode WebP from a canvas)
roughly triples the per-page blob size. Fine for reading, heavier on the
`MediaCache` offline download. A JPEG fallback (`image/jpeg`, q≈0.85) would be a
middle ground. *(M8 H5)*

### 🟡 Annotations review / export–import only see "sample" books in the demo

They read the shared demo source; a dropped local file keeps its annotations but
isn't listed until re-opened. Demo-level limitation (the review is a
`useLibrary()` + demo-source thing), not a library one. *(M7 L3 / L4)*

### 🟡 `demo-pdf` opened right-to-left until M8

`DEFAULT_IMAGE_SETTINGS.direction` is `'rtl'` (manga-first). PDFs and Western
comics want `'ltr'`. Worked around per-sample in the demo; the engine default is
arguably wrong for a general PDF but flipping it is a behaviour change for
manga-first consumers. Revisit at the API freeze if not already. *(M8 H5)*

### 🟡 e2e flake: vertical-JP under parallel load

`vertical-JP EPUB reads right-to-left` occasionally times out at 30 s when the
3-browser matrix saturates the box; passes solo and on retry. Polls for a
settled transform already; could use a firmer readiness signal. *(M8 H5)*

---

## Fixed

### 🔴 Text selection / highlights / footnote taps were dead in Safari/WebKit — `7b70ab4` (M8 H5)

A sandboxed `<iframe>` without `allow-scripts` receives **no** input events in
WebKit. Fix: `sandbox="allow-same-origin allow-scripts"` + a strict in-frame CSP
(`script-src 'none'`) + `rewrite.ts` stripping `on*` / `javascript:` /
`<iframe|object|embed>` / `<meta http-equiv>`. Scripts still can't run.

### 🔴 PDF rendered nothing without `OffscreenCanvas` (Playwright WebKit, older Safari) — `7b70ab4` (M8 H5)

`pdf/parse.ts` `renderToBlob` now falls back to `HTMLCanvasElement`, and WebP →
PNG where the canvas can't encode WebP.

### 🔴 A corrupt / unreadable book showed a blank reader, not the error card — `c047e98` (M8 H4)

`<Reader>`'s mount effect `void`-ed its async work with no `try/catch` — a
rejecting `getManifest()` / `mount()` was an unhandled rejection + an empty
`<div>`. Now caught → error card.

### 🟠 PDF page-turn broke in the built demo (RTL default + physical input) — `4f2…` (post-M7)

Removing the Prev/Next buttons exposed that `demo-pdf` inherited the image
engine's `rtl` default, so keyboard/tap "forward" went backward. Fixed per-sample
(`settings: { direction: 'ltr' }`).

### 🟠 Highlights / Bookmarks panel covered the menu rail — `4f2…` (post-M7)

Rail defaults to the right edge; the panels were also `right`-anchored. They now
open on the opposite side (`highlights-panel--left`).

### 🟠 Native image drag navigated the page to the blob URL — (M6-era)

`img.draggable = false` + a `dragstart` guard in the image engine.

---

## Won't fix / by design

- **Author scripts in EPUBs never run.** CSP `script-src 'none'` + sandbox +
  `rewrite.ts`. Interactive EPUB3 widgets are out of scope.
- **No CJS build.** ESM-only (`docs/stability.md`).
- **The demo needs the network.** Offline-download UI was cut in M8 — the demo
  is served from a homelab; if the box is down, offline doesn't help. The
  library keeps `CachedSource` / `useDownload` for real consumers.
- **`porejs-react` ships no CSS.** Headless on purpose; style the `data-pore-*`
  hooks. `apps/demo/src/styles.css` is the worked example.
