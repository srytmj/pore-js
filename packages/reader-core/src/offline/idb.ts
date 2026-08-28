/**
 * Minimal promisified IndexedDB key-value store. Dependency-free.
 * One object store, string keys, structured-cloneable values.
 */
export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export function openKvStore(dbName = 'pore', storeName = 'kv'): KvStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const db = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) {
            req.result.createObjectStore(storeName);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      });
    }
    return dbPromise;
  };

  const tx = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    const conn = await db();
    return conn.transaction(storeName, mode).objectStore(storeName);
  };

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return promisify((await tx('readonly')).get(key) as IDBRequest<T | undefined>);
    },
    async set(key, value) {
      await promisify((await tx('readwrite')).put(value, key));
    },
    async delete(key) {
      await promisify((await tx('readwrite')).delete(key));
    },
    async keys() {
      const result = await promisify((await tx('readonly')).getAllKeys());
      return result.map(String);
    },
  };
}
