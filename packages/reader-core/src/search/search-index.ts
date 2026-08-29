/**
 * In-book full-text search. Deliberately simple: a book's rendered text is
 * small enough (well under a megabyte for most titles) that a normalised
 * substring scan per query is fast and, unlike a hand-rolled inverted index,
 * hard to get subtly wrong. Runs in a Worker via {@link ./search-worker}.
 */

export interface SearchSection {
  /** Stable id — a spine idref or `page:<n>`. */
  id: string;
  /** 0-based order in the book, for sorting hits. */
  index: number;
  text: string;
}

export interface SearchHit {
  sectionId: string;
  sectionIndex: number;
  /** Match offsets within the section's normalised text. */
  start: number;
  end: number;
  /** Plain-text context around the match. */
  snippet: string;
  /** Match offsets within `snippet`. */
  snippetRange: [number, number];
}

interface IndexedSection {
  id: string;
  index: number;
  /** Lowercased, whitespace-collapsed — what we match against. */
  haystack: string;
  /** Same length as `haystack` but original case — what snippets are cut from. */
  display: string;
}

export interface SearchIndex {
  sections: IndexedSection[];
}

/** Collapse runs of whitespace to single spaces and trim. Length-preserving except for the collapse. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildSearchIndex(sections: SearchSection[]): SearchIndex {
  return {
    sections: sections.map((s) => {
      const display = collapse(s.text);
      return { id: s.id, index: s.index, haystack: display.toLowerCase(), display };
    }),
  };
}

export interface QueryOptions {
  /** Max hits to return. Default 200. */
  limit?: number;
  /** Characters of context on each side of a match. Default 48. */
  snippetRadius?: number;
}

export function querySearchIndex(
  index: SearchIndex,
  query: string,
  opts: QueryOptions = {},
): SearchHit[] {
  const needle = collapse(query).toLowerCase();
  if (needle.length < 2) return [];
  const limit = opts.limit ?? 200;
  const radius = opts.snippetRadius ?? 48;
  const hits: SearchHit[] = [];

  for (const section of index.sections) {
    let from = 0;
    for (;;) {
      const at = section.haystack.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      const cutStart = Math.max(0, at - radius);
      const cutEnd = Math.min(section.display.length, end + radius);
      const prefix = cutStart > 0 ? '…' : '';
      const suffix = cutEnd < section.display.length ? '…' : '';
      hits.push({
        sectionId: section.id,
        sectionIndex: section.index,
        start: at,
        end,
        snippet: prefix + section.display.slice(cutStart, cutEnd) + suffix,
        snippetRange: [prefix.length + (at - cutStart), prefix.length + (end - cutStart)],
      });
      if (hits.length >= limit) return sortHits(hits);
      from = end;
    }
  }
  return sortHits(hits);
}

function sortHits(hits: SearchHit[]): SearchHit[] {
  return hits.sort((a, b) => a.sectionIndex - b.sectionIndex || a.start - b.start);
}
