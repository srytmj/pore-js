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
