import type { Position } from '../position/types.js';
import type { TocEntry, EpubMetadata } from './epub/types.js';
import type { PageLoadState } from '../image/types.js';
import type { Chapter, Locator, ReaderProgress } from '../reader-engine.js';
import type { SearchHit } from '../search/search-index.js';
import type { HighlightRecord } from '../source/types.js';
import type { Rect } from './anchor.js';
import type { TtsState, TtsVoiceLike } from './tts.js';

export type { HighlightRecord } from '../source/types.js';
export type { TtsState, TtsSentence, TtsVoiceLike } from './tts.js';

export interface TextSelection {
  rect: Rect;
  text: string;
}

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
  /**
   * Reading mode:
   * - `paged`: the default column pagination
   * - `flow`: a single scrolling column — semantic, screen-reader friendly,
   *   no transforms
   * - `auto`: `flow` when the OS reports forced colors (high-contrast), else `paged`
   */
  flowMode: 'paged' | 'flow' | 'auto';
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
  flowMode: 'paged',
  menuPosition: 'top',
  menuReveal: 'click',
};

export interface TextEngineEvents {
  'reader:ready': {
    metadata: EpubMetadata;
    spineCount: number;
    vertical: boolean;
    flow: boolean;
  };
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
  /** The live text selection inside the sandboxed iframe, debounced; `null` when it collapses. */
  'reader:selection': TextSelection | null;
  /** Fired after `addHighlight`/`removeHighlight` and once on mount (with whatever was persisted). */
  'reader:highlightschange': { highlights: HighlightRecord[] };
  /** Text-to-speech playback state — fired on play/pause/resume/stop and on every sentence advance. */
  'reader:ttsstate': TtsState;
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
  /** Portable `epubcfi(...)` for the current position, or `null` before the spine has rendered. */
  getCfi(): string | null;
  /**
   * Highlight the current selection (see `reader:selection`). Returns `null`
   * when there's no live selection or it can't be resolved to a range.
   */
  addHighlight(opts?: { color?: string; note?: string }): HighlightRecord | null;
  removeHighlight(id: string): void;
  listHighlights(): HighlightRecord[];
  /**
   * Text-to-speech (stretch goal — browser `SpeechSynthesis` only). All
   * methods are safe to call even when the API is unsupported: playback
   * simply never starts and `ttsListVoices()` returns `[]`.
   */
  ttsPlay(): void;
  ttsPause(): void;
  ttsResume(): void;
  ttsStop(): void;
  ttsSetRate(rate: number): void;
  ttsSetVoice(voice: TtsVoiceLike | null): void;
  ttsListVoices(): TtsVoiceLike[];
  ttsState(): TtsState;
  on<E extends keyof TextEngineEvents>(
    event: E,
    handler: (payload: TextEngineEvents[E]) => void,
  ): () => void;
  destroy(): void;
}
