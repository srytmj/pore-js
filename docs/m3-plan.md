# Pore.js — M3 Plan (integration, offline, search)

**Goal:** the reader talks to the White Archive platform, works fully offline,
searches inside books, handles vertical-JP text, and has a screen-reader flow
mode. This is the last "fundamentals" milestone before UI polish.

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §4, §7, §9, §10,
§14 · builds on `v0.4.0-m2`. Target tag: `v0.5.0-m3`.

---

## I1 — `WhiteArchiveSource` · M

- [ ] `WhiteArchiveSource(baseUrl, auth)` implementing `ReaderSource` against
      libs `/api/v1` (shape from `srytmj/whitearchive` §10)
- [ ] Endpoints: connection-scoped library/series browse (cursor pagination),
      book metadata → `Manifest`, signed media URLs for `getPage` / `getFile`,
      `read_progress` GET/PUT for `loadProgress` / `saveProgress`
      (last-writer-wins)
- [ ] HMAC media-URL handling; token in `Authorization`, never in query strings
- [ ] Retry/backoff, `AbortSignal` passthrough, 401 → `reader:autherror`
- [ ] Vitest against a mock server (msw or a fake fetch): manifest adaptation,
      pagination, progress round-trip, signed-URL expiry refresh
- [ ] **No live integration** — libs isn't running here; tests use the documented
      response shapes

**Done when:** `<Reader source={new WhiteArchiveSource(...)} bookId>` works
against a mock of the platform API.

---

## I2 — offline: full page/file caching + `CachedSource` v2 · L

- [ ] `CachedSource` caches **pages and files** in IndexedDB (not just progress),
      keyed by `bookId` + variant; LRU eviction with a size budget setting
- [ ] `download(bookId)` — pull the whole book (image: page range; text/pdf: the
      file) into IndexedDB; `downloadState(bookId)` + `reader:downloadprogress`
- [ ] Read path: IndexedDB first, network fallback, populate on read
- [ ] Offline write queue already exists (progress) — extend the flush to any
      pending mutation
- [ ] Service worker (Workbox) preset the demo app registers: engine assets +
      demo fixtures + pdf.js worker cached; `CacheFirst` for media
- [ ] `reader-react` `useDownload(bookId)` hook
- [ ] Vitest (fake-indexeddb): download → go offline → read; eviction budget

**Done when:** download a book, kill the network, read it start to finish.

---

## I3 — in-book search · L

- [ ] EPUB: on load, extract plain text per spine (Range/`textContent`), build a
      lightweight inverted index **in a Worker**; hits map to `anchor`s
- [ ] PDF: `getTextContent(n)` per page, same index; hits map to page + rect
- [ ] Image: no text search (skip); CBZ same
- [ ] `engine.search(query) → SearchHit[]`; `engine.gotoHit(hit)`; highlight via
      CSS Custom Highlight API (fallback: wrap in `<mark>`)
- [ ] `reader:searchresults` event; `reader-react` `useReaderSearch()`
- [ ] Debounced incremental search, cancellable
- [ ] Vitest: index build + query on a fixture; anchor/page mapping; worker
      message contract (worker stubbed)

**Done when:** search "consequat" in the demo EPUB, jump between hits.

---

## I4 — vertical-JP text · M

- [ ] Text engine: `writing-mode: vertical-rl` on `#pore-flow`; pagination math
      switches to `scrollHeight / pageHeight` (columns become rows)
- [ ] Page-turn + gestures flip to the vertical axis; RTL column flow reuses this
- [ ] `TextEngineSettings.verticalText: boolean` (or auto from
      `-epub-writing-mode` / `page-progression-direction`)
- [ ] A vertical-JP fixture (public-domain Aozora Bunko text repackaged, or
      synthetic)
- [ ] Vitest: vertical page math; turn direction

**Done when:** a vertical Japanese EPUB reads top-to-bottom, right-to-left.

---

## I5 — a11y flow mode · M

- [ ] Text engine: a "continuous flow" mode — no pagination, semantic HTML in
      the iframe rendered as a normal vertical scroll for screen readers
- [ ] Toggle: `TextEngineSettings.flowMode` or auto when a screen reader / forced
      colors is detected
- [ ] Image engine: a linear "one image per screen, scroll" a11y fallback with
      `alt` from the manifest
- [ ] Focus management, live-region page announcements, skip-to-content
- [ ] Playwright + axe: keyboard-only traversal of a whole book

**Done when:** a screen-reader user can read a book linearly.

---

## I6 — hardening + release · S

- [ ] Playwright: platform-source mock flow, offline download+read, search,
      vertical-JP, flow mode
- [ ] Perf: worker lifecycle, index memory, cache budget honoured
- [ ] CHANGELOG `v0.5.0-m3`; README; docs; **fundamentals complete** note
- [ ] Tag `v0.5.0-m3` → then start `docs/ui-foundation-plan.md`

---

## Dependency graph

```
I1 ─┐
I2 ─┼─→ I6
I3 ─┤
I4 ─┤
I5 ─┘
```

I1–I5 are largely independent; I2 (SW) and I3 (search) both touch the demo app
last. I6 gates the milestone.

## After M3

`docs/ui-foundation-plan.md` (Radix + Tailwind + GSAP). Then M4+: CFI,
highlights/notes, TTS, OPDS.
