// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { openKvStore } from './idb.js';

describe('openKvStore (IndexedDB)', () => {
  beforeAll(() => {
    // fake-indexeddb/auto installs a global `indexedDB`
    expect(typeof indexedDB).toBe('object');
  });

  it('round-trips values and lists keys', async () => {
    const kv = openKvStore('pore-test', 'kv');
    await kv.set('a', { n: 1 });
    await kv.set('b', 'two');
    expect(await kv.get('a')).toEqual({ n: 1 });
    expect(await kv.get('b')).toBe('two');
    expect((await kv.keys()).sort()).toEqual(['a', 'b']);
    await kv.delete('a');
    expect(await kv.get('a')).toBeUndefined();
  });
});
