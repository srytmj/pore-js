import type { ImageManifest } from '../source/types.js';
import type { Position } from '../position/types.js';
import type { LayoutMode } from '../types.js';
import type { ImageEngineSettings } from '../settings/types.js';
import type { Keymap } from '../settings/keymap.js';

/** Per-page load state, surfaced so the shell can render skeletons / retry. */
export type PageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Engine → host events. See docs/image-engine-spec.md §9. */
export interface ImageEngineEvents {
  'reader:ready': { manifest: ImageManifest };
  'reader:resumed': { position: Position | null; page: number };
  'reader:locationchange': {
    position: Position;
    page: number;
    chapter?: string;
    label: string;
  };
  'reader:layoutchange': { layout: LayoutMode; spreads: number };
  'reader:settingschange': { settings: ImageEngineSettings; keymap: Keymap };
  'reader:loadingstate': { index: number; state: PageLoadState };
  'reader:chrometoggle': { visible: boolean };
  'reader:end': { auto: 'off' | 'instant' | number };
  'reader:start': Record<string, never>;
  'reader:autoscroll': { running: boolean };
  /** Fired at book/chapter end when auto-advance is armed; `inMs` counts down, -1 = cancelled. */
  'reader:autoadvance': { toChapter: string | null; inMs: number };
  'reader:zoomchange': { scale: number };
  'reader:error': { index?: number; error: unknown };
}

export type ImageEngineEventName = keyof ImageEngineEvents;
