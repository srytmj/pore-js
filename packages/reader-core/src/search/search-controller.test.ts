import { describe, expect, it } from 'vitest';
import { SearchController } from './search-controller.js';
import { buildSearchIndex, querySearchIndex, type SearchSection } from './search-index.js';

const SECTIONS: SearchSection[] = [
  { id: 'a', index: 0, text: 'alpha beta gamma' },
  { id: 'b', index: 1, text: 'beta beta delta' },
];

describe('SearchController — synchronous fallback', () => {
  it('builds and queries on the calling thread when there is no worker', async () => {
    const c = new SearchController({ workerFactory: false });
    expect(c.usingWorker).toBe(false);
    await c.build(SECTIONS);
    const hits = await c.query('beta');
    expect(hits.map((h) => h.sectionId)).toEqual(['a', 'b', 'b']);
  });

  it('only the latest query resolves with results', async () => {
    const c = new SearchController({ workerFactory: false });
    await c.build(SECTIONS);
    const [stale, fresh] = await Promise.all([c.query('alpha'), c.query('delta')]);
    expect(stale).toEqual([]);
    expect(fresh.map((h) => h.sectionId)).toEqual(['b']);
  });
});

describe('SearchController — worker', () => {
  it('round-trips build + query through a worker-like object', async () => {
    // A stand-in that runs the real index code but through postMessage plumbing.
    class FakeWorker extends EventTarget {
      #index = buildSearchIndex([]);
      postMessage(msg: { type: string; sections?: SearchSection[]; id?: number; query?: string }) {
        queueMicrotask(() => {
          if (msg.type === 'build') {
            this.#index = buildSearchIndex(msg.sections ?? []);
            this.dispatchEvent(new MessageEvent('message', { data: { type: 'built' } }));
          } else if (msg.type === 'query') {
            const hits = querySearchIndex(this.#index, msg.query ?? '');
            this.dispatchEvent(
              new MessageEvent('message', { data: { type: 'result', id: msg.id, hits } }),
            );
          }
        });
      }
      terminate() {}
    }

    const c = new SearchController({ workerFactory: () => new FakeWorker() as unknown as Worker });
    expect(c.usingWorker).toBe(true);
    await c.build(SECTIONS);
    const hits = await c.query('gamma');
    expect(hits.map((h) => h.sectionId)).toEqual(['a']);
    c.destroy();
  });
});
