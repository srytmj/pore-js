import { describe, expect, it } from 'vitest';
import { buildSearchIndex, querySearchIndex } from './search-index.js';

const sections = [
  { id: 's1', index: 0, text: 'The quick brown fox jumps over the lazy dog.' },
  { id: 's2', index: 1, text: 'A second\n\n  chapter   mentions the FOX again, twice: fox.' },
];

describe('querySearchIndex', () => {
  it('finds matches across sections, case-insensitively, in reading order', () => {
    const hits = querySearchIndex(buildSearchIndex(sections), 'fox');
    expect(hits.map((h) => h.sectionId)).toEqual(['s1', 's2', 's2']);
    expect(hits.every((h) => h.end - h.start === 3)).toBe(true);
  });

  it('produces a snippet with the match range pointing at the term', () => {
    const [hit] = querySearchIndex(buildSearchIndex(sections), 'brown', { snippetRadius: 10 });
    expect(hit!.snippet).toContain('brown');
    const [a, b] = hit!.snippetRange;
    expect(hit!.snippet.slice(a, b).toLowerCase()).toBe('brown');
  });

  it('collapses whitespace so matches span line breaks', () => {
    const hits = querySearchIndex(buildSearchIndex(sections), 'second chapter');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.sectionId).toBe('s2');
  });

  it('ignores queries shorter than two characters', () => {
    expect(querySearchIndex(buildSearchIndex(sections), 'f')).toEqual([]);
  });

  it('honours the hit limit', () => {
    const many = [{ id: 'x', index: 0, text: 'ab '.repeat(50) }];
    expect(querySearchIndex(buildSearchIndex(many), 'ab', { limit: 5 })).toHaveLength(5);
  });
});
