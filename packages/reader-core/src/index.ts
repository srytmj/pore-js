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
export {
  createImageEngine,
  physicalToLogical,
  isReverseDirection,
} from './image/create-image-engine.js';
export { buildSpreads, spreadIndexForPage, isNaturallyWide } from './image/spreads.js';
export { zoneForPoint, resolveTap, swipeTurn, clampZoom } from './image/input.js';
export type { TapZone, TapResult, TapToTurn } from './image/input.js';
export type { Spread } from './image/spreads.js';
export {
  estimateLinearLayout,
  estimateVerticalLayout,
  visibleRange,
  pageAtOffset,
  scrollForPage,
} from './image/continuous.js';
export type { LinearLayout, ContinuousAxis } from './image/continuous.js';
export { PageLoader } from './image/page-loader.js';
export { PrefetchScheduler } from './image/prefetch.js';
export type { PreloadSettings } from './image/prefetch.js';
export { resolveSettings, resolveKeymap, mergeSettings, mergeKeymap } from './settings/merge.js';

export { DemoSource } from './source/demo-source.js';
export type { DemoSourceOptions } from './source/demo-source.js';
export { CachedSource } from './source/cached-source.js';
export type { CachedSourceOptions } from './source/cached-source.js';
export { LocalFileSource } from './source/local-file-source.js';
export type { LocalFileSourceOptions } from './source/local-file-source.js';

export { parseEpub } from './text/epub/parse.js';
export type {
  EpubBook,
  EpubMetadata,
  EpubResource,
  SpineItem,
  TocEntry,
} from './text/epub/types.js';
export { resolvePath, resolveHref, dirOf, stripHash, fragmentOf } from './text/epub/path.js';
export { createTextEngine } from './text/create-text-engine.js';
export type { CreateTextEngineOptions } from './text/create-text-engine.js';
export { DEFAULT_TEXT_SETTINGS } from './text/types.js';
export type { TextEngine, TextEngineEvents, TextEngineSettings } from './text/types.js';
export { rewriteResources } from './text/rewrite.js';
export { buildBaseStylesheet, pageCountFor, offsetForPage } from './text/paginate.js';
export { generateAnchor, resolveAnchor, blockElements, pageForElement } from './text/anchor.js';
export { openKvStore } from './offline/idb.js';
export type { KvStore } from './offline/idb.js';
export { parseImageManifestFile, naturalCompare } from './source/manifest-file.js';
export type { ImageManifestFile, ParsedFixtureManifest } from './source/manifest-file.js';

export { createStore } from './internal/store.js';
export type { Store } from './internal/store.js';
export { createEmitter } from './internal/emitter.js';
export type { Emitter } from './internal/emitter.js';
