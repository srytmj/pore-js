import type { ImageManifest } from '../source/types.js';
import type { Position } from '../position/types.js';
import type { LayoutMode } from '../types.js';

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
  'reader:loadingstate': { index: number; state: PageLoadState };
  'reader:chrometoggle': { visible: boolean };
  'reader:end': { auto: 'off' | 'instant' | number };
  'reader:start': Record<string, never>;
  'reader:zoomchange': { scale: number };
  'reader:error': { index?: number; error: unknown };
}

export type ImageEngineEventName = keyof ImageEngineEvents;
