# Agent worklog

**Read this first if you are an AI agent picking up work and did NOT continue
from the original chat session.** It is the running, append-only journal of what
each agent session did, why, and what state things are in — the context that
lives in a chat transcript but not in git history.

## Rules for agents

- **Append a new entry at the top of the Log** (reverse chronological) whenever
  you finish a meaningful unit of work — a commit, a decision, a blocker hit, a
  milestone step. One entry per unit; don't batch a whole session into one line
  at the end.
- Entry format:
  ```
  ## YYYY-MM-DD — <short title>
  - **What:** what changed / what you did
  - **Why:** the reason or the user's ask (paraphrased)
  - **State:** committed (<hash>) / uncommitted / blocked on X / needs user decision
  - **Notes:** gotchas, follow-ups, things the next agent should know
  ```
- Keep entries short. Deep detail belongs in `docs/*-plan.md` (milestone plans)
  and code comments; this file is the index of *activity*.
- Update the milestone plan (`docs/m5-plan.md` etc.) in the same commit when you
  finish a plan item.
- This file is committed like any other doc. It is not a substitute for
  Conventional Commits or the changelog — it is the "narrative" layer above them.

## Current focus

**M6 shipped — `v0.9.0-editorial`.** Editorial redesign of the demo, D0–D7:
warm accent-less palette + self-hosted Hanken Grotesk / Literata (D0); one
collapsible menu rail with an inline settings accordion (D1, a new headless
`Accordion` primitive); panel restyle onto tokens (D2); new editorial landing
(D3); reader font menu wired to the bundled faces via `<Reader fontFaceCss>`
(D4); one focus ring + global reduced-motion (D5); mobile rail overlay (D6);
dark-axe test + tag (D7). 38 e2e · 256 unit · lint 0 · all green.
`docs/design-language.md` is the token reference.

**M7 scoped — `docs/m7-plan.md`, target `v0.10.0-library`.** Library &
portability (a feature milestone): L0 engine groundwork (`goToCfi` +
`loadBookmarks`/`saveBookmarks`) → L1 bookmarks (`useBookmarks` +
`<BookmarksPanel>`) → L2 library/home (a `useLibrary()` shelf) → L3 annotations
review → L4 export/import (versioned JSON, `docs/portability-format.md`) → L5
share-a-passage (`?cfi=` deep links) → L6 release. Open questions decided
(see plan). **L0 · L1 · L2 done**; L3 next.

<details><summary>earlier "current focus" — M6 scoping</summary>

**M6 scoped, not started — `docs/m6-plan.md`, target `v0.9.0-editorial`.** A
design pass, not a feature milestone: the demo works but doesn't look finished
(icon-soup chrome, raw `<select>`s, doubled status, bare settings form, thin
landing, half-migrated palette). Direction settled with the user: quiet /
editorial aesthetic, accent-less (drop the orange), bundle fonts (Literata +
Hanken Grotesk proposed). D0 (tokens/palette/fonts) → D1 (chrome) → D2 (panels)
→ D3 (landing) → D4 (reading surface) → D5/D6 (motion/responsive) → D7 (ship).
Six open questions in the plan need answers before D0. `reader-react` stays
headless; the one core touch is `THEME_COLORS`.

M5 shipped — `v0.8.0-comfort`. F3b (fixed-layout spreads) still deferred.

## Log

## 2026-09-06 — M7 L2: library / home shelf
- **What:** `apps/demo/src/use-library.ts` — `useLibrary()` over `openKvStore()`
  (one key `pore:demo:library` → `LibraryEntry[]`: `{ id, title, glyph, kind:
  'sample' | 'file', lastOpened, percent }`). `record()` on open (create/bump,
  keep prior percent), `setProgress()` from `<Reader onPositionChange>`
  (dead-zoned), `remove()`; cap 24, newest first. `relativeTime()` helper.
  `<Landing>` gained a "Continue reading" section above "Open your own": glyph +
  title + `"42% · 3 min ago"` + progress track + `✕` forget. Sample rows resume
  in place; file rows re-open the picker (handles don't persist).
- **State:** committed, `docs/m7-plan.md` L2 marked done. 259 unit · 40 e2e ·
  lint 0 · typecheck clean.
- **Notes:** removing an entry doesn't yet clear its cached download / annotation
  stores — deferred to L6. File System Access API for real re-openable dropped
  files still deferred (open question #3).

## 2026-09-06 — M7 L1: bookmarks
- **What:** `useBookmarks()` (reader-react, over handle + source) —
  add/remove/rename/goTo/toggle, `isBookmarkedHere`. Headless
  `<BookmarksPanel>` (`data-pore-bm-*`). `ReaderCtx` gained `bookId` + `source`.
  Demo: rail Bookmarks button (filled when the page is bookmarked), panel with
  a page-toggle, `b` keybind. `goTo` uses the exact `position` (cfi kept for
  export). `resolvePendingCfi` now translates the CFI's element-relative offset
  to block-relative.
- **State:** committed. 258 unit · 39 e2e · lint 0 — green.

## 2026-09-06 — M7 L0: goToCfi + bookmark persistence
- **What:** `TextEngine.goToCfi(cfi)` (+ `ReaderHandle`) — the inverse of
  `getCfi()`: `parseCfi` → `pendingCfi` → `resolvePendingCfi` (in `renderSpine`
  finish, or sync when the target spine is current) resolves the element, walks
  to the nearest block, feeds the normal `pendingAnchor` path. `Bookmark` type
  + optional `ReaderSource.loadBookmarks?`/`saveBookmarks?`; `CachedSource`
  implements them local-first (`#bmKey`). Both exported.
- **Open questions decided** (in the plan): bookmarks = a reader-react layer;
  library = demo-level `useLibrary()` over IDB; local files = simple
  (cached re-openable, else history); export = per-book + all; deep-link =
  navigate + 2s pulse; review = full-screen overlay.
- **State:** committed. 258 unit (+2) · 38 e2e · typecheck · lint 0 — green.

## 2026-09-06 — M7 scoped: library & portability
- **What:** `docs/m7-plan.md` — a feature milestone. L0 (`goToCfi`, bookmark
  source methods) → L1 bookmarks → L2 library/home shelf → L3 annotations
  review → L4 export/import (versioned JSON) → L5 `?cfi=` deep links → L6
  release. Target `v0.10.0-library`.
- **Why:** the demo works but isn't sticky — no library, no bookmarks, no way
  to move annotations. Also finally makes the M4 CFI work visible.
- **State:** committed. Not started — 6 open questions (bookmarks layer,
  library storage, re-openable local files, export scope, deep-link pulse,
  where the review lives).
- **Notes:** additive only — new *optional* `ReaderSource` methods, one engine
  method (`goToCfi`), demo-level `useLibrary()`. `reader-core` gets no
  "list every book" API.

## 2026-09-06 — M6 D2–D7 + release `v0.9.0-editorial`
- **D2** — highlights panel / note editor / swatches restyled; toast, `.notice`,
  OPDS error banner moved off hard-coded colours onto the ink / danger tokens.
- **D3** — `Landing.tsx` rebuilt: serif masthead + statement, sample cards with
  inline-SVG layout glyphs, a real footer. `SampleBook` gained `glyph`.
- **D4** — `CreateTextEngineOptions.fontFaceCss` / `<Reader fontFaceCss>` injects
  `@font-face` into the reading iframe (`#pore-fonts`); `reader-fonts.ts` builds
  it from the `@fontsource` woff2. `FONT_STACKS` serif/sans → Literata/Hanken.
  Reading-rhythm nudges in `buildBaseStylesheet`.
- **D5** — one `:focus-visible` ring via a `:where()` base rule; global
  `prefers-reduced-motion` neutraliser.
- **D6** — `@media (max-width:640px)`: rail overlays (no content push), starts
  collapsed on a narrow first load; toast moved to the top edge.
- **D7** — dark-mode chrome axe test added (found + fixed a Radix slider-thumb
  missing its accessible name); CHANGELOG `v0.9.0-editorial`, README, CLAUDE.md.
- **State:** committed + tagged + pushed. 38 e2e · 256 unit · typecheck ·
  lint 0 — all green. `docs/design-language.md` written in D0.

## 2026-09-06 — M6 D0: design language (warm palette, accent-less, self-hosted fonts)
- **What:** rewrote the `@theme` block — warm paper palette (`#faf7f1` /
  `#17150f`), removed `--color-accent`/`--color-accent-fg` (active controls now
  fill with ink, `bg-fg text-canvas`), added `--color-focus` (one functional
  blue) + `--color-danger`, soft `--shadow-panel`/`--shadow-popover` tokens.
  All ~15 `*-accent` utility usages repointed. `THEME_COLORS` in
  `create-text-engine.ts` warmed to match (light/sepia/dark/oled). Fonts
  self-hosted via `@fontsource-variable/hanken-grotesk` (UI) +
  `@fontsource-variable/literata` (display/reading) — imported in `main.tsx`,
  Google Fonts `<link>` removed. `docs/design-language.md` written. e2e
  theme-hex assertions updated (2 tests).
- **State:** committed. build ✓ · typecheck ✓ · lint 0 ✓ · 256 unit ✓ ·
  37 e2e ✓ (axe holds on the new palette). Browser-verified.
- **Notes:** explicit modular type/space token scale deferred (Tailwind
  defaults fine). D2–D6 now build on these tokens.

## 2026-09-06 — M6 D1 landed: menu rail + inline settings accordion, e2e green
- **What:** finished the parallel M6 chrome work (see next entry) to a
  committable state. Split into 3 commits: `feat(core)` webtoon maxWidth,
  `feat(react)` Accordion + `layout` prop, `feat(demo)` D1 the rail.
- **Regressions fixed** (from the Antigravity WIP): `use-auto-hide` wakes on
  real pointer/key/wheel/touch again; `use-fullscreen` uses the real
  Fullscreen API; Prev/Next page buttons, a Fullscreen button, a
  Download-for-offline button, and a page-turn-animations toggle (in the Menu
  bar section) are back in the chrome. Dead `components/ui/sidebar.tsx` +
  `.pore-sidebar*` CSS removed. All 6 lint warnings gone.
- **e2e:** rewrote the 16 broken tests for the new UI — `getByRole('tab')` →
  `openSettingsSection()` helper (expands an accordion section), settings
  dialog test → accordion test, `.bar--top` test → side-rail test, book picker
  → Radix Select click, scrubber test accounts for the RTL slider direction.
  Fixed two axe contrast fails found doing it: the collapse toggle label (now
  `sr-only`), `.bar button` colour transition (snaps now, so a scan can't catch
  a low-contrast mid-transition frame).
- **State:** committed + pushed. build ✓ · typecheck ✓ · lint 0 ✓ · 256 unit ✓
  · 37 e2e ✓ (stable across 3 runs). `docs/m6-plan.md` D1 not yet checked off —
  D0 (palette/tokens/self-hosted fonts) and D2–D7 remain; Inter still loads
  from the Google Fonts CDN (D0 will self-host it).

## 2026-09-06 — M6 in flight (parallel: Antigravity + this session)
- **Context:** a separate agent (Antigravity IDE) is doing the bulk of the M6
  redesign in the working tree — shadcn-style setup (Radix + CVA + lucide +
  Inter via Google Fonts), a vertical rail menu bar, a `components/ui/` dir.
  All **uncommitted**. This session was asked to fix three specific misses.
- **Fixed here (uncommitted, in that same working tree):**
  1. **Webtoon image width** — `create-image-engine.ts`: the continuous-vertical
     path never applied `settings.maxWidth`. Added `stripWidth()` (min of window
     width and `maxWidth`), used for layout estimation, per-page measurement,
     and the mounted `<img>` (centred, `translateX(-50%)`, width capped).
     `setSettings` clears `measured` on a maxWidth/maxHeight change so the strip
     re-lays-out. Browser-verified at 500px.
  2. **Autoscroll removed from the demo** — the button + prompt popover + state
     + CSS in `Chrome.tsx` / `styles.css`. The engine capability stays (core).
  3. **Settings unified into the menu rail, inline accordion** — removed the
     separate `<Sidebar>` slide-over. The menu `<header class="bar">` is the
     single rail; clicking **Settings** expands its sub-sections *inline* as a
     stacked accordion (`SettingsPanelBody layout="accordion"`, "Menu bar" is an
     `extraTabs` section) — the menu items stay visible, no separate view / back
     button. New headless `Accordion` in `reader-react` (native `<details>`,
     `data-pore-accordion*`, exported as `SettingsAccordion`); `layout?: 'tabs'
     \| 'accordion'` on `TextSettingsPanel` / `ImageSettingsPanel` /
     `SettingsPanelBody`. A **Collapse** toggle shrinks the whole rail to an
     icon strip (`bar--collapsed`); `useMenuBar` gained `collapsed`/
     `toggleCollapsed` (persisted). Rail + reader inset driven by a `--rail-w`
     CSS var on `.shell` (13rem / 3.25rem collapsed / 18rem settings-open).
     Gotcha fixed: `.bar` base is `flex-wrap`, so the tall rail wrapped its
     content into a hidden second column — `.bar--left/right` now `flex-nowrap`.
  4. **Settings polish (per owner feedback)** — the accordion now renders
     *directly under its own Settings button* (0 gap, tinted panel, connected
     rounded corners) instead of at the bottom of the rail; rail **width is
     constant** whether settings is open or not (16rem; only the collapse
     toggle changes it); accordion fields tidied — label + value on one line,
     full-width control below, switches right-aligned on the label line.
     **Theme + Pin are now one side-by-side row** (`.bar__pair`) placed above
     Settings. Fixed: `.bar--left/right button { w-full }` was making the Radix
     switch `<button>` full-width — scoped to `> button` (direct children only).
  5. **Accordion animation** — `Accordion` was native `<details>` (opens
     instantly). Rewrote it controlled (`useState`, all panels stay mounted,
     `data-state="open|closed"`, `inert` on closed panels) so the demo can
     height-animate it: `grid-template-rows: 0fr↔1fr` transition on
     `[data-pore-accordion-panel]` + a fade-in on `.bar__settings-inline`,
     `prefers-reduced-motion` respected. Still headless / no shipped CSS.
- **Reverted:** the Antigravity change to `reader-react/src/primitives.tsx`
  `SelectField` (native `<select>` → Radix Select) — it broke the unit test and
  violates "reader-react ships no CSS / stays headless" (added a hard
  `@radix-ui/react-select` dep + `.pore-select-*` classes). Back to native.
  The demo's own `components/ui/select.tsx` is fine — that's demo code.
- **Regressions in the Antigravity WIP the owner should have it fix:**
  `use-auto-hide.ts` no longer listens for pointer/key activity, so auto-hide
  never auto-reveals (only the reader's tap-to-toggle brings it back);
  `toggleFullscreen` is unwired (no way to enter fullscreen from the UI);
  the Playwright suite is broken (bar structure + removed buttons).
- **State:** 256 unit + typecheck + lint(0 err) green. e2e not run (WIP).
  Nothing committed — the owner will commit the M6 batch.

## 2026-09-06 — documentation for AI + human integrators
- **What:** `docs/ai-agent-guide.md` (the single AI entry point — repo map,
  run/verify, conventions, invariants, UI/styling map, current milestone),
  `docs/architecture.md` (engine internals), `docs/integration.md` (consuming
  the packages — sources, hooks, headless components, custom `ReaderSource`).
  README gained a "🤖 If you are an AI agent" callout + a docs index + an
  "Integrating it in your app" section. CLAUDE.md points at the guide first.
- **Why:** owner wants the docs complete enough that an AI agent in another
  tool (Antigravity) can pick up the M6 UI work cold; and a real integration
  guide for human consumers.
- **State:** committed. Docs only, no code.
- **Notes:** the UI/styling map in `ai-agent-guide.md` §7 is the quick "what
  file do I edit" table for the M6 redesign.

## 2026-09-06 — M6 scoped: editorial redesign
- **What:** `docs/m6-plan.md`. User's call: "lets fix the ui design, its still
  bad actually." Reviewed every surface in the browser (landing, EPUB/webtoon
  readers, settings). Scoped a pure design milestone — D0 tokens/palette/fonts,
  D1 chrome rebuild (three zones + overflow menu, kill raw selects, one status,
  SVG icons), D2 panels, D3 landing, D4 reading surface + font menu, D5 motion,
  D6 responsive, D7 ship.
- **Decisions (from the user):** quiet/editorial aesthetic; accent-less (remove
  `--color-accent`, one functional colour for focus/error); bundle fonts.
- **State:** committed. Not started — 6 open questions in the plan (font pair,
  icon set, TOC control, shell-vs-reader theme coupling, focus colour, warmth).
- **Notes:** D1 will churn Playwright selectors (bar structure + glyphs) —
  budgeted in the plan. Keep every icon button's `aria-label`.

## 2026-09-06 — F6 + release v0.8.0-comfort
- **What:** a11y pass on the new UI (new e2e "M5 UI … axe clean &
  keyboard-reachable") — fixed `.menubar-settings__hint` contrast and switched
  `.bar button.active` off the orange accent to the theme foreground (accent vs
  white label failed AA; also matches the progress-bar decision). CHANGELOG
  heading → `v0.8.0-comfort`, README + CLAUDE.md pointers, m5-plan F6 done /
  F3b moved to cut list.
- **State:** committed + tagged `v0.8.0-comfort`, pushed. 256 unit + 37 e2e +
  typecheck + lint green.
- **Notes:** F3b deferred by user decision ("skip F3b, go to F6 + tag") after
  scoping showed the single-iframe / per-spine-item page model needs a wider
  reshape than "S".

## 2026-09-06 — worklog created + M5 scope confirmed
- **What:** this file (`docs/agent-worklog.md`) + a pointer at the top of
  `CLAUDE.md` making it mandatory reading for agents not continuing from the
  original chat.
- **Why:** user wants an automatic cross-session narrative another agent can
  follow up from (git/changelog say "what", not "why / where stuck").
- **State:** committed alongside F2b.
- **Notes:** M5 scope confirmed with user — do F2b→F2c→F3b→F6 "all, in order".
  F2c storage = `kind:'text'|'rect'` discriminated union. F3b spreads = two
  iframes.

## 2026-09-06 — F2c: PDF rect highlights (Shift+drag)
- **What:** `PdfDoc.textRects(page)` (pdf.js text-run boxes, normalized).
  `pdf/pdf-highlights.ts` — transparent overlay over the page `<img>`, Shift+drag
  marquee → intersect text runs → merge to line rows → `RectHighlightRecord`.
  `createPdfEngine` grew `addHighlight`/`removeHighlight`/`updateHighlight`/
  `listHighlights` + `reader:selection`/`reader:highlightschange`. Demo:
  `canAnnotate = isText || isPdf`, empty-state + tooltip say "Shift-drag".
- **Why:** F2c, "all in order".
- **State:** browser-verified working (marquee → yellow line highlight →
  persists reload). 256 unit + 36 e2e green. Committing now.
- **Notes:** Shift+drag (not plain drag — native img-drag navigated to the blob
  URL; `img.draggable=false` + dragstart guard added). Single-page mode only.
  Overlay attaches on `reader:ready` (image engine `replaceChildren`s the
  container in mount) and repaints on img `load`. **Dev-server pain:** repeated
  `preview_stop`/`start` + partial rebuilds wedged Vite HMR (stale
  `dist/*.js` 404s, ghost engines) — fix was `rm -rf apps/demo/node_modules/.vite`
  + a brand-new browser tab. Do a full `pnpm build` before verifying, not
  per-package.

## 2026-09-06 — F2c groundwork: HighlightRecord discriminated union
- **What:** `HighlightRecord` is now `TextHighlightRecord | RectHighlightRecord`
  discriminated on `kind` (`'text'` = DOM range + cfi, `'rect'` = page +
  normalized `NormRect[]`). Shared fields on a `HighlightBase`. New types
  exported from both packages. `create-text-engine` stamps `kind: 'text'` and
  `applyHighlights` narrows; `<HighlightsPanel>` jump target is `h.page` for
  rect / anchor Position for text.
- **Why:** open question #3 — one collection / one panel / one
  `useReaderHighlights()` for PDF + EPUB highlights (user chose the discriminant
  over a parallel `RectHighlightRecord[]`).
- **State:** committed `be45408`. 255 unit + typecheck + lint green.
- **Notes:** the PDF **engine** side of F2c (text-item geometry in `parse.ts`,
  a marquee/selection overlay in the image engine, rect rendering, wiring
  `addHighlight`/`updateHighlight`/`listHighlights` on `createPdfEngine`) is
  NOT done — it's a sizable image-engine subsystem. Plan: expose
  `PdfDoc.textRects(page)` (normalized boxes + strings via pdf.js
  `getTextContent` + `Util.transform`), add an overlay in **paged-single mode
  only** to start (continuous/zoom paint nothing — documented limitation like
  the `<mark>` multi-element fallback).

## 2026-09-06 — F2b: highlight notes + headless `<HighlightsPanel>`
- **What:** `TextEngine.updateHighlight(id, {color?, note?})`
  (`create-text-engine.ts`, `text/types.ts`) — emits `reader:highlightschange`,
  persists, `note:''` clears. Plumbed through `reader-react`
  (`ReaderHandle`/`EngineLike`/`useReaderSelection().updateHighlight`). New
  `<HighlightsPanel>` headless component (`highlights-panel.tsx`, exported) —
  `<ol>` with `data-pore-hl-*` hooks (jump / colour re-pick / note `<textarea>`
  commit-on-blur / remove), no dialog chrome. Demo `Chrome.tsx` swapped its
  hand-rolled highlights list for it; selection toolbar got a ✎ "highlight +
  note" button. Styles under `[data-pore-hl-*]`.
- **Why:** F2 shipped a `note` field but no way to write one; the demo list was
  ad-hoc markup.
- **State:** committed. 255 unit + 35 e2e green (2 new e2e assertions/tests),
  typecheck + lint clean. `docs/m5-plan.md` F2b marked done.
- **Notes:** `HighlightRecord` stays single-shape here; the `kind:'text'|'rect'`
  union lands in F2c. Note editor is inline-per-row (not a Radix Popover) —
  simpler, panel reusable as-is. Rows remount on external colour/note change
  via `key` rather than being controlled.

## 2026-09-06 — M5 G1: menu bar placement + auto-hide
- **What:** Bar placement (top/left/right, all engines) + Always-visible vs
  Auto-hide behaviour, moved out of `TextEngineSettings` into demo-owned
  `use-menu-bar.ts` / `use-fullscreen.ts` / `MenuBarSettings.tsx`. Fullscreen
  forces auto-hide. `<SettingsPanel>`/`<TextSettingsPanel>` gained `extraTabs`.
  Text engine forwards throttled iframe `pointermove` to host so auto-hide
  wakes over the reading area. Side bars use symmetric explicit
  `transform: translateX(0)` ↔ `±100%` endpoints (a frozen reveal transition
  otherwise). 2 new e2e tests.
- **Why:** user asked for movable menu bar + fullscreen behaviour + the
  "dead strip when the top bar hides" bug.
- **State:** committed `ddeeb52`, pushed. `docs/m5-plan.md` G1 marked done.
- **Notes:** hover edge hot-zone deferred — `:hover`/`:focus-within` + the
  forwarded iframe pointermove proved enough.

## 2026-09-05 — demo polish (floating bar, sepia, progress colour, landing, bundle)
- **What:** floating top bar as absolute overlay (no dead strip); top-bar theme
  button cycles light→sepia→dark on EPUB; progress bar / scrubber use theme
  foreground not the orange accent ("whitearchive"); demo opens on a landing
  page (open-your-own-file + try-every-mode); pdf.js code-split via
  `setPdfWorkerSrc()`; "Resumed from p.N" toast auto-dismisses after 15s.
- **State:** committed `7c735da`, `3c2940f`, `329e63c`, `d15b258`, `065e28f`.
  `CHANGELOG.md` Unreleased.

## 2026-09-05 — e2e suite passes end-to-end for the first time
- **What:** ran the full Playwright suite to completion (first time ever) and
  fixed the 6+ pre-existing failures it surfaced: TOC nav double-resolving
  hrefs, `role="tablist"` ARIA violation, offline download broken 3 ways,
  settings focus not returning on Escape, `offsetOfPoint` not handling
  `selectNodeContents` boundaries, stale glyph-based selectors.
- **State:** committed `91f94d5`.
- **Notes:** **run `pnpm --filter @pore/demo e2e` every milestone** — unit tests
  + manual browser both missed all of these. Query buttons by aria-label.

## 2026-09-05 — M4 F1–F6 shipped, tagged `v0.7.0-annotate`
- **What:** F1 epubcfi-precise text ranges, F2 text highlights (storage via
  optional `ReaderSource.loadHighlights`/`saveHighlights`), F3 fixed-layout
  EPUB, F4 `OpdsSource` (OPDS 1.2 Atom), F5 TTS (EPUB, Web Speech), F6
  hardening. See `docs/m4-plan.md` for the retro-notes on each.
- **State:** committed `5236d0a`..`5195747`, tagged `v0.7.0-annotate`, pushed.
