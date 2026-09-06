# Pore.js — M8 Plan (hardening, embed, publish, deploy)

**Goal:** take Pore.js from "feature-complete demo" to "a reader another site
can drop in." Freeze and document the public API, make the packages **cleanly
embeddable in someone else's web app** (a manga library, a comics site — they
provide a mount point + a content source, Pore.js is the whole reader), prove
the engines against **real-world content**, pass on **more than one browser**,
set perf/size budgets, tighten security + a11y, **publish `porejs` +
`porejs-react` to npm**, and **deploy the demo on the owner's homelab**. Ends at
**`v1.0.0`**.

**Not a feature milestone.** No new reader capabilities. The offline-download
control removed from the rail post-M7 is **cut for good** — the demo needs the
network for the library and the reader anyway; `useDownload` / `CachedSource`
MediaCache stay in the library for other consumers. F3b (fixed-layout spreads)
stays deferred.

**Design refs:** [`reader-engine-design.md`](reader-engine-design.md) §2 (the
source seam), §4/§11, [`adr/0001-core-surface.md`](adr/0001-core-surface.md)
(the surface this milestone finally freezes), [`integration.md`](integration.md),
[`architecture.md`](architecture.md). Builds on `v0.10.0-library`. Target tag:
**`v1.0.0`**.

Sequential-ish, one commit per task. H3–H7 are largely independent and can
reorder; H0–H2 come first, H8 needs them all, H9/H10 ship it.

---

## Decisions (2026-09-06)

1. **npm names — `porejs` (core) + `porejs-react`.** `pore` is taken; unscoped
   and consistent beats an unowned scope. `@pore/*` in the code → `porejs` /
   `porejs-react` in H0 (`apps/demo` stays private, name unchanged).
2. **`1.0.0-rc.1` through M8, cut `1.0.0` at H10** once corpus + cross-browser
   are green — the RC window is the last shake-out.
3. **ESM-only.** No CJS build; documented in H1.
4. **Deploy: the owner's homelab**, not a PaaS. H9 ships a `Dockerfile` +
   compose stanza; the homelab's reverse proxy serves it and
   `pore.suryatmaja.dev` points there.
5. **Offline-download UI: cut.** Not re-added. Engine support stays.
6. **Corpus: fetched + SHA-256 pinned**, not committed (bar the few-KB items).

---

## Why this order

```
H0 identity ─→ H1 API freeze ─→ H2 embeddable ─┐
                                               │
H3 corpus ─→ H4 robustness ────────────────────┼─→ H8 CI/CD ─→ H9 deploy ─→ H10 v1.0.0
H5 cross-browser + e2e de-flake ───────────────┤
H6 perf + size budget ─────────────────────────┤
H7 security + a11y hardening ──────────────────┘
```

`H0` sorts out names/versioning so nothing downstream churns. `H1` freezes what
`H8` publishes; `H2` proves that frozen surface is enough to embed. `H3`–`H7`
are the hardening and run in parallel. `H8` wires the pipeline, `H9` puts the
demo on the homelab, `H10` cuts `1.0.0`.

---

## H0 — Package identity & release tooling · S · **DONE**

- [x] **Renamed the packages** — the old `@pore/reader-core` → **`porejs`**,
      `@pore/reader-react` → **`porejs-react`** (folder names unchanged;
      `apps/demo` stays private `@pore/demo`). Every `name`, `workspace:*` dep,
      source import, `tsup` external, and doc mention. Lockfile regenerated.
- [x] Fixed `repository.url` (`srytmj/pore.js` → `srytmj/pore-js` `.git`);
      added `homepage`, `bugs`, `keywords`, `author`, and
      `publishConfig` (`access: public`, `provenance: true`) to both packages.
- [x] Bumped both publishable packages to **`1.0.0-rc.1`**.
- [x] Removed the dead `apps/demo/vercel.json` (deploy is the homelab now).
- [x] Per-package `README.md` + `LICENSE` (copy of root MIT); `files` is
      `["dist"]`, verified with `npm pack --dry-run`.
- [x] **Changesets** (`@changesets/cli`) — `.changeset/config.json`, a
      `CONTRIBUTING.md` note. `.npmrc` untouched (provenance rides on
      `publishConfig` + the CI OIDC in H8).

**Done when:** `npm pack --dry-run` shows a clean tarball with a real README,
and `pnpm changeset` works. ✓

---

## H1 — Freeze the public API · M · **DONE**

- [x] Audited both `index.ts` against ADR 0001. Trimmed `porejs` from ~180
      exports to **37 runtime + curated types**, grouped with section headers.
      Moved the plumbing (spread/tap/virtualization math, anchor + pagination
      internals, store/emitter, `PaceEstimator`, fixture-manifest parsing, TTS
      controller internals, low-level search index, EPUB path helpers) to a new
      **`porejs/internal`** entry (`src/internal/index.ts`, `"./internal"` in
      `exports`). tsup builds it as a 3rd entry with `splitting: true` so shared
      code is a chunk, not a duplicate (`internal.js` ≈ 1.4 KB). `VERSION` is
      now injected from `package.json` via tsup `define`.
- [x] **API-surface guard** — `src/public-api.test.ts` in both packages pins
      the sorted runtime export list; `porejs`'s also asserts `porejs/internal`
      stays disjoint. (Type-only exports aren't runtime-visible — reviewed by
      hand per `stability.md`.)
- [x] **`docs/stability.md`** — what `1.x` SemVer covers (runtime exports,
      `ReaderSource`, `Position` round-trip, record/`Manifest` shapes,
      `data-pore-*`, `reader:*` events, `<Reader>` props / hook shapes), what
      isn't (`porejs/internal`, type shapes, CSS, `@experimental`, the demo),
      ESM-only + pdfjs tree-shaking, deprecation policy.
- [x] ESM-only documented in `integration.md`; `porejs-react` no-CSS asserted by
      `scripts/verify-packages.mjs` (also: no `.map`/`.tsbuildinfo`/test files
      in the tarball, README + LICENSE present, built `VERSION` matches). Wired
      into `pnpm release` + a `verify:packages` script.
- [x] **Additive `Manifest` shapes landed** — `ManifestMeta` (`subtitle?`,
      `volume?: string | number`) mixed into `ImageManifest` + `TextManifest`,
      exported. The `useReaderHistory` title composition is H2.

**Done when:** the surface is deliberate, snapshotted, and `stability.md` says
what a `1.0` consumer can rely on. ✓ — 266 unit · 43 e2e green (search worker
still loads under the chunked build).

---

## H2 — Embeddable in a host app · M · **DONE**

- [x] **`examples/host-app/`** ("Inkwell") — a standalone Vite app: a fake manga
      library grid → clicking a volume mounts `<Reader>`. Its `LibrarySource`
      *fully* implements `ReaderSource` over the example's own catalog
      (`getManifest` maps the host record → `ImageManifest` with `volume` /
      `subtitle`; `getPage` returns generated SVG; `loadProgress` /
      `saveProgress` use `localStorage` under the host's **own** `inkwell:*`
      namespace). Own tiny stylesheet for the `data-pore-*` bits. Its own
      Playwright suite (3 specs) + config; wired into CI. In the pnpm workspace
      (`examples/*` added); `pnpm example` / `pnpm typecheck` cover it.
- [x] **Isolation audit — the engines were already clean.** No `window` /
      `document` listeners in `porejs` (all on the engine's own `root` / the
      iframe's `cdoc` / element `load`); `visibilitychange` is the one
      doc-level listener (passive read, removed on `destroy`). No mutable
      module-level singletons (pdf.js module memo + the in-worker index are
      correct). `porejs-react`: `useReaderHistory` (opt-in) touches
      `document.title` / `window.history`; `createSettingsPersistence` writes
      `localStorage` under `pore:settings:*` and is overridable
      (`persistSettings`). The example's e2e proves two books don't share
      state and no `porejs` stylesheet is injected.
- [x] **`useReaderManifest()`** added (new hook — `Manifest | null`); `<Reader>`
      now keeps the manifest in context. `ManifestMeta` (`subtitle?` /
      `volume?`) landed in H1.
- [x] **Document title** — `useReaderHistory` composes `Work · Vol N · Chapter`
      (or `Work · N%`, or the file name) from the manifest + resolved chapter
      label, with a `formatTitle?(ctx)` override (return `''` to leave the
      title to the host). Old `title` template kept + `@deprecated`.
- [x] **`integration.md`** — new §0 "Embedding in an existing site" (what you
      provide / what stays yours / the isolation guarantees), a `useReaderHistory`
      title section, `useReaderManifest` in the hooks table.
- [x] Playwright (`examples/host-app/e2e/embed.spec.ts`): open a volume, read
      via tap-zones, progress round-trips through the host source under its own
      namespace, reload → library → re-open resumes; a 2nd book starts fresh;
      no CSS shipped.

<details><summary>original scope</summary>

## H2 — Embeddable in a host app · M

The point of the library: a manga/comics/book site provides **a content source
and a mount point**, and gets the whole reader — pagination, themes, TOC,
highlights, bookmarks, search, TTS — without building any of it.

- [ ] **`examples/host-app/`** — a standalone minimal app (NOT the demo, no
      `apps/demo` chrome): a fake "library" page (grid of series) where
      clicking one mounts `<Reader>` in a panel. Its `ReaderSource` pulls from
      the example's *own* (fake) REST-ish API — `getManifest` / `getPage` /
      `getFile` / `loadProgress` / `saveProgress` + optional
      `loadHighlights` / `loadBookmarks`. Proves: implement one interface, get
      a reader.
- [ ] **Isolation audit + fixes:**
  - `porejs-react` ships zero CSS; the headless components carry only
    `data-pore-*` hooks. ✓ (assert in H1) — verify nothing leaks global styles.
  - the text engine's `<iframe sandbox>` keeps publisher CSS *inside*.
  - **engine input listeners are scoped to its own focused root**, never
    `document` / `window` — an embedded reader must not eat the host's
    keyboard shortcuts or scroll when it doesn't have focus. Audit
    `create-image-engine.ts` / `create-text-engine.ts`; fix any global binding.
  - **no module-level singletons / globals** that break a second `<Reader>` on
    the same page. Test two instances side by side.
  - all URL / `localStorage` writes are **opt-in** — `useReaderHistory`,
    `createSettingsPersistence` are things the host chooses to call; the host
    owns routing and persistence (via its `ReaderSource`).
- [ ] **Document title while reading.** `useReaderHistory` composes
      `document.title` from the manifest + current position:
  - a dropped local file → **the file name** (minus the `.epub` / `.cbz`);
  - a real work → **`<title> · Vol N · Ch M`** when the manifest / current
    chapter carry them (e.g. `Solo Leveling · Vol 2 · Ch 14`), else the title
    alone, else `<title> · N%`;
  - a `formatTitle?: (ctx) => string` option so an embedding host fully
    overrides it. `Manifest` gains optional `subtitle` / `volume` (chapter
    `label` already exists) — additive, lands in H1 before the freeze. The
    demo's ad-hoc `document.title` writes move onto this.
- [ ] **`integration.md`**: lead with the embed story — "implement
      `ReaderSource`, give `<Reader>` a `bookId` + a mount, style the
      `data-pore-*` bits, done", with the `examples/host-app` source as the
      worked example. A "what the host still owns" list (auth, the content API,
      routing, storage, layout around the reader).
- [ ] Playwright against `examples/host-app`: open a title, read, turn pages,
      progress round-trips through the host source, a second reader instance
      coexists.

**Done when:** `examples/host-app` is a believable third-party integration and
the reader provably doesn't reach outside its own box. ✓

</details>

---

## H3 — Real-world content corpus · M · **DONE (baseline — set can grow)**

- [x] **`scripts/fetch-corpus.mjs`** (`pnpm corpus:fetch`) — downloads the books
      in `test/corpus/sources.json` into `test/corpus/files/` (gitignored),
      sha256-verified (prints the hash on first fetch to pin).
- [x] **`test/corpus/corpus.test.ts`** — the `corpus` vitest project
      (`pnpm test:corpus`; also in `pnpm test`, **skips cleanly** when `files/`
      is empty — dynamic `import()` of built `porejs`, no `dist/` hard dep).
      Per book: `parseEpub` / `loadPdf` don't throw on the real structure ·
      spine + TOC + metadata sane · **every spine href resolves** ·
      `serializeCfi`→`parseCfi`→`resolveCfiElement` round-trips on a real spine
      doc · `SearchController` builds over the real text. (Full pagination stays
      on the e2e suites — jsdom can't run the iframe.)
- [x] **3 real books pinned** (owner approved the download): Gutenberg
      *Frankenstein* #84 (illustrated EPUB3), *Alice* #11 (illustrated),
      *Pride and Prejudice* #1342 (long, no-images). **9 tests green — no
      engine bug in the parse/CFI/search layer against real content.**
- [x] `test/corpus/README.md` + provenance; **CI `corpus` job** fetches
      (cached on `sources.json` hash) + runs `pnpm test:corpus`.
- [ ] *Grow the set later:* an RTL manga CBZ, a vertical-JP book, a real
      fixed-layout EPUB, an ≥ 800-page item, a messy/scanned PDF (Gutenberg
      has no reliable PDF URL — needs another source). Not blocking `1.0`.

**Done when:** `pnpm test:corpus` is green against real books. ✓ (baseline of 3;
widen as sources are found)

---

## H4 — Robustness / failure modes · M · **DONE (guard rails deferred)**

Never a blank screen — every bad input → a clean `reader:error` + the demo's
error card.

- [x] **Fixed the real bug:** `<Reader>`'s mount effect `void`-ed the async IIFE
      with **no `try/catch`** — a rejecting `source.getManifest()` or
      `engine.mount()` (corrupt file, dead API) was an unhandled rejection and a
      blank host `<div>`. Now both are caught → `setError` → `useReaderError` →
      the error card.
- [x] **`src/robustness.test.ts`** (15 cases) — `parseEpub` (empty / not-a-zip /
      truncated / no container.xml / bad container XML / missing OPF / malformed
      OPF / no spine), `LocalFileSource` (0-byte epub, non-zip cbz, unknown
      ext, `getPage` out of range), `loadPdf` (empty / not-a-pdf / truncated).
      **All already fail cleanly** — a real `Error` with a matching message, no
      raw `TypeError`, no hang. The parse layer was solid; the gap was purely
      the missing catch in `reader-react`.
- [x] e2e: drop a corrupt `.epub` → `role="alert"` "Couldn't load" card within
      seconds, "Back to start" still works (no white screen).
- [ ] **Guard rails deferred** (not `1.0`-blocking, tracked): a page-dimension
      clamp (a 100 000-px page shouldn't OOM the tab), a configurable
      `getManifest` / `getFile` load timeout (a hung content API), a max
      manifest size. These are additive `<Reader>` opts / engine settings —
      their own small task.

**Done when:** the fuzz table is green and a corrupt file can't white-screen. ✓

---

## H5 — Cross-browser + e2e de-flake · M

- [ ] Playwright **projects** for `firefox` and `webkit` next to `chromium`.
- [ ] Fix breakage: multicol pagination math, **Custom Highlight API → `<mark>`
      fallback** (Safari), `env(safe-area-inset-*)`, Fullscreen API diffs,
      `srcdoc`+`sandbox` quirks, `ResizeObserver` timing.
- [ ] **Support matrix** in `README.md` (Chromium / Firefox / Safari + min
      versions; iOS Safari notes).
- [ ] **De-flake**: replace `waitForTimeout`s and the `turn()` focus race (hit
      in the post-M7 trim) with state polling; `trace: on-first-retry`; 1 retry
      in CI only. Target: 3 consecutive green full runs.

**Done when:** the full e2e suite passes on all three engines, 3× in a row.

---

## H6 — Performance & size budget · S–M

- [ ] Scenario harness: 1000-page PDF, ~400-chapter EPUB, ~3000-image webtoon —
      first-page TTI, `paginate` ms, peak JS heap under virtualization, spread
      rebuild time.
- [ ] **`size-limit`** on `porejs` (with and without `pdfjs-dist` in the graph)
      and `porejs-react`; commit the numbers as budgets.
- [ ] Document the **pdf.js code-split** in `integration.md` (`setPdfWorkerSrc`,
      lazy `import()`); `porejs` without PDF should tree-shake `pdfjs-dist`.
- [ ] Perf smoke in CI (soft-fail / annotation only).

**Done when:** budgets are written down and CI flags regressions.

---

## H7 — Security & a11y hardening · M

- [ ] **Security review** of the text-engine iframe: `sandbox` has no
      `allow-scripts`, `rewrite.ts` covers every external ref, no author JS or
      top-navigation possible. A **CSP recipe** for host apps in
      `integration.md`. Document the EPUB-HTML trust model (publisher CSS on by
      default; scripts never run).
- [ ] **`docs/accessibility.md`**: a full keyboard-only walkthrough (open →
      read → TOC → highlight → bookmark → settings → search → home), an NVDA +
      VoiceOver pass (findings, not "ran axe"), `prefers-reduced-motion` and
      `forced-colors` audits.
- [ ] Broaden axe past the smoke checks; fix real violations.

**Done when:** the iframe threat model is documented and a keyboard-only user
can do everything the demo offers.

---

## H8 — CI/CD + publish pipeline · S

- [ ] CI matrix: node 20 + 22; the `e2e` job runs chromium + firefox + webkit;
      add the API-surface guard, `size-limit`, coverage upload.
- [ ] **`release.yml`** — `changesets/action`: merge to `main` opens/updates a
      "Version Packages" PR; merging *that* runs `pnpm -r publish --provenance
      --access public` (publishes `porejs` + `porejs-react`), pushes tags, and
      builds + pushes the demo image to GHCR (H9).
- [ ] Playwright HTML report + traces as failure artifacts.
- [ ] Doc: required status checks + branch protection for `main`.

**Done when:** merging a release PR publishes both packages with provenance,
tags the repo, and pushes a fresh demo image — no manual steps.

---

## H9 — Deploy the demo (homelab) · S · *needs the owner*

- [ ] **`apps/demo/Dockerfile`** — multi-stage: install → `pnpm gen:fixtures`
      → `pnpm --filter @pore/demo build` → copy `dist` into `nginx:alpine` /
      `caddy`. Static config: SPA fallback to `index.html`, immutable
      long-cache for hashed `/assets/*`, no-cache for `index.html` + `sw.js`,
      correct `Content-Type` for `.webmanifest` and pdf.js `.wasm`.
- [ ] **`docker-compose.yml`** stanza (or a `docker run` note) for the homelab
      — one container, one port, `/` healthcheck.
- [ ] Verify base-path / asset URLs at the deployed origin (Vite `base` if not
      `/`).
- [ ] **Installable PWA** — `manifest.webmanifest` + maskable icons +
      `theme-color`. Lightweight: no offline-first goal; `sw.js` caches the app
      shell for a fast repeat load + an update prompt.
- [ ] **`release.yml` pushes the image to GHCR** on the `v*` tag; the homelab
      pulls it (watchtower / webhook / manual — owner's call).
- [ ] Owner points **`pore.suryatmaja.dev`** at the homelab (tunnel or
      port-forward + reverse proxy) — DNS + proxy is the owner's.
- [ ] `README.md`: screenshots + a short demo GIF + the live link.

**Done when:** `docker compose up` on the homelab serves the demo at
`https://pore.suryatmaja.dev`, and the image rebuilds on tag.

---

## H10 — Docs & `v1.0.0` · S

- [ ] Per-package `README.md` with a real 10-line quickstart — for
      `porejs-react` the quickstart **is the embed story** (implement
      `ReaderSource`, mount `<Reader>`).
- [ ] **`docs/getting-started.md`** — add `<Reader>` to a fresh Vite/Next app;
      the manga-library host is the running example (cross-link
      `examples/host-app`).
- [ ] API reference: typedoc into `docs/api/` (or a hosted link).
- [ ] README badges: CI, npm version (`porejs`, `porejs-react`), bundle size,
      license.
- [ ] `CHANGELOG.md` `## v1.0.0`; Changesets `1.0.0-rc.* → 1.0.0`; tag
      **`v1.0.0`**.
- [ ] Flip "current milestone" pointers: `CLAUDE.md`, `README.md`,
      `docs/ai-agent-guide.md`, `docs/agent-worklog.md`.

**Done when:** `npm i porejs-react`, follow getting-started, and a working
reader is on screen inside a host app — and `v1.0.0` is tagged and published.

---

## Cut from M8 / still deferred

- **F3b — fixed-layout two-page spreads.** Engine reshape; its own milestone.
- **Offline-download demo UI.** Cut (engine support stays).
- **CJS build.** ESM-only unless a real consumer blocks on it.
- **Cross-device sync / a backend.** Project A (`WhiteArchiveSource`).
- **Import from KOReader / Calibre / Readwise**, **collections / tags / reading
  goals**, **bottom-edge menu bar**, **OPDS 2.0** — unchanged cut list.
- **Storybook / component playground** — nice, not `1.0`-blocking.
