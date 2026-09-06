# Pore.js — M7 Plan (library & portability)

**Goal:** turn the demo from "try these samples" into a reader you'd keep
coming back to. A real **library** of what you've opened (with progress),
**named bookmarks**, a place to **review your annotations across books**, and
**portable** positions/highlights — export/import a JSON bundle, and deep-link
a passage by `epubcfi`. This is where the CFI work from M4 finally pays off
visibly. Still self-contained, still no backend.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §2 (goal 4 —
"Position tracking that round-trips across devices"), §5 (Position / CFI), §7
(selection) · builds on `v0.9.0-editorial`. Target tag: `v0.10.0-library`.

**Scope boundary.** New *optional* `ReaderSource` methods
(`loadBookmarks?` / `saveBookmarks?`), one new engine method (`goToCfi`), and
new headless `reader-react` components — all additive. The library, the
annotations view, and export/import live in `apps/demo` (a demo-level
`useLibrary()` over IndexedDB); `reader-core` gains no "list every book" API it
couldn't fulfil for a non-caching source.

Sequential, one commit per task.

**Open questions — decided (2026-09-06):**
1. Bookmarks → a **`reader-react` layer** (`useBookmarks` over `getCfi` /
   `goToCfi` / the source). `reader-core` gets `goToCfi` (L0) and nothing else.
2. Library → a **demo-level `useLibrary()`** over its own IndexedDB store.
3. Re-openable local files → **simple**: downloaded (cached) books re-open from
   the shelf; other dropped files are history and prompt for the file again.
   File System Access API is a later progressive enhancement.
4. Export → **per-book + whole-library** JSON. No plain-CFI-list text export.
5. Deep-linked passage → **navigate + a ~2s transient pulse** on the target
   range (reuses the highlight renderer look, not persisted).
6. Annotations review → a **full-screen overlay from the library header**. No
   router.

---

## Why this order

```
L0 (goToCfi + bookmark plumbing)  ── small engine groundwork, unblocks L1 + L5
        │
        ├─→ L1 (bookmarks)  ─→ L3 (annotations review)  ─→ L4 (export / import)
        ├─→ L2 (library / home)                          ──┘
        └─→ L5 (share a passage — needs L0's goToCfi)
                    │
                    └─→ L6 (hardening + release)
```

`L0` is the gate for anything CFI-navigable. `L1`/`L2` are independent and can
reorder. `L3` needs L1 + the existing highlights. `L4` needs L1 + a schema.
`L5` needs L0. `L6` ships it.

---

## L0 — Engine groundwork: `goToCfi` + bookmark persistence · S · **DONE**

- [x] **`goToCfi(cfi)`** on `TextEngine` + `ReaderHandle` (`EngineLike` too),
      no-op on image/PDF. `parseCfi` → a `pendingCfi`; `resolvePendingCfi()`
      (called in `renderSpine`'s finish + synchronously when the target is the
      current spine) resolves the element via `resolveCfiElement`, walks up to
      the nearest block, and hands a `pendingAnchor` to the normal anchor path.
- [x] **`Bookmark` type** in `source/types.ts` (`{ id, position, cfi?, label,
      text?, createdAt }`), exported from both packages.
- [x] **Optional `ReaderSource.loadBookmarks?` / `saveBookmarks?`**;
      `CachedSource` implements both local-first (mirrors the highlights
      pattern, `#bmKey`).
- [x] Vitest: `goToCfi` never throws (bad string / shaped string); bookmark
      round-trip through `CachedSource` + graceful degradation. cfi.test.ts
      already covers `serialize → parse → resolveCfiElement`.

**Done when:** `handle.goToCfi(handle.getCfi())` is a no-op, and a source can
load/save bookmarks. ✓

---

## L1 — Bookmarks · M · **DONE**

`useBookmarks()` in `reader-react` (over the handle + source): `add(label?)`
snapshots `location.position` + `getCfi()` + page/percent, `goTo()` uses the
exact `position` (cfi kept for export), `toggle()` adds/removes the one on the
current page, `isBookmarkedHere`. Headless `<BookmarksPanel>` (`data-pore-bm-*`
— jump / inline rename / remove). `ReaderCtx` gained `bookId` + `source`. Demo:
a Bookmarks button in the rail (filled icon when the page is bookmarked), the
panel with a "Bookmark this page" toggle, and a `b` keybind. e2e: add with `b`,
turn away, jump back, survives reload.

<details><summary>Original notes</summary>

Manual, named bookmarks — distinct from the single auto-resume checkpoint.

- [ ] **`reader-react` `useBookmarks()`**: `{ bookmarks, add(label?),
      remove(id), goTo(bookmark) }`. `add()` snapshots the current
      `Position` + `getCfi()` + a short `text` label from the location; writes
      through `source.saveBookmarks`. `goTo()` prefers `goToCfi` when there's a
      cfi, else `goto(position)`. Lives in `reader-react` over the handle + the
      source — the engine doesn't own a bookmark list.
- [ ] **Headless `<BookmarksPanel>`** (like `<HighlightsPanel>`): `<ol>` with
      `data-pore-bm-*` hooks — jump / rename (inline) / remove. Renders nothing
      on a source without `loadBookmarks`.
- [ ] **Demo**: a bookmark toggle in the rail (adds/removes a bookmark *at the
      current page* — filled when the current page is bookmarked), the panel,
      and a keybinding (`b`).
- [ ] Vitest: `useBookmarks` add/remove/goTo round-trip. Playwright: add a
      bookmark, turn pages, jump back to it, reload — it's still there.

**Done when:** you can drop a named bookmark, leave, and jump back to it after
a reload.

</details>

---

## L2 — The library / home · M · **DONE**

The demo's landing becomes a home screen with a shelf of what you've read.

- [x] **`useLibrary()` in the demo** (`apps/demo/src/use-library.ts`) — over
      IndexedDB (`openKvStore` from `@pore/reader-core`, one key
      `pore:demo:library` → `LibraryEntry[]`). `{ id; title; glyph; kind:
      'sample' | 'file'; lastOpened; percent }`. `record()` on open (creates /
      bumps, keeps prior `percent`), `setProgress()` from `<Reader
      onPositionChange>` (dead-zoned 0.5%), `remove()`. Capped at 24, newest
      first.
- [x] **"Continue reading"** section on `<Landing>` (above "Open your own"):
      each row = `<Glyph>` + title + `"42% · 3 min ago"` + a thin progress
      track, and a `✕` forget button. Click a sample row = resume; a file row
      re-opens the file picker (handles don't persist — labelled "re-pick the
      file").
- [x] **Re-openable vs history.** Samples resume in place. Dropped files are
      history: the row prompts for the file again. (Open question #3: File
      System Access API deferred.)
- [x] **Remove from library** — `onForget` → `library.remove(id)`. (Clearing
      cached download data on forget deferred to L6 hardening.)
- [x] Playwright: open two samples, go home, the shelf lists both newest-first;
      resume one (`?book=` changes); remove one → count drops, other remains.

**Done when:** the landing shows what you've been reading, with progress, and
you can pick up where you left off in one click.

---

## L3 — Annotations review · M · **DONE**

One place to see every highlight, note and bookmark you've made.

- [x] **`<AnnotationsReview>`** (`apps/demo/src/AnnotationsReview.tsx`) — a
      full-screen `role="dialog"` overlay, reached from a "My annotations" link
      in the "Continue reading" header. Grouped by book, each group collapsible
      (`aria-expanded`). Highlights show a colour swatch + quote + note;
      bookmarks show a `▸` + label + text snapshot. A `type="search"` text
      filter matches quote / note / label.
- [x] **Jump** — `onJump({ bookId, cfi? , position? })` stashes a one-shot in
      `pendingNavRef`, closes the overlay, `openSample(bookId)`; a `<PendingNav>`
      inside `<Reader>` calls `handle.goToCfi` (or `handle.goto`) once
      `useReaderLocation()` is non-null. Text highlights jump by `cfi.start`,
      bookmarks by `cfi` or exact `position`.
- [x] Reads `source.loadHighlights` / `loadBookmarks` per library book straight
      off the shared demo source — no aggregate API in core. **Sample books
      only** (they all share the demo source); dropped files keep their
      annotations but aren't listed until re-opened.
- [x] Playwright: highlight a sample, go home, open the review, filter (empty →
      restore), jump back to the passage.

**Done when:** you can find and jump to any annotation across all your books
from a single screen.

---

## L4 — Export / import · M

Portable, versioned, documented.

- [ ] **`docs/portability-format.md`** — a versioned JSON schema:
      `{ format: "pore.js/annotations", version: 1, exportedAt, books: [{ id,
      title, position?, highlights: HighlightRecord[], bookmarks: Bookmark[] }] }`.
      Text highlights carry their `cfi` (the portable anchor); rect highlights
      carry `page` + `rects`.
- [ ] **Export** in the demo: one book, or the whole library → a downloaded
      `.json`. (The download is a Blob + object URL — no backend.)
- [ ] **Import**: pick a `.json`, validate against the schema version, merge
      into the local stores (by `id`; existing entries with the same id are
      kept unless `--overwrite`). Report what was merged.
- [ ] Round-trip test: export a book's annotations, clear storage, import,
      everything's back. Playwright covers the UI; Vitest covers the
      merge/validate logic (pull it into a small `apps/demo/src/portability.ts`
      that's unit-testable).

**Done when:** you can move your highlights + bookmarks between two browsers
via a file, and the CFIs still resolve after re-pagination.

---

## L5 — Share a passage · S

Cash in the CFI work.

- [ ] **"Copy quote"** on a highlight row and on the selection toolbar →
      clipboard gets the quoted text + a citation line (chapter · a deep link
      `…/?book=<id>&cfi=<epubcfi>`).
- [ ] **`?cfi=` deep link.** On mount, if the URL has `cfi`, the demo waits for
      the engine and calls `handle.goToCfi(cfi)`, then briefly pulses the
      target range (a 2s highlight-style flash, reusing the highlight renderer's
      look, no persisted record).
- [ ] The link is copy-only — no shortener, no server. It's a portable
      pointer into a book the recipient also has.
- [ ] Playwright: highlight a passage, copy its link, open the link in a fresh
      context → lands on that passage.

**Done when:** you can copy a link to a specific sentence and opening it jumps
there.

---

## L6 — Hardening + release · S

- [ ] a11y: the bookmarks panel, the library shelf, the annotations review,
      the import dialog — keyboard-reachable + axe clean (light + dark).
- [ ] Playwright: bookmark round-trip, library resume, review jump, export →
      import round-trip, `?cfi=` deep link.
- [ ] `docs/integration.md` + `docs/architecture.md` updated for the new
      source methods / `goToCfi` / the headless `<BookmarksPanel>`.
- [ ] `CHANGELOG.md` `v0.10.0-library`; `README.md` status; `CLAUDE.md`;
      `docs/agent-worklog.md`.
- [ ] Tag `v0.10.0-library`.

---

## Cut from M7 / still deferred

- **Fixed-layout two-page spreads (F3b)** — engine reshape, its own task
  (deferred since M5).
- **Real cross-device sync** — needs a backend; export/import is the offline
  substitute. `WhiteArchiveSource` (Project A) is the eventual home for sync.
- **Import from KOReader / Calibre / Readwise** — interop with other tools'
  formats is a separate task; M7 ships Pore.js's own format only.
- **Collections / tags / reading goals** — library organisation beyond
  "recently opened" is out of scope.
- **Bottom-edge menu bar**, **OPDS 2.0** — unchanged from earlier cut lists.

---

## Open questions to settle before L0 starts

1. **Bookmarks — `reader-react` layer or engine API?** Leaning `reader-react`
   (`useBookmarks` over `getCfi` + `goToCfi` + the source): keeps `reader-core`
   lean, and a bookmark is just "a saved Position + label". Downside: three
   engines would each need a `goToCfi` no-op stub anyway (already the pattern
   for `getCfi`).
2. **Library storage.** A demo-level `useLibrary()` over its own IndexedDB
   store (leaning this) vs. teaching `CachedSource` to enumerate what it holds.
   The latter leaks "list all" semantics into a source interface that can't
   always answer.
3. **Re-openable local files.** File System Access API
   (`showOpenFilePicker` → persist the `FileSystemFileHandle` in IDB →
   `handle.getFile()` on resume) gives real re-openable dropped files, but only
   on Chromium and behind a permission re-prompt. Ship it as a progressive
   enhancement, or keep it simple (downloaded = re-openable, else history)?
4. **Export scope in the UI.** Per-book only, per-book + "everything", or also
   a "just this book's highlights as a plain CFI list" text export for quick
   sharing?
5. **Deep-linked passage.** Navigate only, or navigate + a transient pulse on
   the target range? Leaning pulse (reuses the highlight look, ~2s, not
   persisted).
6. **Where does the annotations review live?** A separate URL/route
   (`/?view=annotations`), a full-screen overlay from the library, or a tab on
   the landing? Leaning: a full-screen overlay reachable from the library
   header — no router needed.
