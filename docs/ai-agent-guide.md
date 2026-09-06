# AI agent guide — start here

**If you are an AI agent working on this repo, read this file first.** It is the
map. It tells you what Pore.js is, where everything lives, how to run and verify
your work, the conventions you must follow, and what the current focus is.

---

## 1. What Pore.js is

A **source-agnostic web reader engine** for manga (image-based) and books
(EPUB, PDF, CBZ). The rendering + pagination engine is written from scratch —
it is *not* a wrapper around an existing reader library. PDF is the one
exception: it wraps **pdf.js** behind the same shell.

- **`packages/reader-core`** — TypeScript, framework-agnostic. Uses the DOM but
  **no React**. Sources, the image engine, the text (EPUB) engine, the PDF
  engine, position model, settings, search, offline cache.
- **`packages/reader-react`** — React 19 bindings: `<Reader>`, `<ReaderProvider>`,
  hooks, and **headless** components (`<SettingsPanel>`, `<TableOfContents>`,
  `<HighlightsPanel>`, …). Ships **no CSS** — consumers style it.
- **`apps/demo`** — the Vite demo. Bundled fixtures, no backend. This is the
  portfolio artifact and the thing you usually verify against.

It is "Project B" of two. Project A is **whitearchive** (a separate repo, a
library/connection platform); Pore.js can read from it via a `ReaderSource`,
but has zero knowledge of it otherwise.

---

## 2. Read these, in this order

| Doc | What it gives you |
|---|---|
| **this file** | the map, conventions, how to run/verify |
| [`agent-worklog.md`](agent-worklog.md) | **append-only journal** — what recent sessions did, why, current state. Read it if you did not continue from the original chat. **Append an entry when you finish a unit of work.** |
| [`../CLAUDE.md`](../CLAUDE.md) | commit rules (Conventional Commits, **owner is the only author — no AI attribution**), workspace scripts, milestone pointers |
| [`architecture.md`](architecture.md) | how the engines work inside — event model, `Locator`/`Position`, the sandboxed-iframe text engine, image virtualization, sources, search |
| [`integration.md`](integration.md) | how to *consume* the packages in an app — `<Reader>`, sources, hooks, headless components, custom `ReaderSource`, styling model |
| [`reader-engine-design.md`](reader-engine-design.md) | the original RFC — goals/non-goals, the source seam, position model, milestone history |
| [`image-engine-spec.md`](image-engine-spec.md) | deep spec for the image engine specifically |
| `m0-plan.md` … `m8-plan.md` | per-milestone task breakdowns with retro-notes on what was actually built and why |
| [`m8-plan.md`](m8-plan.md) | **the current milestone** — hardening, npm publish, demo deploy (→ `v1.0.0`) |
| [`known-issues.md`](known-issues.md) | bug log — open / fixed / won't-fix; add to it when you hit or fix a bug |

---

## 3. Repo map

```
packages/reader-core/src/
  index.ts            the entire public surface (large, intentionally flat)
  source/             ReaderSource interface + built-ins:
                        demo-source, local-file-source, cached-source (offline),
                        kavita-source, opds-source, + types.ts (Manifest, HighlightRecord)
  image/              image engine — create-image-engine.ts (~900 lines),
                        spreads, continuous (virtualization), page-loader, prefetch, input
  text/               EPUB engine — create-text-engine.ts (~1300 lines),
                        epub/ (parse, path), paginate (multicol math), anchor (resume),
                        cfi (epubcfi-shaped serialization), highlight, tts, rewrite
  pdf/                parse.ts (pdf.js wrap), pdf-source.ts, create-pdf-engine.ts,
                        pdf-highlights.ts (marquee overlay)
  position/           Position type + clamping
  settings/           settings + keymap + merge
  search/             search-index + worker controller
  offline/            media-cache, idb
  progress.ts         PaceEstimator ("N min left"), chapterProgress
  reader-engine.ts    Locator, common event names, Chapter, ReaderProgress

packages/reader-react/src/
  index.ts            public exports
  provider.tsx        <ReaderProvider source={...}>
  reader.tsx          <Reader>, ReaderHandle, ALL the hooks (useReader*, useTts, …)
  settings-panel.tsx / text-settings-panel.tsx   headless Radix Dialog + tabs
  table-of-contents.tsx / highlights-panel.tsx / footnote-popover.tsx
  scrubber.tsx        <ReaderScrubber> (bottom seek bar)
  primitives.tsx      Field / SelectField / SliderField / SwitchField / Tabs (Radix)
  announcer.tsx       <ReaderAnnouncer> (screen-reader live region)
  history.ts          useReaderHistory (URL + document.title reflection)
  gsap-adapter.ts     gsapAdapter(gsap) → ReaderTransitions
  use-download.ts     useDownload (offline)

apps/demo/src/
  main.tsx            entry — sets the pdf.js worker via setPdfWorkerSrc
  App.tsx             view state (landing | sample | file), source wiring
  Chrome.tsx          THE reader chrome — bar, scrubber dock, selection toolbar,
                        highlights panel wrapper, tts bar, end-page, footnote, toasts (~590 lines)
  Landing.tsx         the home screen (upload + sample modes)
  MenuBarSettings.tsx menu-bar placement/behaviour settings tab (M5)
  OpdsBrowser.tsx     OPDS catalog browser UI
  use-menu-bar.ts / use-fullscreen.ts / use-auto-hide.ts / theme.ts
  styles.css          ~740 lines — Tailwind v4 @theme tokens + EVERY component's CSS
  public/sw.js        service worker (offline shell + media cache)
  public/opds/catalog.xml   fixture OPDS feed
  e2e/reader.spec.ts  Playwright suite (~37 tests)
scripts/gen-fixtures.mjs   generates the demo image/epub/pdf fixtures (run on fresh clone)
```

---

## 4. How to run, test, verify

```bash
corepack enable && pnpm install
pnpm gen:fixtures        # once, on a fresh clone
pnpm dev                 # the demo (Vite) at http://localhost:5173  (set PORT to change)
pnpm build               # build packages — REQUIRED before running the demo against changed core/react code (demo consumes dist/)
pnpm test                # vitest, reader-core + reader-react (~256 tests)
pnpm typecheck           # tsc -b --force across the workspace
pnpm lint                # eslint
pnpm --filter @pore/demo e2e:install   # once — Playwright chromium
pnpm --filter @pore/demo e2e           # the full demo e2e suite
```

**Verification rules:**

1. **Rebuild packages before verifying demo behaviour.** The demo imports the
   built `dist/`, not the source. `pnpm build` (full, not per-package — a
   partial build wedges Vite's HMR: you get stale `dist/*.js` 404s and ghost
   engine instances). If HMR is already wedged:
   `rm -rf apps/demo/node_modules/.vite` and open a fresh browser tab.
2. **Run the full Playwright suite every milestone.** Unit tests + manual
   browser checks have both missed real bugs that only show under a wide
   viewport, real aria-name queries, or an actual reload cycle. See
   [`agent-worklog.md`](agent-worklog.md).
3. **Some things jsdom cannot test** — `iframe.contentDocument` after the mount
   tick, `Range.getBoundingClientRect()`, the Web Speech API. Those paths are
   proven by unit-testing the pure logic + injectable APIs, and by **browser
   verification** (drive the running demo, read the console/DOM, screenshot).
4. **Query buttons by accessible name**, never by glyph text — the e2e suite and
   screen readers both depend on `aria-label`. If you restyle the chrome, keep
   every button's `aria-label`.

---

## 5. Conventions (non-negotiable)

- **Conventional Commits**, enforced by a commitlint hook. House style:
  `type(scope): <CODE> — <description>` e.g. `feat(demo): D1 — calm reader bar`.
  Scopes: `core`, `react`, `demo`, `docs`. Types: `feat fix refactor chore docs
  test build ci perf`.
- **The repository owner is the only author.** Never add `Co-authored-by`,
  `Signed-off-by`, "Generated with…", or any AI/tool trailer. One author.
- **One logical change per commit.** Keep the milestone plan in `docs/` in sync
  in the same commit.
- **Append to [`agent-worklog.md`](agent-worklog.md)** when you finish a unit of
  work (a commit, a decision, a blocker): What / Why / State / Notes.
- Match the surrounding code's style, comment density, and naming.

---

## 6. Key invariants — do not break these

- **`reader-react` ships no CSS and stays headless.** Components render
  `data-pore-*` hooks and Radix primitives; the consumer owns every style. All
  demo styling is in `apps/demo/src/styles.css`.
- **No React inside the reader iframes, ever.** The text engine renders book
  content into a sandboxed `<iframe srcdoc>`; React owns only the chrome around
  it. (`docs/reader-engine-design.md` §11.)
- **The engine core is framework- and animation-library-agnostic.** Animation
  goes through the injected `ReaderTransitions` seam; the default is instant.
- **`Position` is the cross-device contract.** It round-trips through the source
  (`loadProgress`/`saveProgress`) and must stay JSON-stable. `Locator` is the
  richer read-model derived from it.
- **The reading-surface palette lives in two places that must move together:**
  `apps/demo/src/styles.css` `@theme` (the shell) and `THEME_COLORS` in
  `packages/reader-core/src/text/create-text-engine.ts` (injected into the
  iframe as `#pore-base-style`, plus `buildFixedLayoutStylesheet` / end-page).
- **`HighlightRecord` is a discriminated union** — `{kind:'text', range, cfi}`
  (EPUB) | `{kind:'rect', page, rects}` (PDF). Both persist through the same
  optional `ReaderSource.loadHighlights` / `saveHighlights`.
- **CFI here is "epubcfi-shaped", documented as pragmatic, not IDPF-conformant**
  (element-sibling steps only). Don't "fix" it to full conformance without a
  reason — see `text/cfi.ts` header.

---

## 7. Current focus — M8: hardening, publish, deploy (→ `v1.0.0`)

**[`docs/m8-plan.md`](m8-plan.md).** *Not a feature milestone.* M0–M7 got the
engines feature-complete (`v0.10.0-library`); M8 makes it dependable, embeddable
and public. H0 rename packages → **`porejs`** / **`porejs-react`** + Changesets
→ H1 freeze/document the public API (ESM-only) → **H2 embeddable in a host app**
(`examples/host-app/`, input-listener + singleton isolation audit,
`document.title` composition) → H3 real-content corpus
(`scripts/fetch-corpus.mjs`, `pnpm test:corpus`) → H4 robustness/fuzz → H5
Firefox + WebKit + e2e de-flake → H6 perf/size budgets → H7 iframe security +
a11y → H8 CI/CD + `npm publish --provenance` → H9 deploy the demo on the
owner's **homelab** (Dockerfile + compose, `pore.suryatmaja.dev`) → H10
per-package quickstarts + tag `v1.0.0`.

**Scope boundary for M8:** no new reader features. The offline-download control
(removed from the rail post-M7) is cut for good. F3b spreads stay deferred.

**Decisions locked (plan §Decisions):** names `porejs` / `porejs-react`;
`1.0.0-rc` through M8 then `1.0.0`; ESM-only; homelab deploy; offline-download
UI cut; corpus fetched + SHA-pinned. H9 needs the owner for the homelab + DNS.

<details><summary>earlier focus — M6 editorial redesign (done, <code>v0.9.0-editorial</code>)</summary>

Quiet/editorial aesthetic, accent-less, bundled Literata + Hanken Grotesk.
D0 tokens → D1 chrome → D2 panels → D3 landing → D4 font menu → D5 motion →
D6 responsive → D7 tag. `docs/design-language.md` is the token reference.

</details>

**UI / styling map** (what to edit for a visual change):

| To change… | Edit… |
|---|---|
| colours, spacing, type scale, fonts | `apps/demo/src/styles.css` `@theme` block + `@font-face`; mirror reading colours in `THEME_COLORS` |
| the reader bar / toolbar / toasts | `apps/demo/src/Chrome.tsx` + `.bar*` / `.selection-toolbar*` / `.scrubber-dock` / toast rules in `styles.css` |
| the settings panel layout | `styles.css` `.pore-settings*` + `packages/reader-react/src/primitives.tsx` (structure only, still headless) |
| the highlights panel | `styles.css` `[data-pore-hl-*]` rules; component is `packages/reader-react/src/highlights-panel.tsx` |
| the landing page | `apps/demo/src/Landing.tsx` + `.landing*` in `styles.css` |
| the menu-bar placement UI | `apps/demo/src/MenuBarSettings.tsx` + `.menubar-settings*` |
| the reading themes (light/sepia/dark/oled) | `THEME_COLORS` in `create-text-engine.ts` |

---

## 8. Milestone history

M0–M0.5 image engine · M1 text engine · M2 PDF + shared shell · M3 integration
(offline, search, vertical-JP, a11y flow mode) · UI foundation (`v0.6.0-ui`) ·
M4 annotations (`v0.7.0-annotate` — CFI, highlights, fixed-layout EPUB, OPDS,
TTS) · M5 reading comfort (`v0.8.0-comfort` — menu-bar placement/auto-hide,
highlight notes + `<HighlightsPanel>`, PDF Shift-drag highlights) · M6 editorial
redesign (`v0.9.0-editorial`) · M7 library & portability (`v0.10.0-library` —
bookmarks, home shelf, annotations review, export/import, `?cfi=` deep links) ·
**M8 hardening + publish + deploy — current** (→ `v1.0.0`).

Deferred: fixed-layout two-page spreads (F3b), bookmarks/library/export,
bottom-edge menu bar, OPDS 2.0, cross-device sync, `WhiteArchiveSource`.
