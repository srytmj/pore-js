import type { ReaderSource } from '../source/types.js';
import type { ImageEngineSettings } from '../settings/types.js';
import type { Keymap } from '../settings/keymap.js';
import type { TurnDirection } from '../types.js';
import type { Chapter } from '../reader-engine.js';
import type { ImageEngineEvents } from './types.js';

export interface ImageEngineOptions {
  /** Element the engine renders into. The engine owns its subtree. */
  container: HTMLElement;
  source: ReaderSource;
  bookId: string;
  /** Partial settings merged over DEFAULT_IMAGE_SETTINGS. */
  settings?: Partial<ImageEngineSettings>;
  /** Partial keymap merged over DEFAULT_KEYMAP. */
  keymap?: Partial<Keymap>;
}

export type Unsubscribe = () => void;

/**
 * Imperative handle the host (or reader-react) drives. See
 * docs/image-engine-spec.md §10. Implemented in T2+.
 */
export interface ImageEngine {
  /** Load the manifest, restore the last-read checkpoint, first paint. */
  mount(): Promise<void>;
  /** Jump to an absolute page index (clamped). */
  goto(pageIndex: number): void;
  /** Turn one spread / scroll one screen in a logical direction. */
  turn(dir: TurnDirection): void;
  /** Merge a settings patch and re-render as needed. */
  setSettings(patch: Partial<ImageEngineSettings>): void;
  /** Merge a keymap patch. */
  setKeymap(patch: Partial<Keymap>): void;
  /** Book-level chapter list (empty when the book has no chapters). */
  chapters(): Chapter[];
  /** Subscribe to an engine event. Returns an unsubscribe fn. */
  on<E extends keyof ImageEngineEvents>(
    event: E,
    handler: (payload: ImageEngineEvents[E]) => void,
  ): Unsubscribe;
  /** Tear down listeners, observers, object URLs, and the DOM subtree. */
  destroy(): void;
}
