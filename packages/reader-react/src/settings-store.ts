import type { AnySettings, ReaderKind } from './reader.js';

/**
 * Settings that belong to *a book* (its layout), not the reader. Everything else
 * (typography, behaviour, keybinds, filters) is a global preference.
 * Spec: docs/image-engine-spec.md §11.3.
 */
const PER_BOOK_KEYS: Record<ReaderKind, readonly string[]> = {
  image: [
    'layout',
    'direction',
    'spreadOffset',
    'pageGap',
    'fit',
    'stretchSmallPages',
    'maxWidth',
    'maxHeight',
  ],
  text: ['columns', 'menuPosition'],
};

const GLOBAL_KEY = 'pore:settings:global';
const bookKey = (id: string) => `pore:settings:book:${id}`;

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeStorage(): SettingsStorage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__pore_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function read(storage: SettingsStorage, key: string): Record<string, unknown> {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function pick(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export interface SettingsPersistence {
  /** Overrides to seed a freshly mounted engine for `bookId`. */
  initial(bookId: string, kind: ReaderKind): Partial<AnySettings>;
  /** Split an engine's full settings into the global + per-book stores. */
  save(bookId: string, kind: ReaderKind, settings: AnySettings): void;
}

/** localStorage-backed persistence: global prefs + a per-book layout layer. */
export function createSettingsPersistence(
  storage: SettingsStorage | null = safeStorage(),
): SettingsPersistence {
  if (!storage) {
    return { initial: () => ({}), save: () => {} };
  }
  return {
    initial(bookId, kind) {
      const perBook = PER_BOOK_KEYS[kind];
      return {
        ...read(storage, GLOBAL_KEY),
        ...pick(read(storage, bookKey(bookId)), perBook),
      } as Partial<AnySettings>;
    },
    save(bookId, kind, settings) {
      const s = settings as unknown as Record<string, unknown>;
      const perBook = PER_BOOK_KEYS[kind];
      const global: Record<string, unknown> = {};
      const book: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s)) {
        (perBook.includes(k) ? book : global)[k] = v;
      }
      try {
        storage.setItem(GLOBAL_KEY, JSON.stringify(global));
        storage.setItem(bookKey(bookId), JSON.stringify(book));
      } catch {
        /* quota / private mode — ignore */
      }
    },
  };
}
