/**
 * @pore/reader-core — framework-agnostic reader engine.
 *
 * Public surface is intentionally small; see docs/reader-engine-design.md §4
 * and docs/image-engine-spec.md §10.
 */

export const VERSION = '0.0.0';

export type { Direction, LayoutMode, FitMode, Variant, TurnDirection } from './types.js';

export type {
  ReaderSource,
  Manifest,
  ImageManifest,
  TextManifest,
  ImagePage,
  GetPageOpts,
  GetFileOpts,
} from './source/types.js';

export type { Position } from './position/types.js';
export { clampPagePosition, isPagePosition, isScrollPosition } from './position/position.js';

export type { ImageEngineSettings, ProgressBarSettings } from './settings/types.js';
export { DEFAULT_IMAGE_SETTINGS } from './settings/types.js';

export type { Keymap, ActionId } from './settings/keymap.js';
export { DEFAULT_KEYMAP, resolveAction } from './settings/keymap.js';

export type { ImageEngineEvents, ImageEngineEventName, PageLoadState } from './image/types.js';
export type { ImageEngine, ImageEngineOptions, Unsubscribe } from './image/engine.js';

export { DemoSource } from './source/demo-source.js';
export type { DemoSourceOptions } from './source/demo-source.js';
export { parseImageManifestFile, naturalCompare } from './source/manifest-file.js';
export type { ImageManifestFile, ParsedFixtureManifest } from './source/manifest-file.js';

export { createStore } from './internal/store.js';
export type { Store } from './internal/store.js';
export { createEmitter } from './internal/emitter.js';
export type { Emitter } from './internal/emitter.js';
