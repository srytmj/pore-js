/**
 * OPDS 1.2 catalog parsing — OPDS is Atom (RFC 4287) plus a small set of
 * conventions (`opds-spec.org/acquisition*` link relations, `rel="next"`
 * pagination). OPDS 2.0 (JSON-based) is out of scope for this pass — see
 * docs/m4-plan.md F4.
 */

export interface OpdsLink {
  rel: string;
  /** Resolved to an absolute URL against the feed's own URL. */
  href: string;
  type?: string;
}

export interface OpdsEntry {
  id: string;
  title: string;
  updated?: string;
  summary?: string;
  links: OpdsLink[];
}

export interface OpdsFeed {
  title?: string;
  entries: OpdsEntry[];
  /** Absolute URL of the next page, when the feed paginates (`rel="next"`). */
  next?: string;
}

/** Direct element children with a given local name (ignores namespace prefixes, and — unlike a recursive query — doesn't reach into nested `<entry>` elements). */
function children(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function text(el: Element, name: string): string | undefined {
  return children(el, name)[0]?.textContent?.trim() || undefined;
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function readLinks(el: Element, baseUrl: string): OpdsLink[] {
  return children(el, 'link').map((l) => {
    const type = l.getAttribute('type');
    return {
      rel: l.getAttribute('rel') ?? '',
      href: resolveUrl(l.getAttribute('href') ?? '', baseUrl),
      ...(type ? { type } : {}),
    };
  });
}

/** Parse an OPDS 1.2 (Atom) catalog feed. `baseUrl` resolves any relative `href`s. */
export function parseOpdsFeed(
  xmlText: string,
  baseUrl: string,
  domParser: DOMParser = new DOMParser(),
): OpdsFeed {
  const doc = domParser.parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('opds: malformed feed XML');
  }
  const root = doc.documentElement;
  const entries: OpdsEntry[] = children(root, 'entry').map((entry) => {
    const updated = text(entry, 'updated');
    const summary = text(entry, 'summary') ?? text(entry, 'content');
    return {
      id: text(entry, 'id') ?? '',
      title: text(entry, 'title') ?? 'Untitled',
      ...(updated ? { updated } : {}),
      ...(summary ? { summary } : {}),
      links: readLinks(entry, baseUrl),
    };
  });
  const title = text(root, 'title');
  const next = readLinks(root, baseUrl).find((l) => l.rel === 'next')?.href;
  return {
    ...(title ? { title } : {}),
    entries,
    ...(next ? { next } : {}),
  };
}

const ACQUISITION_REL = /^http:\/\/opds-spec\.org\/acquisition\b/;

/** The best acquisition link on an entry — prefers a fully open-access download over borrow/sample/subscribe variants. */
export function acquisitionLink(entry: OpdsEntry): OpdsLink | undefined {
  const candidates = entry.links.filter(
    (l) => l.rel === 'acquisition' || ACQUISITION_REL.test(l.rel),
  );
  return candidates.find((l) => /\/acquisition\/open-access$/.test(l.rel)) ?? candidates[0];
}

const EXT_BY_TYPE: Record<string, string> = {
  'application/epub+zip': 'epub',
  'application/pdf': 'pdf',
  'application/x-cbz': 'cbz',
  'application/vnd.comicbook+zip': 'cbz',
  'application/zip': 'zip',
};

/** A filename for the acquired blob — `LocalFileSource` picks its book kind off the extension. */
export function guessFilename(entry: OpdsEntry, link: OpdsLink): string {
  const hrefExt = /\.(epub|pdf|cbz|zip)(?:[?#]|$)/i.exec(link.href)?.[1]?.toLowerCase();
  const typeExt = link.type ? EXT_BY_TYPE[link.type.split(';')[0]!.trim()] : undefined;
  const ext = hrefExt ?? typeExt ?? 'epub';
  const safe = entry.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'book';
  return `${safe}.${ext}`;
}
