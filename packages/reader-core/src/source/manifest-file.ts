import type { Direction, LayoutMode } from '../types.js';
import type { ImageManifest, ImagePage } from './types.js';

/**
 * On-disk / on-the-wire manifest shape a DemoSource fixture ships as
 * `manifest.json`. Deliberately loose; {@link parseImageManifestFile}
 * validates and normalises it into an {@link ImageManifest}.
 */
export interface ImageManifestFile {
  bookId?: string;
  type?: 'image';
  title?: string;
  direction?: Direction;
  preferredLayout?: LayoutMode;
  chapters?: { id: string; label: string; startIndex: number }[];
  pages: Array<{
    /** Relative filename or URL, resolved against the manifest's directory. */
    src: string;
    width?: number;
    height?: number;
    isWide?: boolean;
    chapterId?: string;
  }>;
}

export interface ParsedFixtureManifest {
  manifest: ImageManifest;
  /** Page index → resolved page URL. */
  pageUrls: string[];
}

const DIRECTIONS: readonly Direction[] = ['ltr', 'rtl', 'vertical'];

/** Natural sort ("p2" < "p10"). Used to order pages when a fixture lists them unsorted. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Resolve a possibly-relative page src against the manifest's own URL/path. */
function resolveSrc(src: string, manifestUrl: string): string {
  if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('data:')) return src;
  // Try a proper URL resolution first (absolute manifestUrl).
  try {
    return new URL(src, manifestUrl).toString();
  } catch {
    // manifestUrl is a bare path like "/fixtures/book/manifest.json" — join manually.
    const dir = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
    return dir + src.replace(/^\.\//, '');
  }
}

export function parseImageManifestFile(
  raw: unknown,
  opts: { bookId: string; manifestUrl: string },
): ParsedFixtureManifest {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as ImageManifestFile).pages)) {
    throw new Error(`DemoSource: manifest for "${opts.bookId}" is malformed (no pages array)`);
  }
  const file = raw as ImageManifestFile;

  const direction: Direction =
    file.direction && DIRECTIONS.includes(file.direction) ? file.direction : 'ltr';

  const pages: ImagePage[] = [];
  const pageUrls: string[] = [];

  file.pages.forEach((p, index) => {
    if (!p || typeof p.src !== 'string' || p.src.length === 0) {
      throw new Error(`DemoSource: page ${index} of "${opts.bookId}" has no src`);
    }
    const wide =
      p.isWide ??
      (typeof p.width === 'number' && typeof p.height === 'number' && p.height > 0
        ? p.width / p.height > 1
        : undefined);

    const page: ImagePage = { index };
    if (typeof p.width === 'number') page.width = p.width;
    if (typeof p.height === 'number') page.height = p.height;
    if (wide !== undefined) page.isWide = wide;
    if (typeof p.chapterId === 'string') page.chapterId = p.chapterId;
    pages.push(page);
    pageUrls.push(resolveSrc(p.src, opts.manifestUrl));
  });

  const manifest: ImageManifest = {
    bookId: opts.bookId,
    type: 'image',
    title: typeof file.title === 'string' ? file.title : opts.bookId,
    direction,
    pageCount: pages.length,
    pages,
  };
  if (file.preferredLayout) manifest.preferredLayout = file.preferredLayout;
  if (file.chapters?.length) manifest.chapters = file.chapters;

  return { manifest, pageUrls };
}
