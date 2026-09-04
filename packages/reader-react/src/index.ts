/**
 * @pore/reader-react — React 19 bindings for @pore/reader-core.
 *
 * Core mounts imperatively into a ref'd container; React owns the chrome.
 * No React inside iframes — ever. See docs/reader-engine-design.md §11.
 */

export { ReaderProvider, useReaderSource } from './provider.js';
export type { ReaderProviderProps } from './provider.js';

export { createSettingsPersistence } from './settings-store.js';
export type { SettingsPersistence, SettingsStorage } from './settings-store.js';

export type {
  ImageEngineSettings,
  TextEngineSettings,
  Position,
  Locator,
  TocEntry,
  SearchHit,
  ReaderTransitions,
  TransitionContext,
} from '@pore/reader-core';
export { instantTransitions } from '@pore/reader-core';
export { gsapAdapter } from './gsap-adapter.js';
export type { GsapLike, GsapAdapterOptions } from './gsap-adapter.js';

export {
  Reader,
  useReader,
  useReaderKind,
  useReaderLocation,
  useReaderProgress,
  useReaderSearch,
  useReaderSettings,
  useReaderKeymap,
  useTableOfContents,
  useFootnote,
  useEndPage,
  useChromeVisible,
  useReaderLoading,
  useReaderChapters,
  useReaderError,
  useResumedFromPage,
} from './reader.js';
export type {
  ReaderProps,
  ReaderHandle,
  ReaderLocation,
  ReaderProgress,
  ReaderSearch,
  Chapter,
  ReaderKind,
  AnySettings,
  Footnote,
  EndPage,
  ReaderErrorInfo,
  UseReaderError,
} from './reader.js';

export { SettingsPanel, SettingsPanelBody } from './settings-panel.js';
export type { SettingsPanelProps } from './settings-panel.js';
export { TableOfContents } from './table-of-contents.js';
export type { TableOfContentsProps } from './table-of-contents.js';
export { FootnotePopover } from './footnote-popover.js';
export {
  Field,
  SelectField,
  SliderField,
  SwitchField,
  Tabs as SettingsTabs,
} from './primitives.js';
export type { TabDef } from './primitives.js';

export { useReaderHistory } from './history.js';
export type { HistoryMode, UseReaderHistoryOptions } from './history.js';

export { useDownload } from './use-download.js';
export type { UseDownload } from './use-download.js';

export { ReaderAnnouncer } from './announcer.js';
export { ReaderScrubber } from './scrubber.js';
export type { ReaderScrubberProps, ScrubberLabelInfo } from './scrubber.js';
