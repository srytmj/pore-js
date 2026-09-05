import type { Position } from '../position/types.js';
import type { Direction, LayoutMode, Variant } from '../types.js';

export type { Direction, Variant };

export interface ImagePage {
  index: number;
  width?: number;
  height?: number;
  /** Force solo rendering in double-spread mode. Otherwise derived from aspect. */
  isWide?: boolean;
  chapterId?: string;
}

export interface ImageManifest {
  bookId: string;
  type: 'image';
  title: string;
  direction: Direction;
  pageCount: number;
  pages: ImagePage[];
  chapters?: { id: string; label: string; startIndex: number }[];
  preferredLayout?: LayoutMode;
}

export interface TextManifest {
  bookId: string;
  type: 'epub' | 'pdf' | 'cbz';
  title: string;
  bytes?: number;
  etag?: string;
}

export type Manifest = ImageManifest | TextManifest;

export interface GetPageOpts {
  variant?: Variant;
  signal?: AbortSignal;
}

export interface GetFileOpts {
  signal?: AbortSignal;
}

/** Endpoints of a highlight span, addressed the same way `Position['anchor']` is (block ordinal + flattened-text offset), just with a start and an end. */
export interface HighlightRange {
  spine: number;
  startBlock: number;
  startOffset: number;
  endBlock: number;
  endOffset: number;
}

/** A persisted text highlight (+ optional note). Not a `Position` — a parallel per-book collection. */
export interface HighlightRecord {
  id: string;
  range: HighlightRange;
  /** Portable `epubcfi(...)` endpoints, for interchange (see `text/cfi.ts`). */
  cfi: { start: string; end: string };
  color: string;
  note?: string;
  /** Snapshot of the highlighted text, so a highlights panel can list them before resolving. */
  text: string;
  createdAt: number;
}

/**
 * The seam between the reader and its data. Everything above this is
 * source-blind. See docs/reader-engine-design.md §4.
 */
export interface ReaderSource {
  getManifest(bookId: string): Promise<Manifest>;
  getPage(bookId: string, index: number, opts?: GetPageOpts): Promise<Blob | string>;
  getFile(bookId: string, opts?: GetFileOpts): Promise<Blob>;
  loadProgress(bookId: string): Promise<Position | null>;
  saveProgress(bookId: string, p: Position): Promise<void>;
  /** Optional — sources that don't implement it simply can't persist highlights. */
  loadHighlights?(bookId: string): Promise<HighlightRecord[]>;
  saveHighlights?(bookId: string, highlights: HighlightRecord[]): Promise<void>;
}
