# Pore.js

Source-agnostic web reader engine for manga (image-based) and text (EPUB, PDF,
CBZ). Custom rendering + pagination engine, not a wrapper.

> **Design docs:** [`docs/reader-engine-design.md`](docs/reader-engine-design.md) ·
> [`docs/image-engine-spec.md`](docs/image-engine-spec.md)

## Workspace

```
packages/
  reader-core     TypeScript, framework-agnostic — sources, engines, position, settings
  reader-react    React 19 bindings
apps/
  demo            Vite app, bundled fixtures — the public demo
fixtures/         public-domain / CC-licensed content
```

## Develop

```bash
corepack enable
pnpm install
pnpm build          # build the packages
pnpm dev            # run the demo app
pnpm test           # vitest
pnpm typecheck      # tsc -b across the workspace
pnpm lint
```

Requires Node >= 20.

## Status

Scaffold. Image engine (M0) in progress — see the design doc §14 for milestones.

## License

MIT
