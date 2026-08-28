/**
 * @pore/reader-react — React 19 bindings for @pore/reader-core.
 *
 * Core mounts imperatively into a ref'd container; React owns the chrome.
 * No React inside iframes — ever. See docs/reader-engine-design.md §11.
 */

export { ReaderProvider, useReaderContext } from './provider.js';
export type { ReaderProviderProps } from './provider.js';
