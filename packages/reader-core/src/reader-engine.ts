import type { Position } from './position/types.js';
import type { TurnDirection } from './types.js';

/**
 * The normalised position the shell renders from — every engine emits this
 * shape in `reader:locationchange`, regardless of format.
 */
export interface Locator {
  /** The precise, engine-native position (round-trips through the source). */
  position: Position;
  /** 0-based book-level page (or nearest page for scroll/anchor). */
  page: number;
  /** Total book-level pages (best estimate for reflowable text). */
  total: number;
  /** 0..1 through the whole book. */
  percent: number;
  /** Human label, e.g. "Chapter 4 · 62%". */
  label: string;
  /** Current chapter id, if the book has chapters. */
  chapter?: string;
}

/**
 * The surface every engine exposes. `S` is the engine's settings type.
 * See docs/reader-engine-design.md §9 and docs/image-engine-spec.md §10.
 */
export interface ReaderEngine<S = unknown, E = Record<string, unknown>> {
  mount(): Promise<void>;
  turn(dir: TurnDirection): void;
  goto(target: number | Position): void;
  setSettings(patch: Partial<S>): void;
  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): () => void;
  destroy(): void;
}

/** Events common to every engine (each engine may add more). */
export interface CommonEngineEvents {
  'reader:ready': unknown;
  'reader:resumed': { position: Position | null; page: number };
  'reader:locationchange': Locator;
  'reader:loadingstate': { index: number; state: 'idle' | 'loading' | 'loaded' | 'error' };
  'reader:chrometoggle': { visible: boolean };
  'reader:toc': { toc: unknown[] };
  'reader:end': unknown;
  'reader:start': Record<string, never>;
  'reader:error': { error: unknown };
}
