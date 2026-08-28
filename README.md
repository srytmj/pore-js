# Pore.js

Source-agnostic web reader engine for manga (image-based) and text (EPUB, PDF,
CBZ). Custom rendering + pagination engine, not a wrapper.

> **Design docs:** [`docs/reader-engine-design.md`](docs/reader-engine-design.md) ·
> [`docs/image-engine-spec.md`](docs/image-engine-spec.md) ·
> [`docs/m0-plan.md`](docs/m0-plan.md)

## Workspace

```
packages/
  reader-core     TypeScript, framework-agnostic — sources, image engine, position, settings
  reader-react    React 19 bindings — <Reader>, hooks
apps/
  demo            Vite app, generated fixtures — the public demo
fixtures/         provenance notes; image fixtures are generated
```

## Develop

```bash
corepack enable
pnpm install
pnpm gen:fixtures   # generate the demo image fixtures (CC0 synthetic)
pnpm dev            # run the demo at http://localhost:5173
pnpm build          # build the packages
pnpm test           # vitest (reader-core)
pnpm typecheck      # tsc -b across the workspace
pnpm lint

pnpm --filter @pore/demo e2e:install   # one-time: Playwright browser
pnpm --filter @pore/demo e2e           # end-to-end demo tests
```

Requires Node >= 20.

## Status — M0 (image engine)

Done: image engine with paged single/double (spread pairing, `spreadOffset`,
late wide-page discovery), continuous-vertical webtoon with virtualization,
LTR/RTL, fit modes, zoom/pan, preload (`window` + whole-chapter `all` with a
byte guard), remappable keyboard + tap zones + swipe + wheel, last-read
checkpoint (IndexedDB via `CachedSource`), `<Reader>` React bindings, and a
deployable demo.

See [`docs/m0-plan.md`](docs/m0-plan.md) for the task-by-task breakdown and the
M0.5 backlog (continuous-horizontal, vertical-JP, autoscroll, `bitmap` decode,
full settings panel, image filters).

Next milestones (design doc §14): M1 EPUB reflowable · M2 PDF + unified shell ·
M3 platform integration + offline + search.

## License

MIT
