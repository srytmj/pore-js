import { describe, expect, it } from 'vitest';
import * as api from './index.js';
import * as internal from './internal/index.js';

/**
 * Surface guard. Adding or removing a *runtime* export from `porejs` is an API
 * change — update this list **and** `docs/stability.md` in the same commit, and
 * add a changeset. (Type-only exports are erased at runtime and aren't checked
 * here; review those by hand against docs/stability.md.)
 */
const PUBLIC = [
  'VERSION',
  // vocabulary / guards
  'clampPagePosition',
  'isPagePosition',
  'isScrollPosition',
  'isReverseDirection',
  'physicalToLogical',
  'resolveAction',
  'chapterProgress',
  // animation
  'instantTransitions',
  // defaults
  'DEFAULT_IMAGE_SETTINGS',
  'DEFAULT_TEXT_SETTINGS',
  'DEFAULT_KEYMAP',
  // engine factories
  'createImageEngine',
  'createTextEngine',
  'createPdfEngine',
  // pdf
  'loadPdf',
  'setPdfWorkerSrc',
  'PdfImageSource',
  // epub / cfi
  'parseEpub',
  'serializeCfi',
  'parseCfi',
  'resolveCfiElement',
  'resolveCfiRange',
  // sources
  'DemoSource',
  'CachedSource',
  'LocalFileSource',
  'KavitaSource',
  'KavitaAuthError',
  'KavitaDownloadForbiddenError',
  'OpdsSource',
  'parseOpdsFeed',
  'acquisitionLink',
  'guessFilename',
  // offline
  'MediaCache',
  'openKvStore',
  // search
  'SearchController',
].sort();

describe('porejs public surface', () => {
  it('exports exactly the documented runtime API', () => {
    expect(Object.keys(api).sort()).toEqual(PUBLIC);
  });

  it('porejs/internal stays disjoint from the public surface', () => {
    const overlap = Object.keys(internal).filter((k) => (PUBLIC as string[]).includes(k));
    expect(overlap).toEqual([]);
  });
});
