# Pore.js — M5 Plan (reading-comfort chrome + annotation polish)

**Goal:** finish the parts of M4 that got cut (highlight notes, a real
`reader-react` highlights component, PDF highlights, fixed-layout spreads) and
rework the demo's menu bar into something you'd actually want to read behind —
dock it on any edge, or let it float and auto-hide, with fullscreen doing the
right thing.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §5 (CFI /
selection), §7 (search/selection/footnotes), §12 (fixed-layout), §14 ("M4+")
· builds on `v0.7.0-annotate` + the demo landing page / bundle split. Target
tag: `v0.8.0-comfort`.

Sequential, one commit per task, same as every milestone so far. **Not
started** — this doc is the scope for discussion before G1 begins.

---

## Why this order

```
G1 (menu bar)  ─ independent, ships first (most visible, has a live bug)
F2b (notes + <HighlightsPanel>) ─→ F2c (PDF highlights, reuses the panel)
F3b (fixed-layout spreads) ─ independent
all ─→ F6 (hardening + release)
```

`G1` is standalone and the user has flagged it directly (incl. a real
layout bug), so it leads. `F2b`/`F2c` build on each other. `F3b` is
independent and could reorder or drop.

---

## G1 — Menu bar: dock on any edge, or float and auto-hide · M

Today: the demo bar is always at the top; auto-hide (2.6 s idle) only applies
to the top position; `menuPosition`/`menuReveal` live on `TextEngineSettings`
and only take effect for EPUB. Bugs the user reported:

- No option to move the bar for image / PDF books (only EPUB).
- In the default "top" mode the bar auto-hides via `translateY(-100%)` but its
  flex slot stays reserved → **a dead strip at the top of the page**.
- Auto-hide fires even when the window is small and there's no reason to hide.
- No "just keep it visible" choice.

**Shape:**

- [ ] **Move menu placement out of `TextEngineSettings`** into a demo-level,
      persisted setting owned by the demo shell — it's chrome placement, the
      *engine* shouldn't care. Applies to every engine (manga / webtoon /
      novel / PDF / fixed-layout). Keep the old `menuPosition`/`menuReveal`
      fields as deprecated no-ops for one release, or delete outright (they're
      pre-1.0 and unused outside the demo — likely just delete).
- [ ] **Placement**: `top` · `left` · `right` (bottom is a cut, see below).
- [ ] **Behaviour**: `docked` vs `auto-hide`.
      - *Docked*: the bar is a real `flex-none` child of the shell (a row for
        `top`, a column for `left`/`right`); the reader host fills the rest.
        **No dead strip** — this is the fix for the reported bug.
      - *Auto-hide*: the bar is an `position: absolute` overlay pinned to its
        edge (zero layout footprint); it slides out after idle and slides
        back on *any* of: pointer within ~48 px of that edge, any keypress,
        `focus-within`, an open panel/dialog. A thin always-present hover
        hot-zone along the edge makes "pointer near the edge" reliable (and
        fixes the Playwright-can't-reveal-it problem found in M4 F6).
- [ ] **Fullscreen integration**: a `useFullscreen()` hook in the demo
      (`requestFullscreen` / `exitFullscreen` + `fullscreenchange`). Entering
      fullscreen switches behaviour to `auto-hide` for that session; leaving
      restores the user's chosen behaviour. (Open question #2: force it, or
      just make it the default-on-enter?)
- [ ] **Settings UI**: one "Menu bar" group in the demo settings panel —
      *Placement* (Top / Left / Right) and *Behaviour* (Always visible /
      Auto-hide). Available for every book type.
- [ ] `use-auto-hide.ts` reworked: takes the edge + the behaviour, owns the
      hot-zone listener, exposes `[hidden, pin]` unchanged so the call sites
      barely move.
- [ ] Vitest: `use-auto-hide` state machine (idle → hide, activity → show,
      pinned stays); Playwright: dock on each edge leaves no gap, auto-hide
      reveals on edge-hover and on keypress, fullscreen forces auto-hide.

**Done when:** you can put the bar on any edge, choose "always visible" (and
the page truly fills — no empty strip) or "auto-hide", and fullscreen hides
it without you touching settings.

---

## F2b — Highlight notes + a headless `<HighlightsPanel>` · M

F2 shipped highlights with a `note` field on `HighlightRecord` and the engine
API, but no way to *write* a note, and the demo's highlights list is ad-hoc
markup in `Chrome.tsx`.

- [ ] `TextEngine.updateHighlight(id, { color?, note? })` (today: only
      `add` / `remove`). Emits `reader:highlightschange`, persists.
- [ ] Note editor: a small popover (Radix `Popover`) with a `<textarea>`,
      opened from the selection toolbar (a "note" action alongside the colour
      swatches) and from a highlight row in the panel. Colour re-pick too.
- [ ] Extract `<HighlightsPanel>` into `reader-react` — headless, like
      `<TableOfContents>` / `<SettingsPanel>`: renders the list with
      `data-pore-*` hooks, calls `goto` / `updateHighlight` / `removeHighlight`
      off the handle. Remove the hand-rolled markup from the demo `Chrome.tsx`;
      the demo just styles it.
- [ ] `useReaderHighlights()` already exists; add an `edit`/`updateHighlight`
      passthrough to `useReaderSelection()` or a new `useHighlight(id)`.
- [ ] Vitest: `updateHighlight` round-trip; Playwright: highlight → add a
      note → reload → note is still there → edit it.

**Done when:** select text, highlight, attach a note, reload — the note
survives; the highlights panel is a reusable component, not demo glue.

---

## F2c — PDF rect-based highlights · M

Cut from F2. PDF has no DOM range to anchor to — highlights are page +
bounding boxes over the text layer.

- [ ] `HighlightRecord` becomes a discriminated union (open question #3):
      `{ kind: 'text', range, cfi, … }` (today's shape) and
      `{ kind: 'rect', page, rects: Rect[], … }`. Both still carry
      `color` / `note` / `text` / `createdAt` / `id` and persist through the
      same `ReaderSource.loadHighlights` / `saveHighlights`.
- [ ] `createPdfEngine` gains `addHighlight` / `removeHighlight` /
      `listHighlights`: selection over pdf.js's text layer → the covered
      client rects → page-relative `rects`.
- [ ] Render: a highlight overlay layer positioned over the page image (the
      image engine already places pages; add an absolutely-positioned
      `<div>` per rect, scaled with the page).
- [ ] `reader-react`: `useReaderHighlights()` / `<HighlightsPanel>` work for
      the PDF engine too (jump = `goto(page)`).
- [ ] Vitest: rect extraction from a fake text layer; Playwright: highlight a
      PDF passage, reload, still there, click-to-jump lands on the page.

**Done when:** highlight a run of text in the demo PDF, reload, it's still
painted on the right page.

---

## F3b — Fixed-layout page spreads · S

Cut from F3. `rendition:page-spread-left|right` → two pre-paginated pages
shown side by side.

- [ ] Parse `<itemref properties="rendition:page-spread-left|right|center">`
      into `SpineItem.pageSpread` (the parser hook F3 deferred).
- [ ] Pair adjacent spine items into a spread the way the image engine pairs
      double pages (`spreadOffset` to nudge misaligned runs). A spread turn
      advances by two spine items.
- [ ] Render two scaled `#pore-flow` panes side by side inside one viewport
      (open question #4: two iframes vs one iframe with two `srcdoc` docs —
      leaning two iframes; simpler, and each keeps its own `<meta viewport>`).
- [ ] A synthetic two-spread fixture added to `demo-fixed` (or a new
      `demo-fixed-spread`).
- [ ] Vitest: spread pairing + offset; Playwright: a spread renders two
      pages, one turn advances two.

**Done when:** a spread-marked fixed-layout book shows two facing pages and
turns two at a time.

---

## F6 — hardening + release · S

- [ ] a11y: the menu-bar settings, note editor, and highlights panel
      keyboard-reachable + axe clean (with the M4 iframe-exclude in place).
- [ ] Playwright: menu-bar dock/float/fullscreen, note round-trip, PDF
      highlight round-trip, fixed-layout spread turn.
- [ ] Perf: highlight overlay for PDF doesn't relayout on every scroll tick;
      the hover hot-zone listener is passive and cheap.
- [ ] CHANGELOG `v0.8.0-comfort`; README; `CLAUDE.md` pointer.
- [ ] Tag `v0.8.0-comfort`.

---

## Cut from M5 (later)

- **Bottom edge** for the menu bar — top/left/right covers the ask; bottom
  competes with the scrubber dock.
- **Highlight export / import** (JSON or a CFI list) — portability is nice
  but needs a format decision; separate task.
- **OPDS 2.0 (JSON)** — still deferred from F4.
- **Cloud TTS voices**, EPUB3 media overlays — unchanged from the M4 cut list.
- **Cross-device highlight sync** — needs a real backend.

---

## Open questions to settle before G1 starts

1. **Menu placement — demo-level or a `reader-react` API?** Leaning
   demo-level: chrome placement isn't the engine's concern, and every other
   consumer would want to decide it themselves. Downside: the old
   `TextEngineSettings.menuPosition` gets deleted (fine pre-1.0, nothing
   external uses it).
2. **Fullscreen + auto-hide** — force `auto-hide` while fullscreen (can't
   dock), or just make it the default when you *enter* fullscreen (you can
   still switch back to docked)? Leaning "default on enter, still switchable".
3. **PDF highlight storage** — a `kind` discriminant on `HighlightRecord`
   (one collection, one union type) vs a parallel `RectHighlightRecord[]`.
   Leaning the discriminant: one `loadHighlights`/`saveHighlights`, one
   panel, one `useReaderHighlights()`.
4. **Fixed-layout spread rendering** — two iframes side by side, or one
   iframe hosting two docs? Leaning two iframes (each keeps its own viewport
   meta + scaling; the pairing logic lives in the engine, not the DOM).
5. **Is F2c (PDF highlights) worth it for this portfolio?** It's real engine
   work but PDF is arguably the least-loved format here. Could cut to keep M5
   tight around the menu bar + EPUB notes.
