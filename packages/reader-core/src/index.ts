/**
 * @pore/reader-core — framework-agnostic reader engine.
 *
 * Public surface is intentionally small; see docs/reader-engine-design.md §4
 * and docs/image-engine-spec.md §10.
 */

export const VERSION = '0.0.0';

export type {
  ReaderSource,
  Manifest,
  ImageManifest,
  TextManifest,
  ImagePage,
  Direction,
  Variant,
} from './source/types.js';

export type { Position } from './position/types.js';
export { clampPagePosition, isPagePosition, isScrollPosition } from './position/position.js';

export type {
  ImageEngineSettings,
  ProgressBarSettings,
  LayoutMode,
  FitMode,
} from './settings/types.js';
export { DEFAULT_IMAGE_SETTINGS } from './settings/types.js';

export type { Keymap, ActionId } from './settings/keymap.js';
export { DEFAULT_KEYMAP, resolveAction } from './settings/keymap.js';

export type { ImageEngineEvents } from './image/types.js';

export { DemoSource } from './source/demo-source.js';
export { createStore } from './internal/store.js';
export type { Store } from './internal/store.js';
