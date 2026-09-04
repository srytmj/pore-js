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

## F1 — Precise text ranges (`epubcfi`-flavored) · M

- [ ] Extend `anchor.ts`: `generateAnchor` records a real character `offset`
      into the resolved block (today it's hardcoded `0`) via a `Range` walk
      over text nodes — the deferred M0.5 sliver, finally worth doing because
      F2 needs it
- [ ] A `RangeAnchor` for highlight spans: `{ spine, startBlock, startOffset,
      endBlock, endOffset }` — reuses the same block-ordinal addressing as
      `Position['anchor']`, just with a pair of endpoints instead of one
- [ ] `serializeCfi(doc, range) → string` / `resolveCfi(doc, cfi) → Range`
      producing real `epubcfi(/6/4[chap01]!/4/2/1:0,/4/2/1:5)`-shaped strings —
      spec-compliant enough to be portable to another reader, not just our own
      round-trip. Keep `RangeAnchor` as the fast internal path; CFI is the
      export/interchange format.
- [ ] Fallback cascade on resolve: exact CFI/anchor → nearest block → percent
      (same pattern as `resolveAnchor` today)
- [ ] Vitest: round-trip generate → serialize → resolve on fixture HTML with
      nested inline markup (em/strong/a inside the target block) — the
      bug-prone case call out in the design doc

**Done when:** a highlight's start/end survives a reload and a re-render at a
different font size, and its CFI string is one a spec-reader would accept.

---

## F2 — Highlights & notes · L

- [ ] Selection bridge: `selectionchange` inside the sandboxed iframe →
      debounced → a floating toolbar (copy / highlight / note / "search this
      selection") positioned over the selection rect
- [ ] `TextEngine.addHighlight(range, { color, note? })` /
      `removeHighlight(id)` / `listHighlights(): Highlight[]`; persisted through
      `ReaderSource` as a new `HighlightRecord[]` — **not** `Position`, a
      parallel per-book collection (`loadHighlights`/`saveHighlights` on
      `ReaderSource`, optional so existing sources don't need to implement it)
- [ ] Render: CSS Custom Highlight API (`CSS.highlights.set(...)`) when
      available; fall back to wrapping the range in `<mark>` (same fallback
      shape as the in-book search highlight) — no DOM mutation of the book's
      own markup when the native API is there
- [ ] A highlights/notes panel (`reader-react` headless list + Radix
      `ScrollArea`/`Popover` for the note editor; demo styles it) — jump to a
      highlight like a search hit
- [ ] Works for PDF too: a rect-based highlight (page + bounding boxes from
      pdf.js's text layer) — simpler than EPUB's range problem, reuses F1's
      CFI work not at all
- [ ] Vitest: add/remove/list round-trip against a fake source; selection →
      range → CFI → re-resolved highlight position; Playwright: select text,
      highlight, reload, still there

**Done when:** select text in the demo EPUB or PDF, highlight it with a note,
reload, it's still there and click-to-jump works.

---

## F3 — Fixed-layout EPUB · M

- [ ] Detect `rendition:layout="pre-paginated"` (already sniffed in
      `LocalFileSource.fixedLayout` / `EpubMetadata.fixedLayout` — currently
      just a "beta" notice, never actually rendered specially)
- [ ] A `FixedLayoutSource` adapter in the same spirit as `PdfImageSource`:
      render each spine doc's fixed viewport (`<meta name="viewport"
      content="width=…,height=…">`) into a canvas/image at a target
      resolution (serialize to an `<img>`/`<foreignObject>` snapshot, or run it
      through an offscreen iframe + `drawImage`), then feed the **image
      engine** unchanged — same composition pattern PDF uses
- [ ] Spread detection from `<spine><itemref properties="rendition:page-spread-
      left|right">` → maps to the image engine's double-page pairing
- [ ] A synthetic fixed-layout fixture (kids'-book-style: a couple of spreads,
      short text blocks) for the demo and tests
- [ ] Vitest: layout detection, viewport-size extraction, spread mapping;
      browser-verified paging matches a real fixed-layout title

**Done when:** a fixed-layout EPUB opens and pages like a comic, not a broken
reflow.

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

## Open questions to settle before F1 starts

1. **Highlight storage** — a new `ReaderSource` method (`loadHighlights`/
   `saveHighlights`), or fold into existing per-book settings? Leaning
   toward a new optional method: highlights aren't a "setting" and every
   `ReaderSource` (Kavita, demo, local file) needs its own persistence story.
2. **F3 fixed-layout rendering path** — snapshot-to-canvas (simpler, works
   offline, loses text selection) vs. keep it a live iframe sized to the fixed
   viewport (keeps selection/highlight compatibility with F2, more moving
   parts). Leaning toward the live-iframe path *if* F2 is expected to cover
   fixed-layout books too; snapshot otherwise.
3. **F4 scope for this portfolio**: full OPDS 2.0 + auth flows are a lot of
   surface for uncertain payoff — could ship OPDS 1.2 read-only against Project
   Gutenberg's public catalog as the demo proof and call 2.0/auth a follow-up.
4. **F5 priority** — explicitly a stretch goal in the design doc; fine to cut
   entirely from `v0.7.0-annotate` and revisit later without blocking F1–F4/F6.
