# ADR 0001 — reader-core public surface

**Status:** accepted · **Date:** 2026-08-28 · **Milestone:** M0 / T0

## Context

`reader-core` is consumed by `reader-react` and, eventually, by host apps
directly. The surface needs to be small, stable, and framework-agnostic (DOM is
fine, no React). The design doc (§4, §11) and the image-engine spec (§10) already
name most of it; this ADR freezes it before the engine is implemented.

## Decision

### Shared vocabulary lives in `src/types.ts`

`Direction`, `LayoutMode`, `FitMode`, `Variant`, `TurnDirection`. Every other
module imports from here — no more duplicate string-literal unions in
`source/types.ts` and `settings/types.ts`.

### Exported types

- **Source seam:** `ReaderSource`, `Manifest`, `ImageManifest`, `TextManifest`,
  `ImagePage`, `GetPageOpts`, `GetFileOpts`
- **Position:** `Position` + `clampPagePosition`, `isPagePosition`,
  `isScrollPosition`
- **Settings:** `ImageEngineSettings`, `ProgressBarSettings`,
  `DEFAULT_IMAGE_SETTINGS`
- **Keymap:** `Keymap`, `ActionId`, `DEFAULT_KEYMAP`, `resolveAction`
- **Engine:** `ImageEngine`, `ImageEngineOptions`, `ImageEngineEvents`,
  `ImageEngineEventName`, `PageLoadState`, `Unsubscribe`
- **Sources:** `DemoSource` (+ `DemoSourceOptions`); `LocalFileSource`,
  `CachedSource`, `WhiteArchiveSource` land in later milestones
- **Internals exposed deliberately:** `createStore`/`Store`,
  `createEmitter`/`Emitter` — small, dependency-free, useful to hosts

### Engine handle (`ImageEngine`)

```
mount(): Promise<void>        // manifest + checkpoint restore + first paint
goto(pageIndex: number): void
turn(dir: 'forward' | 'back'): void
setSettings(patch): void
setKeymap(patch): void
on(event, handler): Unsubscribe
destroy(): void
```

Construction is via a `createImageEngine(options)` factory (T2), not `new`, so the
implementation stays swappable and the returned object is the frozen interface.

### Manifest carries metadata only

`ImagePage` has no `src`. Bytes come from `source.getPage(bookId, index, opts)`.
This keeps a CBZ, an image folder, and the Platform API behind one shape.
(Supersedes the `src` field sketched in image-engine-spec §2.1 before T0.)

### Events, not callbacks

The engine emits through a typed `Emitter`; the host never passes behavior into
core beyond the `ReaderSource`. History/title side effects, chrome rendering, and
countdown UI are all host concerns reacting to events (spec §11.4).

## Consequences

- `reader-react` binds to events via hooks; no prop drilling of engine internals.
- Adding an engine event is a minor version bump; changing `ImageEngine` methods
  or `ReaderSource` is a breaking change and needs a new ADR.
- Zustand is still not a dependency — `createStore` is a placeholder the settings
  layer may later swap for Zustand vanilla without changing the export.
