# Pore.js — M6 Plan (editorial redesign)

**Goal:** the demo works but doesn't *look* finished — the reader chrome is a
dense row of unlabeled icon buttons and raw `<select>`s, status is shown twice,
the settings panel is a bare form, the landing page is thin, and the palette is
half-migrated (the orange accent was pulled from the progress bar + active
toggles in M5 and now reads as leftover). M6 is a **design pass, not a feature
milestone**: give the demo a quiet, reading-first identity and make every
surface feel deliberate.

**Direction (settled):**

- **Aesthetic — quiet / editorial.** Reading-first. Warm paper tones, strong
  typography, generous whitespace, chrome that recedes. Reference points: Apple
  Books, iA Writer, Readwise Reader.
- **Accent-less.** Monochrome UI on warm neutrals + **one** functional colour
  for state (focus ring, error, destructive). Finishes the direction M5 started.
  The orange `--color-accent` is removed.
- **Bundled fonts.** Self-host an open-licence pair (proposal: **Literata** for
  the reading surface, **Hanken Grotesk** for UI — both OFL, variable, subset
  woff2). This also closes the standing "bundled reading fonts" backlog item —
  the reader's font menu gains real choices instead of only "Publisher".

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §9
(theming / settings), §8 (a11y) · builds on `v0.8.0-comfort`. Target tag:
`v0.9.0-editorial`.

**Scope boundary.** `reader-core` engine logic and `reader-react` component
*behaviour* do not change. `reader-react` stays headless — all styling lives in
`apps/demo/src/styles.css` and the demo's components. The one core touch is
`THEME_COLORS` in `text/create-text-engine.ts` (the reading-surface palette,
injected into the iframe) which must move in step with the shell palette.

Sequential, one commit per task. **Not started** — this doc is the scope for
discussion before D0 begins.

---

## Why this order

```
D0 (design language + tokens + fonts)  ── foundation, everything depends on it
        │
        ├─→ D1 (reader chrome)          ── the biggest visible fix
        ├─→ D2 (settings + panels)
        ├─→ D3 (landing / home)
        └─→ D4 (reading surface + font menu)
                    │
        D5 (motion + states) ─→ D6 (responsive) ─→ D7 (hardening + release)
```

D0 is the gate. D1–D4 are independent of each other once tokens exist and can
reorder. D5/D6 sweep across everything D1–D4 produced. D7 ships it.

---

## D0 — Design language: tokens, palette, type, fonts · M

The foundation. No visible feature — it re-bases every colour, size and font
the rest of M6 uses.

- [ ] **Palette.** Rebuild the `@theme` block in `styles.css`:
      - Warm neutrals, not the current near-grey. Light ground ~`#faf7f1`,
        surfaces a shade up, ink ~`#211d17`. Dark ground warm (~`#17150f`), not
        `#121212`.
      - Remove `--color-accent` / `--color-accent-fg`. Add `--color-focus`
        (single functional colour — a calm blue or the ink itself at a ring
        weight) and `--color-danger`.
      - Reading themes: keep four (light / sepia / dark / oled), warm each,
        make sure sepia and the new light aren't near-duplicates.
- [ ] **Sync `THEME_COLORS`** in `text/create-text-engine.ts` to the same four
      values (it's injected into the sandboxed iframe as `#pore-base-style`).
      `buildFixedLayoutStylesheet` / end-page background follow it already.
- [ ] **Type scale.** A real modular scale (e.g. 1.2) as tokens:
      `--text-xs … --text-2xl`, plus line-height + tracking tokens. One display
      use (landing hero, chapter headings), one text use.
- [ ] **Space + radius + elevation.** A 4px-based space scale as tokens; 2–3
      radii; 2 shadow levels (panel, popover) tuned for the warm ground (softer,
      lower-contrast than the current hard drop shadow).
- [ ] **Fonts.** Vendor Literata + Hanken Grotesk under
      `apps/demo/public/fonts/` (variable woff2, Latin subset). `@font-face`
      with `font-display: swap` + `<link rel="preload">` for the two faces the
      first paint needs. Real fallback stacks. Confirm final pair in open
      questions first.
- [ ] `docs/design-language.md` — one page: the palette, the scale, the fonts,
      the "chrome recedes" principle, and the accent-less rule, so D1–D7 (and a
      future agent) have a reference.
- [ ] No Playwright churn expected here; `pnpm test` + axe still green.

**Done when:** the demo renders on the new tokens (even if individual
components aren't restyled yet), the orange is gone, and the fonts load.

---

## D1 — Reader chrome: from icon-soup to a calm bar · L

The headline fix. `apps/demo/src/Chrome.tsx` (~590 lines) owns the whole
reader chrome; today the top bar crams 12–15 equal-weight icon buttons + two
raw `<select>`s into one row.

- [ ] **Restructure the bar into three zones:**
      - *Primary* — prev / next, table of contents, search. Always visible.
      - *Overflow* — a "More" (`⋯`) Radix `DropdownMenu`: highlights, TTS, copy
        position, OPDS, fullscreen, home. One button instead of six.
      - *Settings* — the gear, opening the panel (D2).
- [ ] **Kill the raw `<select>`s.** TOC → Radix `DropdownMenu` (or keep
      `<TableOfContents>` headless and style its `data-pore-toc` select
      properly — decide in open questions). Book / engine picker → a
      `DropdownMenu` too, or move it off the reading bar entirely (it's a demo
      affordance, not a reader control — could live in a corner).
- [ ] **One status, not two.** Drop the top-right `A Complication · 37% · Ch
      2/3 · 4 min left` label; the bottom scrubber already carries it. Or invert
      (chapter/title top, scrubber bottom) — pick one home for each fact.
- [ ] **Icons.** Replace the emoji glyphs with a consistent SVG set (see open
      questions — leaning: vendor ~15 Lucide icons as inline components). Every
      icon button keeps its `aria-label` (the e2e suite and screen readers
      depend on the accessible names — don't regress them).
- [ ] **Resume toast.** Move `Resumed from p.N / Restart` out of the
      bottom-centre content overlap — a top slide-in that doesn't cover text,
      still auto-dismissing (M5's 15s).
- [ ] **Spacing + sizing rhythm** from the D0 tokens; consistent control
      height, hit targets ≥ 36px on coarse pointers (already partly there).
- [ ] Works in all three M5 menu placements (`top` / `left` / `right`) and both
      behaviours (always / auto-hide). The side rail especially needs the
      zone-grouping to read vertically.
- [ ] **Update the Playwright suite** — selectors that target `.bar--top`,
      button glyphs, or the old structure. Query by `role` + accessible name.
- [ ] Axe clean (contrast on the new palette, the DropdownMenu is Radix so
      focus/roles are handled).

**Done when:** the bar reads as three deliberate groups, no raw `<select>`, one
status location, and it still works docked left/right and auto-hiding.

---

## D2 — Settings panel + the floating panels · M

- [ ] **`<SettingsPanel>` presentation.** Still Radix Dialog + the headless
      `primitives.tsx` fields — restyle only. Grouped sections with quiet
      headers; the sliders (`SliderField`) get a proper track/thumb from the
      tokens; switches (`SwitchField`) lose the orange, gain a clear on/off
      read; inline values (`100%`, `1.50`, `6%`) become legible, not
      superscript. Calmer width, softer elevation.
- [ ] **Highlights panel + selection toolbar.** The `data-pore-hl-*` list and
      the swatch/✎ toolbar got minimal styling in M5 — a real pass: spacing,
      the note `<textarea>`, the colour swatches (still fine to use colour here
      — highlights are user content, not chrome), the row hover/active.
- [ ] **Footnote popover, OPDS browser, menu-bar settings tab, end-page /
      end-of-chapter cards** — bring onto the tokens; the end cards especially
      (they still use the old accent button).
- [ ] Focus-return and focus-trap behaviour already correct (M4 F6) — keep it.

**Done when:** every popover / panel / dialog uses the D0 tokens and none of
them look like a raw form.

---

## D3 — Landing / home · M

`apps/demo/src/Landing.tsx`. Today: centred wordmark, generic tagline, a dashed
drop zone, a grid of cramped equal-but-uneven cards, dead vertical space, no
footer.

- [ ] **Hero.** A real masthead — the name set in the display face, a one-line
      statement of what this is and that it's built from scratch with no
      backend. Room to breathe.
- [ ] **"Open your own"** — a calmer drop / choose zone; the supported-formats
      line readable.
- [ ] **"Try every mode"** — the seven sample fixtures as proper cards with a
      small visual cue per mode (a tiny SVG diagram of the layout — paged /
      webtoon / vertical / spread — not a screenshot). Even card heights,
      real hierarchy for the label vs blurb.
- [ ] **Footer** — GitHub link, the "Project A / Project B" story (one line),
      licence. Currently there's nothing.
- [ ] Responsive: hero + cards stack cleanly on mobile (D6 verifies).

**Done when:** the landing page has an identity and a footer, and the mode
cards are legible and even.

---

## D4 — Reading surface + the font menu · M

- [ ] **Measure + rhythm.** The reading column, heading treatment (chapter
      title), paragraph spacing / indent, first-paragraph handling. Tune per
      reading theme.
- [ ] **Font menu.** The reader's font control today is just "Publisher". Wire
      the bundled faces (Literata, + at least one sans reading option, +
      "Publisher") into `text-settings-panel.tsx`'s font field and the engine's
      font application. This is the visible payoff of bundling fonts in D0.
- [ ] **Progress bar + scrubber.** Already moved to the theme foreground in M5;
      refine weight / hit area / the tick marks on the new palette.
- [ ] **Loading skeleton + error states** (image + text engines) onto the
      tokens — they're currently plain.

**Done when:** a chapter looks typeset, not dumped, in all four reading themes,
and the reader offers a real font choice.

---

## D5 — Motion & interaction states · S

- [ ] Consistent enter/exit for panels, popovers, the bar reveal, the toast —
      one duration scale, one easing, all reduced-motion-aware (the page-turn
      GSAP path already is).
- [ ] `:focus-visible` rings everywhere from `--color-focus`; visible hover
      states; no focus loss when panels close (already handled — re-verify).
- [ ] Reduced-motion audit across the new transitions.

**Done when:** nothing pops or jumps; every interactive element has a visible
focus and hover state.

---

## D6 — Responsive / mobile · S

- [ ] Every surface at 375–430px: the bar (primary zone only + overflow;
      side-rail placements fall back to top on narrow), the settings panel
      (full-height sheet, not a tiny popover), the landing (stacked), the
      reading column, the highlights panel.
- [ ] Touch targets, safe-area insets (already partly done in `.bar`).

**Done when:** the demo is usable and looks intentional on a phone.

---

## D7 — Hardening + release · S

- [ ] Axe clean on the final palette — contrast for body, muted, disabled,
      focus, in light + dark + sepia + oled (the M4 iframe-exclude stays).
- [ ] Playwright green — all selectors updated for the new chrome; add a couple
      of visual-structure assertions (the three bar zones exist; the overflow
      menu opens).
- [ ] Fresh demo screenshots for the README (the current ones, if any, predate
      all of M4–M6).
- [ ] `CHANGELOG.md` `v0.9.0-editorial`; `README.md` status section;
      `CLAUDE.md` + `docs/agent-worklog.md`.
- [ ] Tag `v0.9.0-editorial`.

---

## Cut from M6 / still deferred

- **Fixed-layout two-page spreads (F3b)** — engine reshape, own task
  (deferred from M5).
- **Bookmarks, a library/shelf, annotation review, export/import, CFI
  deep-links** — the "Library & portability" feature milestone; a strong M7
  candidate once the UI is solid.
- **Bottom-edge menu bar**, **OPDS 2.0**, **cross-device sync**,
  **`WhiteArchiveSource`** — unchanged from the M5 cut list.
- Shipping CSS from `reader-react` — it stays headless. A `docs/theming.md` for
  consumers is a maybe, not in scope.

---

## Open questions to settle before D0 starts

1. **Font pair.** Proposed: **Literata** (reading serif) + **Hanken Grotesk**
   (UI sans). Alternatives for the reading face: Source Serif 4, Newsreader,
   Spectral. For UI: Inter (safe, common), IBM Plex Sans, Public Sans. Also:
   bundle a mono for labels/technical bits, or not? Confirm the pair before
   vendoring.
2. **Icons.** Vendor ~15 Lucide (ISC) or Phosphor (MIT) SVGs as local inline
   components, vs. keep the emoji glyphs (zero bytes, but inconsistent and
   platform-dependent). Leaning: vendor Lucide — small, consistent, themeable
   with `currentColor`.
3. **TOC control.** Keep `<TableOfContents>` rendering a native `<select>`
   (fully accessible, we just style `data-pore-toc`) or wrap it in a Radix
   `DropdownMenu` in the demo? Native is less code and a11y-safe; a menu looks
   more finished. Could do: native on mobile, menu on desktop.
4. **Demo shell theme vs reader theme.** M5 made the EPUB theme button drive
   both the reader's light/sepia/dark/oled and the demo `<html class="dark">`.
   Keep that coupling, or let the reader theme be the only thing that matters on
   a book page (shell theme only governs the landing)? Leaning: the latter —
   simpler mental model.
5. **Accent-less "one functional colour" — which?** A calm blue for focus/links
   is conventional and accessible; or push further and use the ink itself
   (focus = a thick ink ring, links = underline only). Leaning: ink-only for
   links, a single restrained blue for focus + error only.
6. **How warm?** Paper-warm (`#faf7f1`, visible cream) vs barely-warm
   (`#fbfaf8`, almost neutral). Editorial references lean visibly warm; confirm
   the light ground isn't too yellow for long reading.
