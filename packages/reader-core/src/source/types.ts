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

/** Bibliographic metadata a source can attach to any manifest, for the reader
 * chrome / document title. All optional — `title` is the only required label. */
export interface ManifestMeta {
  /** e.g. a series or edition line under the title. */
  subtitle?: string;
  /** Volume label when the book is one volume of a series (`"2"`, `"Vol. II"`). */
  volume?: string | number;
}

export interface ImageManifest extends ManifestMeta {
  bookId: string;
  type: 'image';
  title: string;
  direction: Direction;
  pageCount: number;
  pages: ImagePage[];
  chapters?: { id: string; label: string; startIndex: number }[];
  preferredLayout?: LayoutMode;
}

export interface TextManifest extends ManifestMeta {
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

/** A normalized (0–1, page-relative) rectangle — how a PDF highlight is anchored. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fields every highlight carries, regardless of how it's anchored. */
interface HighlightBase {
  id: string;
  color: string;
  note?: string;
  /** Snapshot of the highlighted text, so a highlights panel can list them before resolving. */
  text: string;
  createdAt: number;
}

/** A highlight anchored to a DOM text range (EPUB / reflowable). */
export interface TextHighlightRecord extends HighlightBase {
  kind: 'text';
  range: HighlightRange;
  /** Portable `epubcfi(...)` endpoints, for interchange (see `text/cfi.ts`). */
  cfi: { start: string; end: string };
}

/** A highlight anchored to page-relative rectangles (PDF / fixed pages). */
export interface RectHighlightRecord extends HighlightBase {
  kind: 'rect';
  /** 0-based page index. */
  page: number;
  /** One or more normalized boxes covering the highlighted run. */
  rects: NormRect[];
}

/**
 * A persisted highlight (+ optional note). Not a `Position` — a parallel
 * per-book collection. Discriminated on `kind`: `'text'` for range-anchored
 * (EPUB), `'rect'` for page-box-anchored (PDF).
 */
export type HighlightRecord = TextHighlightRecord | RectHighlightRecord;

/**
 * A named place in a book the reader can jump back to — distinct from the
 * single auto-resume checkpoint. Its own per-book collection. `cfi` (when the
 * engine can produce one) is the portable anchor; `position` is the fast
 * in-engine one.
 */
export interface Bookmark {
  id: string;
  position: Position;
  cfi?: string;
  /** 0-based book-level page at bookmark time — cheap "is this page bookmarked?" checks. */
  page: number;
  /** 0..1 through the book, for ordering the list. */
  percent: number;
  label: string;
  /** Snapshot of the text at the mark, for the list. */
  text?: string;
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
  /** Optional — sources that don't implement it can't persist bookmarks. */
  loadBookmarks?(bookId: string): Promise<Bookmark[]>;
  saveBookmarks?(bookId: string, bookmarks: Bookmark[]): Promise<void>;
}
