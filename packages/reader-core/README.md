# porejs

Framework-agnostic web **reader engine** for manga, comics and books — its own
rendering + pagination, not a wrapper around anything.

- **Image engine** — paged single/double (spread pairing, RTL/vertical),
  continuous vertical/horizontal (virtualized), zoom/pan, fit modes, preload.
- **Text engine** — EPUB reflowable: sandboxed-iframe + CSS-multicol pagination,
  themes, adjustable typography, TOC, footnotes, vertical-JP, an accessible
  flow mode, `epubcfi`-shaped portable positions.
- **PDF engine** — pdf.js pages + a searchable text layer + rect highlights.
- **Sources** — one small `ReaderSource` interface (`getManifest` / `getPage` /
  `getFile` / `loadProgress` / `saveProgress`, optional highlights + bookmarks).
  Built-ins: `DemoSource`, `LocalFileSource`, `CachedSource` (offline + resume),
  `KavitaSource`, `OpdsSource`.
- In-book full-text **search** (Worker-backed), **highlights** + **bookmarks**,
  **TTS**.

**On React?** Use [`porejs-react`](https://www.npmjs.com/package/porejs-react)
— `<Reader>` + hooks + headless components. This package is the layer beneath.

## Install

```bash
npm i porejs
```

ESM-only, Node ≥ 20 / evergreen browsers.

## Use (no framework)

```ts
import { createTextEngine, DemoSource } from 'porejs';

const source = new DemoSource();
const engine = createTextEngine({
  container: document.getElementById('reader')!,
  source,
  bookId: 'demo-book',
});

engine.on('reader:progress', (p) => console.log(p.percent));
engine.turn('forward');
// engine.goto / setSettings / search / getCfi / addHighlight / destroy
```

Pick `createImageEngine` for manga/CBZ, `createPdfEngine` for PDF —
`porejs-react`'s `<Reader>` auto-selects by manifest type.

## Docs

- [Integration guide](https://github.com/srytmj/pore-js/blob/main/docs/integration.md)
- [Architecture](https://github.com/srytmj/pore-js/blob/main/docs/architecture.md)
- [Portability format](https://github.com/srytmj/pore-js/blob/main/docs/portability-format.md)

MIT © Surya
