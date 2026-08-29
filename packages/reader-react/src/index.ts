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
} from '@pore/reader-core';

export {
  Reader,
  useReader,
  useReaderKind,
  useReaderLocation,
  useReaderProgress,
  useReaderSettings,
  useReaderKeymap,
  useTableOfContents,
  useFootnote,
  useEndPage,
  useChromeVisible,
  useResumedFromPage,
} from './reader.js';
export type {
  ReaderProps,
  ReaderHandle,
  ReaderLocation,
  ReaderProgress,
  Chapter,
  ReaderKind,
  AnySettings,
  Footnote,
  EndPage,
} from './reader.js';

export { SettingsPanel } from './settings-panel.js';
export type { SettingsPanelProps } from './settings-panel.js';

export { useReaderHistory } from './history.js';
export type { HistoryMode, UseReaderHistoryOptions } from './history.js';
