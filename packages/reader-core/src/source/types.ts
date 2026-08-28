import type { Position } from '../position/types.js';

export type Direction = 'ltr' | 'rtl' | 'vertical';
export type Variant = 'orig' | 'w800' | 'w1600' | 'webp';

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
  preferredLayout?:
    'paged-single' | 'paged-double' | 'continuous-vertical' | 'continuous-horizontal';
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
}
