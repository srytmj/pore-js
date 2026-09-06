# Getting started

Add a full reader — manga, comics, EPUB, PDF — to a React app. You bring a
content source and a mount point; `porejs` is everything else.

> Not on React? `porejs` alone gives you `createImageEngine` /
> `createTextEngine` / `createPdfEngine` over the same `ReaderSource`. This
> guide is the React path.

## 1. Install

```bash
npm i porejs porejs-react
# peers: react >= 19, react-dom >= 19 (gsap is optional — eased page turns)
```

ESM-only, Node ≥ 20, current + previous major of Chrome / Firefox / Safari.

## 2. A source

A `ReaderSource` maps *your* book ids to a manifest, page bytes and a reading
position. The quickest start is the bundled `DemoSource` (fixtures, no backend);
swap it for your own once it renders.

```ts
import { CachedSource, DemoSource } from 'porejs';

// CachedSource adds local-first resume + offline caching around any source
export const source = new CachedSource(new DemoSource());
```

Your real source is ~40 lines over your existing API — see
[`integration.md` §2](integration.md) and the worked example in
[`examples/host-app/`](../examples/host-app).

## 3. Mount `<Reader>`

```tsx
import { ReaderProvider, Reader } from 'porejs-react';
import { source } from './source';

export function BookView({ bookId }: { bookId: string }) {
  return (
    <ReaderProvider source={source}>
      {/* size it however you like — the reader fills its box */}
      <Reader bookId={bookId} className="reader-host" style={{ height: '100dvh' }} />
    </ReaderProvider>
  );
}
```

That's a working reader: pagination, themes, pinch-zoom, keyboard / tap / swipe
nav, resume. `<Reader>` picks the image / text / PDF engine from the manifest.

## 4. Style the chrome you want

`porejs-react` ships **no CSS**. The headless components carry `data-pore-*`
hooks; you style them, and you decide which to show.

```tsx
import { useReader, useReaderLocation, TableOfContents, SettingsPanel } from 'porejs-react';

function Toolbar() {
  const reader = useReader();
  const loc = useReaderLocation();
  return (
    <div className="my-toolbar">
      <button onClick={() => reader.turn('back')}>‹</button>
      <span>{loc ? `${loc.page + 1} / ${loc.total}` : '…'}</span>
      <button onClick={() => reader.turn('forward')}>›</button>
      <TableOfContents />
    </div>
  );
}
```

Hooks: `useReader`, `useReaderLocation`, `useReaderProgress`,
`useReaderSettings`, `useReaderSearch`, `useReaderHighlights`, `useBookmarks`,
`useTts`, `useTableOfContents`, `useReaderHistory` (tab title / URL — opt-in).
Components: `<SettingsPanel>`, `<TableOfContents>`, `<HighlightsPanel>`,
`<BookmarksPanel>`, `<ReaderScrubber>`, `<FootnotePopover>`,
`<ReaderAnnouncer>` (mount once for screen readers).

**A complete worked stylesheet** is `apps/demo/src/styles.css` in the repo —
copy from it.

## 5. PDF worker (only if you show PDFs)

pdf.js is a lazy chunk. Point it at its worker once at startup so it stays out
of your main bundle:

```ts
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'; // Vite
import { setPdfWorkerSrc } from 'porejs';
setPdfWorkerSrc(pdfWorkerUrl);
```

## Next

- [`integration.md`](integration.md) — the `ReaderSource` seam, the embed
  story, security / CSP, bundle size.
- [`architecture.md`](architecture.md) — how the engines work.
- [`stability.md`](stability.md) — what `v1.x` SemVer covers.
