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

## Status — image reader complete (`v0.2.0-m0.5`)

The manga/comic reader is feature-complete:

- **Layout**: paged single/double (spread pairing, `spreadOffset`, late
  wide-page discovery), continuous vertical + horizontal (virtualized), LTR /
  RTL / vertical
- Fit modes, zoom/pan, image filters (brightness / greyscale / dim)
- Preload: `window` ring buffer + whole-chapter `all` (byte guard)
- Loading: `native` / `blob` / `bitmap` (canvas)
- Input: remappable keyboard, tap zones, swipe, wheel; autoscroll, paged
  auto-advance, next-chapter countdown
- Last-read checkpoint (IndexedDB via `CachedSource`)
- Sources: `DemoSource`, `LocalFileSource` (drop a `.cbz` or images)
- React: `<Reader>`, `<SettingsPanel>`, hooks, `useReaderHistory`

See [`docs/m0-plan.md`](docs/m0-plan.md) and [`docs/m0_5-plan.md`](docs/m0_5-plan.md)
for the task breakdowns, and [`CHANGELOG.md`](CHANGELOG.md).

Next milestones (design doc §14): **M1 EPUB reflowable** · M2 PDF + unified
shell · M3 platform integration + offline + search.

## License

MIT
