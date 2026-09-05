// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { acquisitionLink, guessFilename, parseOpdsFeed } from './opds-parse.js';

const BASE = 'https://opds.example.org/catalog';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Catalog</title>
  <link rel="next" href="/catalog?page=2"/>
  <entry>
    <id>urn:book:1</id>
    <title>Pride and Prejudice</title>
    <updated>2024-01-01T00:00:00Z</updated>
    <summary>A classic.</summary>
    <link rel="http://opds-spec.org/acquisition/open-access"
          href="/download/1.epub" type="application/epub+zip"/>
    <link rel="alternate" href="/details/1"/>
  </entry>
  <entry>
    <id>urn:book:2</id>
    <title>Some Comic</title>
    <link rel="http://opds-spec.org/acquisition"
          href="/download/2" type="application/x-cbz"/>
  </entry>
  <entry>
    <id>urn:book:3</id>
    <title>No Acquisition Here</title>
    <link rel="alternate" href="/details/3"/>
  </entry>
</feed>`;

describe('parseOpdsFeed', () => {
  it('parses feed title, entries, and resolves relative hrefs', () => {
    const feed = parseOpdsFeed(FEED, BASE);
    expect(feed.title).toBe('Example Catalog');
    expect(feed.entries).toHaveLength(3);
    expect(feed.next).toBe('https://opds.example.org/catalog?page=2');

    const first = feed.entries[0]!;
    expect(first.id).toBe('urn:book:1');
    expect(first.title).toBe('Pride and Prejudice');
    expect(first.summary).toBe('A classic.');
    expect(first.links).toContainEqual({
      rel: 'http://opds-spec.org/acquisition/open-access',
      href: 'https://opds.example.org/download/1.epub',
      type: 'application/epub+zip',
    });
  });

  it('does not leak entry-level links into the feed-level next link', () => {
    const withEntryNext = `<feed xmlns="http://www.w3.org/2005/Atom">
      <title>T</title>
      <entry><id>1</id><title>E</title><link rel="next" href="/should-not-count"/></entry>
    </feed>`;
    const feed = parseOpdsFeed(withEntryNext, BASE);
    expect(feed.next).toBeUndefined();
  });

  it('throws on malformed XML', () => {
    expect(() => parseOpdsFeed('<feed><unterminated>', BASE)).toThrow(/malformed/);
  });

  it('omits title/next/summary/updated entirely when absent, rather than emitting undefined', () => {
    const feed = parseOpdsFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>1</id><title>E</title></entry></feed>`,
      BASE,
    );
    expect('title' in feed).toBe(false);
    expect('next' in feed).toBe(false);
    expect('summary' in feed.entries[0]!).toBe(false);
    expect('updated' in feed.entries[0]!).toBe(false);
  });
});

describe('acquisitionLink', () => {
  it('prefers an open-access acquisition link over a generic one', () => {
    const feed = parseOpdsFeed(FEED, BASE);
    const link = acquisitionLink(feed.entries[0]!);
    expect(link?.rel).toBe('http://opds-spec.org/acquisition/open-access');
  });

  it('falls back to any acquisition-family link', () => {
    const feed = parseOpdsFeed(FEED, BASE);
    const link = acquisitionLink(feed.entries[1]!);
    expect(link?.href).toBe('https://opds.example.org/download/2');
  });

  it('returns undefined when an entry has no acquisition link', () => {
    const feed = parseOpdsFeed(FEED, BASE);
    expect(acquisitionLink(feed.entries[2]!)).toBeUndefined();
  });
});

describe('guessFilename', () => {
  it('prefers the href extension', () => {
    const feed = parseOpdsFeed(FEED, BASE);
    const link = acquisitionLink(feed.entries[0]!)!;
    expect(guessFilename(feed.entries[0]!, link)).toBe('Pride and Prejudice.epub');
  });

  it('falls back to the mime type when the href has no extension', () => {
    const feed = parseOpdsFeed(FEED, BASE);
    const link = acquisitionLink(feed.entries[1]!)!;
    expect(guessFilename(feed.entries[1]!, link)).toBe('Some Comic.cbz');
  });

  it('sanitizes unsafe filename characters from the title', () => {
    const entry = { id: '1', title: 'Weird: Title / With * Chars?', links: [] };
    const link = { rel: 'acquisition', href: '/x.epub' };
    expect(guessFilename(entry, link)).toBe('Weird_ Title _ With _ Chars_.epub');
  });
});
