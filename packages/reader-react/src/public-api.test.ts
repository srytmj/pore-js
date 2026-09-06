import { describe, expect, it } from 'vitest';
import * as api from './index.js';

/**
 * Surface guard for `porejs-react`. Adding/removing a runtime export is an API
 * change — update this list, `docs/stability.md`, and add a changeset.
 */
const PUBLIC = [
  // provider + persistence
  'ReaderProvider',
  'useReaderSource',
  'createSettingsPersistence',
  // the component + hooks
  'Reader',
  'useReader',
  'useReaderKind',
  'useReaderLocation',
  'useReaderProgress',
  'useReaderSearch',
  'useReaderSettings',
  'useReaderKeymap',
  'useTableOfContents',
  'useFootnote',
  'useEndPage',
  'useChromeVisible',
  'useReaderLoading',
  'useReaderChapters',
  'useReaderError',
  'useResumedFromPage',
  'useReaderHighlights',
  'useReaderSelection',
  'useBookmarks',
  'useTts',
  'useReaderHistory',
  'useDownload',
  // headless components
  'SettingsPanel',
  'SettingsPanelBody',
  'TableOfContents',
  'HighlightsPanel',
  'BookmarksPanel',
  'FootnotePopover',
  'ReaderAnnouncer',
  'ReaderScrubber',
  // primitives
  'Field',
  'SelectField',
  'SliderField',
  'SwitchField',
  'SettingsTabs',
  'SettingsAccordion',
  // transitions
  'instantTransitions',
  'gsapAdapter',
].sort();

describe('porejs-react public surface', () => {
  it('exports exactly the documented runtime API', () => {
    expect(Object.keys(api).sort()).toEqual(PUBLIC);
  });
});
