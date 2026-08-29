# Pore.js — UI Foundation Plan (Radix + Tailwind + GSAP)

**Stack decision:** Radix UI (accessible behavior primitives) · Tailwind CSS
(layout & styling) · GSAP (smooth animation — page transitions, zoom, panel
slide). GSAP is fully free as of 2025, plugins included.

**Goal:** a polished, portfolio-grade reading shell without compromising the
framework-agnostic core.

Builds on the current tree (`v0.3.0-m1` + text UX fixes). Target tag:
`v0.4.0-ui`. Sequential, one commit per task.

---

## Package strategy — where each dep lives

| Package        | Radix                                         | Tailwind                                                    | GSAP                                                                               |
| -------------- | --------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `reader-core`  | ✗ (stays vanilla/DOM-only)                    | ✗                                                           | ✗ direct — routed through an injectable **animation seam**                         |
| `reader-react` | ✓ behavior only, **headless** (no visual CSS) | ✗ (emits `data-pore-*` + Radix data-attrs; consumer styles) | ✓ optional `gsapAdapter` export, GSAP as an **optional peer dep** (tree-shakeable) |
| `apps/demo`    | —                                             | ✓ config + design tokens                                    | ✓ demo flourishes                                                                  |

Rationale: the engine must never depend on a UI framework (design doc §3). The
React layer gives _behavior_ (Radix) and an _animation adapter_ (GSAP); styling
is the consumer's (demo's Tailwind). This keeps `reader-react` reusable and
unopinionated about design.

---

## U1 — Tailwind + design tokens in the demo · S

- [ ] Tailwind v4 in `apps/demo` (`@tailwindcss/vite`), `prefers-reduced-motion` + `dark` (class strategy) wired
- [ ] Design tokens: color scale (bg/surface/text/accent), radius, spacing,
      reading-surface vars; light + dark
- [ ] Port the existing hand-rolled `styles.css` to Tailwind utility classes /
      `@apply` components — no visual regression
- [ ] Keep `styles.css` only for the tokens `@theme` block

**Done when:** the demo looks the same but is Tailwind-driven; dark mode toggles.

---

## U2 — Animation seam in `reader-core` · M

- [ ] `ReaderTransitions` interface: `page(el, from, to, ctx)` /
      `zoom(el, transform, reduced)` / `scrollTo(el, prop, to, reduced)` /
      `cancel()` — where `ctx` carries `{ axis, dir, reduced }`
- [ ] Default `instantTransitions` — sets style/prop synchronously (current behavior, zero cost)
- [ ] Image + text engines: route `applyPage` / `applyZoom` / programmatic scroll
      through `options.transitions ?? instantTransitions`
- [ ] `prefers-reduced-motion` checked once and passed as `reduced` so adapters
      can no-op
- [ ] Vitest: engines still work with the default adapter (no behavior change);
      a spy adapter receives the right calls

**Done when:** engines animate nothing by default but expose the hook.

---

## U3 — `reader-react` chrome on Radix (headless) · L

- [ ] Add `@radix-ui/react-*` deps: `dialog`, `tabs`, `slider`, `select`,
      `popover`, `switch`, `dropdown-menu`, `scroll-area`, `toggle-group`,
      `visually-hidden`
- [ ] Rebuild components, unstyled, emitting `data-pore-*` hooks:
  - `<ReaderSettings>` — Radix `Dialog` + `Tabs`; `Slider` for numeric, `Select`
    for enums, `Switch` for booleans; drives the same core/text settings
  - `<TableOfContents>` — Radix `DropdownMenu` (or `Select`) → `goToHref`
  - `<FootnotePopover>` — Radix `Popover` anchored to the noteref, `Dialog`
    fallback on small screens
  - `<KeybindEditor>` — Radix primitives + key capture
  - `<EndPageMenu>` — the centred end-of-book / end-of-chapter menu
- [ ] All components take `className`/`asChild` so the demo styles with Tailwind
- [ ] Keep the existing hooks (`useReaderLocation` …) unchanged
- [ ] Vitest + Testing Library: dialog open/close, tab switch, slider→setting

**Done when:** every piece of chrome is a Radix-backed, unstyled component.

---

## U4 — `gsapAdapter` (GSAP animation) · M

- [ ] `@pore/reader-react` exports `gsapAdapter(gsap)` → `ReaderTransitions`
- [ ] Page turn: direction-aware slide + slight fade (image paged & text);
      webtoon/continuous uses eased `scrollTo`; ~220 ms, `power2.out`
- [ ] Zoom / pan: eased transform; double-tap zoom springs
- [ ] `cancel()` kills tweens on rapid input (no queue build-up)
- [ ] `reduced === true` → every method falls back to instant
- [ ] Panel / chrome / popover enter-exit: via Radix data-attrs
      (`data-state=open/closed`) animated by GSAP or CSS in the demo
- [ ] Vitest: adapter calls `gsap.to` with expected vars; reduced-motion no-ops

**Done when:** `<Reader transitions={gsapAdapter(gsap)}>` gives smooth turns.

---

## U5 — Demo shell redesign (Tailwind) · L

- [ ] Chrome: auto-hiding top bar + bottom scrubber (design doc §9), tap-centre
      toggle, idle-hide; GSAP slide
- [ ] Scrubber: drag to seek, chapter ticks, "N min left" / "%"
- [ ] Loading: skeleton / blurhash-ish placeholder while `reader:loadingstate`
      is `loading`; error tile with retry
- [ ] Settings, TOC, end-page, footnote styled; consistent light/dark
- [ ] Responsive: mobile layout, safe-area insets, touch targets
- [ ] Drop zone, resume toast, capped-preload notice restyled

**Done when:** the demo reads like a finished product on desktop and mobile.

---

## U6 — polish + release · S

- [ ] a11y audit (focus traps, `aria-*`, reduced-motion across every new tween),
      axe clean
- [ ] Playwright: settings dialog, TOC jump, reduced-motion path, scrubber seek
- [ ] Perf: tween cleanup on unmount, no layout thrash on turn
- [ ] CHANGELOG `v0.4.0-ui`; README; demo GIF
- [ ] Tag `v0.4.0-ui`; deploy `pore.suryatmaja.dev`

---

## Dependency graph

```
U1 ─┐
U2 ─┼─→ U3 ─→ U4 ─→ U5 ─→ U6
```

U1 and U2 are independent. U3 needs neither but is smoother after U1. U4 needs
U2 (the seam) + U3 (Radix data-attrs). U5 pulls it all together.

## Notes

- **Per-book settings persistence** (currently deferred) folds into U3 — the
  settings store gets a `perBook` layer.
- The core animation seam also unblocks a future `curl`/`fade` page-turn style
  setting without touching the engines again.
