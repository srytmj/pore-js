# Pore.js — M8 Plan (hardening, deploy, publish)

**Goal:** take Pore.js from "feature-complete demo" to "a thing people can
actually depend on." Freeze and document the public API, prove the engines
against **real-world content** (not just synthetic fixtures), pass on **more
than one browser**, set performance/size budgets, tighten security + a11y,
**publish `@pore/reader-core` + `@pore/reader-react` to npm**, and **deploy the
demo** at a public URL. Ends at **`v1.0.0`**.

**Not a feature milestone.** No new reader capabilities. The one allowed
product change is re-homing the offline-download control (removed from the rail
in the post-M7 trim) — see H8 / open question 5. F3b (fixed-layout spreads)
stays deferred.

**Design refs:** [`reader-engine-design.md`](reader-engine-design.md) §4/§11,
[`adr/0001-core-surface.md`](adr/0001-core-surface.md) (the surface this
milestone finally freezes), [`integration.md`](integration.md),
[`architecture.md`](architecture.md). Builds on `v0.10.0-library`. Target tag:
**`v1.0.0`**.

Sequential-ish, one commit per task. H2–H6 are largely independent and can
reorder; H0/H1 come first, H7 needs them all, H8/H9 ship it.

---

## Why this order

```
H0 identity ─→ H1 API freeze ─────────────┐
                                          │
H2 corpus ─→ H3 robustness ───────────────┼─→ H7 CI/CD ─→ H8 deploy ─→ H9 v1.0.0
H4 cross-browser + e2e de-flake ──────────┤
H5 perf + size budget ────────────────────┤
H6 security + a11y hardening ─────────────┘
```

`H0` sorts out names/versioning so nothing downstream churns. `H1` freezes what
`H7` will publish. `H2`–`H6` are the actual hardening and can run in parallel.
`H7` wires the pipeline. `H8` puts the demo online. `H9` cuts `1.0.0`.

---

## H0 — Package identity & release tooling · S

- [ ] **Settle the npm name** (open question 1). Check whether `@pore` org is
      claimable; if not, `@surytmj/reader-core` / `@surytmj/reader-react`, or
      unscoped `porejs` / `porejs-react`. Rename package `name`s, all
      `workspace:*` refs, imports in `apps/demo`, and every `@pore/…` in docs.
- [ ] Fix `repository.url` (`srytmj/pore.js` → `srytmj/pore-js`), add
      `homepage`, `bugs`, `keywords`, `publishConfig.access: "public"` to the
      two publishable packages.
- [ ] Per-package `README.md` + `LICENSE` (copy root MIT) so the npm page isn't
      blank. `files` already `["dist"]` — verify `dist` is the only thing
      packed (`npm pack --dry-run`).
- [ ] Add **Changesets** (`@changesets/cli`) — `pnpm changeset`, config,
      `CONTRIBUTING` note. Bump the three packages to **`1.0.0-rc.1`**
      (`apps/demo` stays private/unversioned).
- [ ] `.npmrc` / `provenance` groundwork for H7.

**Done when:** `npm pack --dry-run` in each package shows a clean, minimal
tarball with a real README, and `pnpm changeset` works.

---

## H1 — Freeze the public API · M

- [ ] Audit `reader-core/src/index.ts` + `reader-react/src/index.ts` against
      **ADR 0001**. Anything not meant to be public → stop exporting or move
      behind an `/internal` subpath. Write down what each export is *for*.
- [ ] **API-surface guard**: a snapshot test (hand-rolled
      `expect(sortedExportNames).toMatchSnapshot()` per package, or
      `@microsoft/api-extractor`) so an accidental export fails CI. Run in the
      `check` job.
- [ ] **ESM-only, on purpose** (open question 3): document it in
      `integration.md` ("Node ≥ 20, `"type": "module"`; no CJS build"). Revisit
      only if a real consumer needs CJS.
- [ ] **`docs/stability.md`** — what `v1.x` SemVer covers (the two packages'
      documented exports, `data-pore-*` hooks, event names, `Position` /
      `HighlightRecord` / `Bookmark` shapes), what is `@experimental`
      (`OpdsSource` 2.0 bits, TTS voices, anything marked), and the
      deprecation policy.
- [ ] `reader-react` still ships **no CSS** — assert it (`dist` has no `.css`).

**Done when:** the exported surface is deliberate, snapshotted, and
`stability.md` says what a `1.0` consumer can rely on.

---

## H2 — Real-world content corpus · M

The engines have only ever seen `scripts/gen-fixtures.mjs` output. That is the
biggest unknown before `1.0`.

- [ ] **`scripts/fetch-corpus.mjs`** — pulls a small set of **public-domain /
      openly-licensed** books into `fixtures/corpus/` (gitignored), verified by
      SHA-256:
  - a Standard Ebooks EPUB3 (rich CSS, footnotes, TOC depth)
  - a Project Gutenberg EPUB (old-school, messy markup)
  - a real **fixed-layout** EPUB (children's / comic)
  - a genuine **RTL manga** CBZ and a **vertical-JP** book
  - a multi-column / scanned **PDF** and a text PDF with an outline
  - one deliberately **huge** item (≥ 800 pp)
- [ ] **`pnpm test:corpus`** (Vitest, tagged, not in the default `test` run):
      for each — `getManifest` → paginate → generate an anchor mid-book →
      re-resolve it → `serializeCfi`/`parseCfi`/`resolveCfiElement` round-trip
      → run a search → assert nothing throws and positions are plausible.
- [ ] Commit only the tiny ones; CI fetches the rest (cached by hash).
- [ ] File a bug per real breakage found; fix the cheap ones here, defer the
      rest with a note.

**Done when:** `pnpm test:corpus` is green against a dozen real books and any
deferred breakage is written down.

---

## H3 — Robustness / failure modes · M

Never a blank screen. Every bad input → a clean `reader:error` + the demo's
error card.

- [ ] Table-driven tests per source/engine: truncated ZIP, not-a-ZIP, 0-byte,
      wrong extension/MIME, missing/ः malformed OPF, `container.xml` with no
      rootfile, cyclic or dangling TOC `href`, CBZ with non-image entries,
      encrypted PDF, PDF with 0 pages, an image page 100000 px wide.
- [ ] Each returns/emits an error with a useful `message` and (where known) a
      page/spine index — no unhandled rejection, no thrown-through.
- [ ] e2e: drop a junk file → the demo shows the error card, Home still works.
- [ ] Guard rails: max manifest size, max page dimension clamp, a load timeout.

**Done when:** the fuzz table is green and a corrupt file can't white-screen
the reader.

---

## H4 — Cross-browser + e2e de-flake · M

- [ ] Playwright **projects** for `firefox` and `webkit` alongside `chromium`.
- [ ] Fix what breaks: CSS multicol pagination math, **Custom Highlight API →
      `<mark>` fallback** (Safari), `env(safe-area-inset-*)`, Fullscreen API
      differences, `srcdoc` + `sandbox` quirks, `ResizeObserver` timing.
- [ ] **Support matrix** in `README.md` (Chromium / Firefox / Safari + min
      versions; iOS Safari notes).
- [ ] **De-flake**: replace timing `waitForTimeout`s and the `turn()` focus
      race (found in the post-M7 trim) with state polling; `trace: on-first-retry`;
      1 retry in CI only. Target: 3 consecutive green full runs.

**Done when:** the full e2e suite passes on all three engines, 3× in a row.

---

## H5 — Performance & size budget · S–M

- [ ] Scenario harness: 1000-page PDF, ~400-chapter EPUB, ~3000-image webtoon.
      Measure first-page TTI, `paginate` ms, peak JS heap under continuous
      virtualization, spread rebuild time.
- [ ] **`size-limit`** on `@pore/reader-core` (with and without `pdfjs-dist` in
      the graph) and `@pore/reader-react`; commit the numbers as budgets.
- [ ] Document the **pdf.js code-split** story in `integration.md`
      (`setPdfWorkerSrc`, lazy `import()`), and that `reader-core` without PDF
      should tree-shake `pdfjs-dist` out.
- [ ] A perf smoke in CI (soft-fail / annotation only).

**Done when:** budgets are written down and CI flags regressions.

---

## H6 — Security & a11y hardening · M

- [ ] **Security review** of the text engine iframe: confirm `sandbox` has no
      `allow-scripts`, resource rewrite (`rewrite.ts`) covers every external
      ref, no author JS or top-navigation is possible. A **CSP recipe** for
      host apps in `integration.md`. Document the EPUB-HTML trust model
      (publisher CSS on by default; scripts never run).
- [ ] **`docs/accessibility.md`**: a full keyboard-only walkthrough of the demo
      (open → read → TOC → highlight → bookmark → settings → search → home),
      a screen-reader pass with NVDA + VoiceOver (findings, not just "ran
      axe"), `prefers-reduced-motion` and `forced-colors` audits.
- [ ] Broaden axe past the current smoke checks; fix real violations.

**Done when:** the iframe threat model is documented, and a keyboard-only user
can do everything the demo offers.

---

## H7 — CI/CD + publish pipeline · S

- [ ] CI matrix: node 20 + 22; the `e2e` job runs chromium + firefox + webkit.
      Add the API-surface guard, `size-limit`, coverage upload.
- [ ] **`release.yml`** — `changesets/action`: on merge to `main` it opens/updates
      a "Version Packages" PR; merging that PR runs
      `pnpm -r publish --provenance --access public` and pushes git tags.
- [ ] Playwright HTML report + traces as artifacts on failure.
- [ ] Doc: required status checks + branch protection for `main`.

**Done when:** merging a release PR publishes both packages to npm with
provenance, tagged, no manual steps.

---

## H8 — Deploy the demo · S · *needs the owner*

- [ ] **Pick a host** (open question 4) — recommend **Cloudflare Pages**
      (free, global, simple custom domain, good cache control); GitHub Pages is
      the fallback.
- [ ] Build pipeline runs `pnpm gen:fixtures` before `vite build`; verify
      base-path / asset URLs on the target origin.
- [ ] **PWA finish**: `manifest.webmanifest` + maskable icons + `theme-color`,
      the existing `sw.js` precaches the built shell (offline-capable landing +
      last book), an update prompt. Lighthouse PWA + perf pass.
- [ ] **Re-home the offline-download control** (open question 5): a small
      toggle in the Settings accordion (`useDownload` is still wired), or
      formally cut the feature. Recommend: re-add, so "download for offline"
      is demoable.
- [ ] Cache headers (immutable hashed assets, revalidate `index.html` + `sw.js`).
- [ ] Deploy Action; wire **`pore.suryatmaja.dev`** (DNS is the owner's).
- [ ] `README.md`: screenshots + a short demo GIF, and the live link.

**Done when:** `https://pore.suryatmaja.dev` serves the demo, installs as a
PWA, and works offline after first load.

---

## H9 — Docs & `v1.0.0` · S

- [ ] Per-package `README.md` with a real 10-line quickstart (not "clone and
      run the demo").
- [ ] **`docs/getting-started.md`** — add `<Reader>` to a fresh Vite/Next app,
      wire a source, style the headless bits.
- [ ] API reference: typedoc into `docs/api/` (or a hosted link).
- [ ] README badges: CI, npm version, bundle size, license.
- [ ] `CHANGELOG.md` `## v1.0.0`; Changesets bump `1.0.0-rc.* → 1.0.0`; tag
      **`v1.0.0`**.
- [ ] Flip "current milestone" pointers: `CLAUDE.md`, `README.md`,
      `docs/ai-agent-guide.md`, `docs/agent-worklog.md`.

**Done when:** `npm i @pore/reader-react` + the getting-started guide gets a
working reader on screen, and `v1.0.0` is tagged and published.

---

## Cut from M8 / still deferred

- **F3b — fixed-layout two-page spreads.** Engine reshape; its own milestone.
- **CJS build.** ESM-only unless a real consumer blocks on it.
- **Cross-device sync / a backend.** Project A (`WhiteArchiveSource`).
- **Import from KOReader / Calibre / Readwise**, **collections / tags /
  reading goals**, **bottom-edge menu bar**, **OPDS 2.0** — unchanged cut list.
- **A component playground / Storybook** — nice, not `1.0`-blocking.

---

## Open questions — settle before H0

1. **npm name.** Can we get the `@pore` org? If not: `@surytmj/*` (matches the
   GitHub handle) or unscoped `porejs` / `porejs-react`. *Leaning:* try
   `@pore`, fall back to `@surytmj/*`.
2. **`1.0.0` now, or stay `0.x`?** The API has moved every milestone. *Leaning:*
   publish `1.0.0-rc.1` during M8, cut `1.0.0` at H9 once the corpus +
   cross-browser runs are green — the RC period *is* the last shake-out.
3. **ESM-only?** *Leaning:* yes, document it, don't build CJS.
4. **Deploy host.** *Leaning:* Cloudflare Pages.
5. **Offline-download UI.** Re-add as a Settings toggle, or cut the feature
   from the demo entirely? *Leaning:* re-add (small), the engine support is
   already there.
6. **Corpus in-repo vs fetched.** *Leaning:* fetch + SHA-256 (light repo, no
   licensing drift); commit only the few-KB items.
