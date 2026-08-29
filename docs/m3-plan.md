# Pore.js — M3 Plan (integration, offline, search)

**Goal:** the reader talks to a real library server (Kavita), works fully
offline, searches inside books, handles vertical-JP text, and has a screen-reader
flow mode. This is the last "fundamentals" milestone before UI polish.

**Why Kavita:** the maintainer runs Kavita on a homelab, so `KavitaSource` is a
source Pore.js can be dogfooded against for real — it replaces the never-built
`WhiteArchiveSource` mock. Kavita has a stable REST API + OPDS; we still test
against recorded response shapes (no live server in CI).

**Design:** [`reader-engine-design.md`](reader-engine-design.md) §4, §7, §9, §10,
§14 · builds on `v0.4.0-m2`. Target tag: `v0.5.0-m3`.

---

## I1 — `KavitaSource` · M ✅

- [x] `KavitaSource(baseUrl, { apiKey, pluginName?, fetch? })` implements
      `ReaderSource`. `bookId` = Kavita `chapterId` (the unit Kavita's reader
      addresses — a book chapter or a manga chapter).
- [x] Auth: `POST /api/Plugin/authenticate?apiKey=&pluginName=pore-js` → JWT;
      `Authorization: Bearer` on every call; one transparent re-auth on 401 then
      `KavitaAuthError`. Key stays out of query strings **except** the image
      endpoint, which requires `apiKey=` (documented Kavita contract).
- [x] Manifest: `GET /api/Reader/chapter-info` → `seriesFormat`
      (Image/Archive → `image` with `pages` synthetic page list; Epub → `epub`;
      Pdf → `pdf`); title from chapter-info; ids cached for progress
- [x] `getPage(id, n)` → `GET /api/Reader/image?chapterId=&page=&apiKey=`
- [x] `getFile(id)` → `GET /api/Download/chapter?chapterId=`; 403 →
      `KavitaDownloadForbiddenError` (account needs the Download role)
- [x] Progress: `GET /api/Reader/progress` → `{ type:'page' }` `Position`;
      `POST /api/Reader/progress` `{ pageNum, chapterId, seriesId, volumeId,
      libraryId }` — `pageNum` derived from page / scroll / anchor positions
- [x] Retry/backoff on 429 + 5xx, `AbortSignal` passthrough
- [x] Vitest (10, fake `fetch` with recorded shapes): manifest per format, image
      fetch (key + bearer), progress round-trip, scroll→pageNum, 401 refresh,
      403 download, bad-key `KavitaAuthError`
- [x] **No live integration** in CI — homelab server isn't reachable there

**Done when:** `new KavitaSource(url, { apiKey })` opens a manga chapter and a
book against a mock of Kavita's API; the maintainer points it at the real
homelab instance. ✅ done 2026-08-29
_(demo "Connect to Kavita" input field → deferred to the UI milestone; the
source is usable programmatically now)_

---

## I2 — offline: full page/file caching + `CachedSource` v2 · L ✅

- [x] `MediaCache` — blob store (its own IndexedDB DB) keyed `blob:<bookId>:<slot>`
      (`slot` = page index or `"file"`) + `meta:<bookId>` bookkeeping
      (`{ slots, bytes, at, pageCount }`); LRU whole-book eviction against a
      byte budget (default 500 MB, `budgetBytes` tunes it)
- [x] `CachedSource` v2 — `getPage` / `getFile` serve the cached blob first;
      `download(bookId, { signal, onProgress })` pulls every page (image) or the
      file (epub/pdf), resumable; `downloadStatus` / `downloadState`
      (`none` / `partial` / `complete`), `removeDownload`. `cache: false` keeps
      the old progress-only behaviour.
- [x] Read path: cache-first, source fallback (populate happens via `download`,
      not silently on every read — keeps the budget predictable)
- [x] Demo service worker (`public/sw.js`, no Workbox): SWR for the app shell,
      cache-first for `/fixtures/**` + the pdf.js worker; registered in prod only
- [x] `reader-react` `useDownload(bookId)` hook; demo chrome shows a
      ⬇ / progress / ✓ offline button
- [x] Vitest: `MediaCache` (4 — bytes, no double-count, LRU eviction w/ injected
      clock, removeBook) + `CachedSource` offline (4 — full download + serve,
      resume partial, text file blob, budget eviction)
- [x] Browser-verified: downloaded demo-manga → 12 page blobs + meta in
      `pore-media`; button reads "✓ offline"; pages serve without the source

**Done when:** download a book, kill the network, read it start to finish. ✅ done
2026-08-29

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

- [ ] Playwright: Kavita-source mock flow, offline download+read, search,
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
