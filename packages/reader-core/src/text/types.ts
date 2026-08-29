import type { Position } from '../position/types.js';
import type { TocEntry, EpubMetadata } from './epub/types.js';
import type { PageLoadState } from '../image/types.js';

export interface TextEngineSettings {
  fontSizePct: number; // 100 = author default
  lineHeight: number;
  textAlign: 'start' | 'justify';
  marginPct: number; // % of the viewport min dimension
  columnGap: number; // px
  columns: 1 | 2;
  theme: 'light' | 'sepia' | 'dark' | 'oled';
  /** Raise user-stylesheet specificity to override stubborn publisher CSS. */
  publisherStyles: boolean;
  fontFamily: 'serif' | 'sans' | 'slab' | 'dyslexic' | 'original';
}

export const DEFAULT_TEXT_SETTINGS: TextEngineSettings = {
  fontSizePct: 100,
  lineHeight: 1.5,
  textAlign: 'start',
  marginPct: 6,
  columnGap: 48,
  columns: 1,
  theme: 'light',
  publisherStyles: true,
  fontFamily: 'original',
};

export interface TextEngineEvents {
  'reader:ready': { metadata: EpubMetadata; spineCount: number };
  'reader:resumed': { position: Position | null };
  'reader:locationchange': {
    position: Position;
    page: number; // book-level page
    totalPages: number;
    percent: number;
    label: string;
    spine: number;
  };
  'reader:loadingstate': { spine: number; state: PageLoadState };
  'reader:toc': { toc: TocEntry[] };
  'reader:settingschange': { settings: TextEngineSettings };
  'reader:end': Record<string, never>;
  'reader:start': Record<string, never>;
  'reader:error': { error: unknown };
}

export interface TextEngine {
  mount(): Promise<void>;
  /** Absolute book page, or a resolved anchor Position. */
  goto(target: number | Position): void;
  turn(dir: 'forward' | 'back'): void;
  setSettings(patch: Partial<TextEngineSettings>): void;
  on<E extends keyof TextEngineEvents>(
    event: E,
    handler: (payload: TextEngineEvents[E]) => void,
  ): () => void;
  destroy(): void;
}
