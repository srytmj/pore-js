import type { ImageManifest } from '../source/types.js';
import type { Position } from '../position/types.js';
import type { LayoutMode } from '../settings/types.js';

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
  'reader:loadingstate': {
    index: number;
    state: 'idle' | 'loading' | 'loaded' | 'error';
  };
  'reader:end': { auto: 'off' | 'instant' | number };
  'reader:start': Record<string, never>;
  'reader:zoomchange': { scale: number };
  'reader:error': { index?: number; error: unknown };
}
