/**
 * Image engine settings — see docs/image-engine-spec.md §2.3.
 *
 * Persistence scope (spec §11.3):
 *   per-book overridable → layout, direction, spreadOffset, pageGap, fit,
 *                          stretchSmallPages, maxWidth, maxHeight
 *   global only          → behavior, keymap, filters
 */

import type { Direction, FitMode, LayoutMode } from '../types.js';

export type { FitMode, LayoutMode };

export interface ProgressBarSettings {
  style: 'hidden' | 'lightbar' | 'normal';
  position: 'bottom' | 'left' | 'right';
  thickness: number;
  showPageCounterWhenHidden: boolean;
}

export interface ImageEngineSettings {
  // layout
  layout: LayoutMode;
  direction: Direction;
  spreadOffset: 0 | 1;
  pageGap: number;

  // fit / sizing
  fit: FitMode;
  stretchSmallPages: boolean;
  maxWidth: number | null;
  maxHeight: number | null;

  // interface (state only; the shell renders)
  headerVisible: boolean;
  progressBar: ProgressBarSettings;
  cursorHint: 'none' | 'overlay' | 'cursor';
  background: 'theme' | 'white' | 'black';

  // image filters
  brightness: number;
  greyscale: boolean;
  dim: boolean;

  // behavior
  tapToTurn: 'directional' | 'always-forward' | 'never';
  scrollToTurn: 'off' | 'wheel' | 'keys' | 'both';
  doubleClickFullscreen: boolean;
  nextChapterAfterLastPage: 'off' | 'instant' | 3 | 5 | 10;
  historyMode: 'none' | 'title' | 'url-and-title';

  // autoscroll (continuous)
  autoscroll: boolean;
  autoscrollSpeed: number;
  autoscrollSmooth: boolean;
  pagedAutoAdvanceSeconds: number;

  // fit-change side effects
  autoScrollUpOnFit: ('width' | 'height' | 'none')[];
  autoScrollOffset: number;

  // performance
  preload: boolean;
  preloadStrategy: 'window' | 'all';
  preloadAhead: number;
  preloadBehind: number;
  preloadAllMaxMB: number;
  loadingMethod: 'native' | 'blob' | 'bitmap';
}

export const DEFAULT_IMAGE_SETTINGS: ImageEngineSettings = {
  layout: 'paged-single',
  direction: 'rtl',
  spreadOffset: 0,
  pageGap: 0,

  fit: 'contain',
  stretchSmallPages: false,
  maxWidth: null,
  maxHeight: null,

  headerVisible: true,
  progressBar: {
    style: 'normal',
    position: 'bottom',
    thickness: 4,
    showPageCounterWhenHidden: true,
  },
  cursorHint: 'overlay',
  background: 'theme',

  brightness: 1,
  greyscale: false,
  dim: false,

  tapToTurn: 'directional',
  scrollToTurn: 'off',
  doubleClickFullscreen: false,
  nextChapterAfterLastPage: 'instant',
  historyMode: 'title',

  autoscroll: false,
  autoscrollSpeed: 46,
  autoscrollSmooth: true,
  pagedAutoAdvanceSeconds: 0,

  autoScrollUpOnFit: ['width', 'height'],
  autoScrollOffset: 0,

  preload: true,
  preloadStrategy: 'window',
  preloadAhead: 4,
  preloadBehind: 2,
  preloadAllMaxMB: 512,
  loadingMethod: 'blob',
};
