# Pore.js — M4 Plan (annotations, fixed-layout, OPDS, TTS)

**Goal:** the "cut for v1" list from the design doc §14 — `epubcfi`-precise text
ranges, highlights & notes, fixed-layout EPUB, an `OpdsSource`, and a TTS
stretch goal. This is genuinely new surface area, not a fundamentals gap —
scope and sequence below before any code lands.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §5 ("CFI is a
stretch goal"), §7 ("Search, selection, footnotes"), §12 (fixed-layout risk),
§14 ("M4+ — CFI, highlights/notes, TTS, fixed-layout, OPDS source") · builds on
`v0.6.0-ui` + the post-UI follow-ups (scrubber, PDF search, RTL confirmation,
end-page restyle). Target tag: `v0.7.0-annotate`.

Sequential, one commit per task, same as every milestone so far. **Not
started** — this doc is the scope for discussion before F1 begins.

---

## Why this order

```
F1 (precise ranges) ─→ F2 (highlights & notes)
F3 (fixed-layout)   ─┐
F4 (OPDS source)     ├─→ F6 (hardening + release)
F5 (TTS, stretch)   ─┘
```

F2 needs character-level range addressing to persist a highlight's exact
start/end — today's `anchor.offset` is always `0` (a deferred sliver since
M0.5). F1 closes that gap first. F3/F4/F5 are independent of each other and of
F1/F2; they can reorder or drop without blocking the others.

---

## F1 — Precise text ranges (`epubcfi`-flavored) · M · done (v0.7.0-annotate wip)

- [x] Extend `anchor.ts`: `generateAnchor` records a real character `offset`
      into the resolved block via `offsetForVisibleWord` (word-level Range walk
      over text nodes, not full-character precision — cheap and sufficient for
      resume/highlight-anchor purposes). `resolveAnchor` resolves it back via
      `rangeAtOffset`, falling back to whole-block resolution when the range
      has no layout signal (jsdom, or a drifted document). Fully backward
      compatible — offset `0` behaves exactly as before.
- [x] `serializeCfi(doc, spineIndex, spineIdref, el, offset) → string` /
      `parseCfi(cfi) → ParsedCfi` / `resolveCfiElement` / `resolveCfiRange` in
      new `cfi.ts` — a **documented, pragmatic CFI-shaped serialization**, not
      full IDPF conformance: element-sibling-only step numbering (ignores
      interleaved text-node steps) and the conventional `/6/` package→spine
      assumption. Round-trips through nested inline markup (em/strong/a).
      (Skipped the separate `RangeAnchor` type — a single-offset CFI covers
      the resume-position use case F1 targets; F2 can add a range pair when
      highlights need start+end.)
- [x] `TextEngine.getCfi(): string | null` wired end-to-end: engine → 
      `reader-react`'s `ReaderHandle` → a real demo feature (🔗 "Copy position"
      button in `Chrome.tsx`, EPUB-only) — browser-verified producing
      `epubcfi(/6/6[c3]!/2/2/2:0)` for a real reading position.
- [x] Fallback cascade on resolve: exact offset-range → whole block → (existing
      percent fallback further up the stack) — same pattern as before.
- [x] Vitest: `anchor.test.ts` (+8 tests: `offsetForVisibleWord`,
      `rangeAtOffset`, offset-precision generate/resolve incl. the
      no-layout-signal fallback) and new `cfi.test.ts` (8 tests: step
      round-trip, serialize/parse, escaping, nested inline markup, drift →
      null). 199 total tests passing, lint/typecheck clean.

**Done when:** a highlight's start/end survives a reload and a re-render at a
different font size, and its CFI string is one a spec-reader would accept. —
met for the single-position case (resume/share-position); highlight start+end
pairing is F2's job.

---

## F2 — Highlights & notes · L · done for EPUB (v0.7.0-annotate wip); PDF cut below

- [x] Selection bridge: `selectionchange` inside the sandboxed iframe →
      debounced 150ms → `reader:selection` (`{ rect, text } | null`) — the
      demo renders a floating "highlight this" toolbar off it (color swatches;
      no note editor yet, see cut below)
- [x] `TextEngine.addHighlight(opts?: { color?, note? })` / `removeHighlight(id)`
      / `listHighlights(): HighlightRecord[]`; persisted through `ReaderSource`
      as a new `HighlightRecord[]` — **not** `Position`, a parallel per-book
      collection (`loadHighlights`/`saveHighlights`, optional so existing
      sources don't need to implement it). `CachedSource` implements both
      (mirrors its existing local-first `saveProgress` pattern), so the demo's
      `CachedSource(DemoSource())` persists highlights for free.
- [x] Highlight endpoints addressed the same way `Position['anchor']` is
      (block ordinal + flattened-text offset), just with a start/end pair —
      new `HighlightRange` type + `text/highlight.ts` (`locateOffset`/
      `offsetOfPoint`/`rangeForHighlight`/`highlightRangeFromSelection`).
      Each endpoint also gets its own `epubcfi(...)` via F1's `serializeCfi`,
      stored as `HighlightRecord.cfi.{start,end}` for interchange.
- [x] Render: CSS Custom Highlight API (`CSS.highlights.set(...)` +
      `::highlight(...)` CSS) when available; `<mark>` fallback (wrapped via
      `Range.surroundContents`, silently skipped — still persisted — for a
      selection spanning more than one element, which `surroundContents`
      can't wrap) otherwise.
- [x] A highlights panel in the demo (`Chrome.tsx`) — list, jump-to (via
      `goto({ type: 'anchor', ... })`), remove. Kept as plain demo markup
      rather than a `reader-react` component, since a full editor UI (notes,
      color re-pick) is deferred — see cut below.
- [x] **Found and fixed while verifying jump-to in a real (wide) browser
      window**: `pageForElement`/`resolveAnchor`/`generateAnchor` divided a
      block's raw `getBoundingClientRect().left` by `pageStep` assuming page 0
      starts at `left: 0` — true only when the reading column fills the whole
      iframe. On a desktop-width window `#pore-viewport` is horizontally
      centred, so every anchor resolved to the wrong page by however wide that
      centring gap was. Fixed with `relRectOf`/`relRangeRectOf` in
      `create-text-engine.ts` (subtract `#pore-viewport`'s own
      `getBoundingClientRect().left` before dividing) — this was a **pre-existing
      bug affecting the M0.5 resume-position feature and F1's `getCfi()` too**,
      just invisible at narrow widths where the centring gap happens to be ~0
      (like the ~800px browser tab F1 was verified in). Now correct at any
      width; all 211 tests still pass (the jsdom suite never exercises real
      layout, so it couldn't have caught this — browser verification did).
- [x] Vitest: `highlight.test.ts` (7 tests — offset/range helpers against fake
      documents, same pattern as `anchor.test.ts`/`cfi.test.ts`); `CachedSource`
      highlight persistence (3 tests); `create-text-engine` highlight tests (2 —
      no-selection returns `null`/never throws, and a full add→persist→reload→
      remove round trip that self-skips its deep assertions when jsdom's
      iframe selection isn't available, same documented limitation as
      `getCfi`'s test). Browser-verified end-to-end: select → highlight →
      painted → persisted across reload → listed in the panel → jump-to lands
      on the right page → remove.

**Done when:** select text in the demo EPUB, highlight it, reload, it's still
there and click-to-jump works. — met. Note-taking UI, PDF highlights, and a
dedicated `reader-react` highlights-panel component are cut to a follow-up
(below); the `HighlightRecord.note` field and engine API already support a
note, so that follow-up is UI-only.

**Cut from this pass (tracked, not blocking F1→F3/F4/F5/F6):**
- **PDF rect-based highlights** — `createPdfEngine` doesn't get `addHighlight`
  in this pass; it needs its own page+bbox addressing (via pdf.js's text
  layer) distinct from the EPUB block/offset scheme, sized like its own
  follow-up task rather than folded into F2's EPUB work.
- **Note editor UI** — the API (`{ note?: string }`) and storage
  (`HighlightRecord.note`) exist; the demo doesn't yet have a way to type one
  in (would need a small popover/textarea, deferred to avoid a `window.prompt`
  UX compromise).
- **A `reader-react` highlights-panel component** — today it's plain markup in
  the demo's `Chrome.tsx`; extracting a headless component (like
  `<TableOfContents>`) is worth doing once the note editor exists too, so it's
  one extraction instead of two.

---

## F3 — Fixed-layout EPUB · M · done (v0.7.0-annotate wip); spreads cut below

Went with the **live-iframe** path from open question #2, not the
snapshot-to-canvas/image-engine adapter originally sketched below — F2's
highlight/selection mechanics are DOM-range-based, and a live iframe keeps
those working on fixed-layout books for free (a canvas snapshot would have
needed its own rect-based highlight scheme, duplicating F2). The `<meta
name="viewport">`-driven scale-to-fit turned out simple enough that the
adapter/image-engine detour wasn't worth it.

- [x] Detect `rendition:layout="pre-paginated"` (`EpubMetadata.fixedLayout`,
      already sniffed since M0.5/`LocalFileSource`) — `mount()` no longer
      rejects it with an error; `create-text-engine.ts` branches on
      `fixedLayoutActive()` throughout (`measure`/`applyPage`/`injectStyle`/
      `anchorFor`/`resolvePendingAnchor`) instead of the reflow/multicol path.
- [x] One page per spine item (no sub-paging — `estimateSpinePages` returns 1),
      scaled + centred via a live `transform: translate(...) scale(...)` on
      `#pore-flow` recomputed on resize; new pure helpers in `paginate.ts`:
      `parseFixedViewportMeta` (reads the page's own `<meta name="viewport"
      content="width=…,height=…">`), `fixedLayoutScale`,
      `buildFixedLayoutStylesheet`. Author CSS is never stripped for a
      fixed-layout book regardless of the `publisherStyles` setting —
      positioning is entirely author-CSS-driven.
- [x] A synthetic fixed-layout fixture (`demo-fixed`, kids'-book-style: 4
      pages, absolutely-positioned panel + title, `pre-paginated` OPF meta) in
      `scripts/gen-fixtures.mjs`, wired into the demo's book picker.
- [x] Vitest: `paginate.test.ts` (+7: viewport-meta parsing, scale/centre math,
      stylesheet shape) and `create-text-engine.test.ts` (+2: layout
      detection + one-page-per-spine navigation, settings/resize don't throw).
      Browser-verified at both desktop (1280px) and narrow (500px) widths —
      correct centring and aspect-ratio-preserving scale at both.
- [x] **Found and fixed while browser-verifying**: the first cut left body/html
      unsized in `buildFixedLayoutStylesheet`, so a fixed-layout page's own
      author CSS (routinely `body{width:750px;height:1000px}`, since it's
      normally sized to the exact page) constrained `#pore-viewport`'s
      `width:100%` to that instead of the actual (usually wider) reader
      window. Fixed with an explicit `width:100% !important;height:100%
      !important` on the injected `html, body` rule.

**Cut from this pass:**
- **Spread pairing** (`rendition:page-spread-left|right` → two-page display) —
  needs either two iframes shown side-by-side or one iframe spanning two
  spine items, real added complexity for a "beta" fixed-layout feature;
  tracked as a follow-up once single-page fixed-layout has seen real use.
- **`OpdsSource`/canvas-snapshot adapter** — superseded by the live-iframe
  approach above; not needed.

**Done when:** a fixed-layout EPUB opens and pages like a comic, not a broken
reflow. — met, for single-page (non-spread) fixed-layout books.

---

## F4 — `OpdsSource` · M

- [ ] `OpdsSource(baseUrl, { auth? })` implementing a **catalog + acquisition**
      surface distinct from `ReaderSource` (OPDS is a *library* protocol, not a
      per-book one) — `listCatalog(url?) → { entries, next? }`,
      `acquire(entry) → ReaderSource` for whichever entry the user opens
      (delegates to `LocalFileSource`-style handling once the acquisition link
      resolves to bytes)
- [ ] Auth: HTTP Basic (OPDS's common case) + an escape hatch for a bearer
      token, since Kavita's own OPDS endpoint also speaks this
- [ ] Parse Atom/OPDS 1.2 XML (feeds, `<link rel="acquisition">`,
      pagination `rel="next"`); OPDS 2.0 (JSON) as a stretch if time allows
- [ ] A minimal demo catalog browser (list → tap → opens in `<Reader>`) —
      reuses `<TableOfContents>`-style headless list patterns from U3
- [ ] Vitest against a recorded OPDS feed fixture (no live server, same policy
      as `KavitaSource`); the demo can optionally point at a real OPDS URL the
      user supplies

**Done when:** browse a real OPDS catalog (e.g. Project Gutenberg's) in the
demo and open a book from it.

---

## F5 — Text-to-speech (stretch) · M

- [ ] `TtsController` in `reader-core`: Web Speech API (`SpeechSynthesis`),
      walks the current spine's block text, tracks sentence boundaries
      (`Intl.Segmenter` if available, regex fallback)
- [ ] Sentence-level highlight sync while speaking (reuses F2's highlight
      renderer for the "currently spoken" span) + auto page-turn at spine end
- [ ] Controls: play/pause/rate/voice picker; `reader-react`
      `useTts()` hook, headless (demo renders play bar UI)
- [ ] Explicitly out of scope: audio export, cloud TTS voices, sync across
      devices — browser `SpeechSynthesis` only, and only for EPUB (not
      image/PDF, no text layer worth reading)
- [ ] Vitest: sentence segmentation on fixture text; Playwright: start/pause/
      resume moves through at least two sentences (voice output itself isn't
      assertable in CI — assert the tracked-position side effects only)

**Done when:** press play on the demo EPUB, hear it (manually verified — CI
checks the state machine only), see the current sentence highlighted.

---

## F6 — hardening + release · S

- [ ] a11y: highlight/note editor and TTS controls keyboard-reachable, axe
      clean; CFI round-trip fuzzed against a handful of real-world EPUBs
      (structurally varied — nested lists, tables, footnote markup)
- [ ] Playwright: highlight → reload → still there (EPUB + PDF), fixed-layout
      page-turn, OPDS browse → open, TTS state machine
- [ ] Perf: highlight rendering doesn't repaint the whole page on scroll/turn;
      OPDS catalog list virtualized past ~200 entries
- [ ] CHANGELOG `v0.7.0-annotate`; README; docs
- [ ] Tag `v0.7.0-annotate`

---

## Cut from M4 (still later)

Cross-device highlight sync (needs a real backend — `KavitaSource`/
`OpdsSource` are read-mostly), cloud TTS voices, EPUB3 media overlays
(publisher-authored audio narration — different problem from F5's synthesized
TTS), CFI for images/PDF (page index is already stable and simpler, no CFI
needed there).

## Open questions

1. ~~**Highlight storage**~~ — **settled** (user, before F2): new optional
   `ReaderSource.loadHighlights`/`saveHighlights` methods. Done, see F2.
2. ~~**F3 fixed-layout rendering path**~~ — **settled**: live iframe, to keep
   F2's highlight/selection mechanics working on fixed-layout books. Done,
   see F3.
3. **F4 scope for this portfolio**: full OPDS 2.0 + auth flows are a lot of
   surface for uncertain payoff — could ship OPDS 1.2 read-only against Project
   Gutenberg's public catalog as the demo proof and call 2.0/auth a follow-up.
4. **F5 priority** — explicitly a stretch goal in the design doc; fine to cut
   entirely from `v0.7.0-annotate` and revisit later without blocking F1–F4/F6.
