import type { Position } from '../position/types.js';
import type { TocEntry, EpubMetadata } from './epub/types.js';
import type { PageLoadState } from '../image/types.js';
import type { Chapter, Locator, ReaderProgress } from '../reader-engine.js';
import type { SearchHit } from '../search/search-index.js';

export interface TextEngineSettings {
  fontSizePct: number; // 100 = author default
  lineHeight: number;
  textAlign: 'start' | 'justify';
  marginPct: number; // % of the viewport min dimension
  columnGap: number; // px
  columns: 1 | 2;
  theme: 'light' | 'sepia' | 'dark' | 'oled';
  /** Keep the publisher's own CSS. When off, author styles are stripped. */
  publisherStyles: boolean;
  fontFamily: 'serif' | 'sans' | 'slab' | 'dyslexic' | 'original';
  /** In dark themes, invert images so they don't glare. */
  dimImages: boolean;
  /**
   * What happens when you page past the end of a chapter:
   * - `continuous`: flow straight into the next chapter
   * - `endpage`: show a centred end-of-chapter card first (an extra page)
   * The last chapter always shows a "The End" card so progress reaches 100%.
   */
  endBehavior: 'continuous' | 'endpage';
  /**
   * Vertical writing mode (`vertical-rl`, Japanese-style). `auto` turns it on
   * for EPUBs that declare RTL page progression with a Japanese primary
   * language.
   */
  verticalText: 'auto' | 'on' | 'off';
  /** Where the chrome/menu bar sits. */
  menuPosition: 'top' | 'left' | 'right';
  /** How a side menu is revealed (ignored when `menuPosition: 'top'`). */
  menuReveal: 'hover' | 'click' | 'dblclick';
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
  dimImages: false,
  endBehavior: 'continuous',
  verticalText: 'auto',
  menuPosition: 'top',
  menuReveal: 'click',
};

export interface TextEngineEvents {
  'reader:ready': { metadata: EpubMetadata; spineCount: number; vertical: boolean };
  'reader:resumed': { position: Position | null };
  'reader:locationchange': Locator;
  'reader:progress': ReaderProgress;
  'reader:loadingstate': { spine: number; state: PageLoadState };
  'reader:toc': { toc: TocEntry[] };
  'reader:footnote': { html: string; href: string };
  'reader:chrometoggle': { visible: boolean };
  'reader:endpage': {
    visible: boolean;
    kind: 'chapter' | 'book';
    label: string;
    /** true when there is a next chapter to continue to */
    hasNext: boolean;
  };
  'reader:searchresults': { query: string; hits: SearchHit[] };
  'reader:settingschange': { settings: TextEngineSettings };
  'reader:end': Record<string, never>;
  'reader:start': Record<string, never>;
  'reader:error': { error: unknown };
}

export interface TextEngine {
  mount(): Promise<void>;
  /** Absolute book page, or a resolved anchor Position. */
  goto(target: number | Position): void;
  /** Jump to an EPUB href like `OEBPS/ch02.xhtml#s2` (from the TOC). */
  goToHref(href: string): void;
  turn(dir: 'forward' | 'back'): void;
  setSettings(patch: Partial<TextEngineSettings>): void;
  /** Book-level chapter list (one entry per spine item). */
  chapters(): Chapter[];
  /** Full-text search across the book; also emits `reader:searchresults`. */
  search(query: string): Promise<SearchHit[]>;
  /** Jump to a hit from {@link search}. */
  gotoHit(hit: SearchHit): void;
  on<E extends keyof TextEngineEvents>(
    event: E,
    handler: (payload: TextEngineEvents[E]) => void,
  ): () => void;
  destroy(): void;
}
