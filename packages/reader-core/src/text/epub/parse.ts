import { unzipSync } from 'fflate';
import type { EpubBook, EpubMetadata, EpubResource, SpineItem, TocEntry } from './types.js';
import { dirOf, resolveHref, resolvePath, stripHash } from './path.js';

const CONTAINER_PATH = 'META-INF/container.xml';
const decoder = new TextDecoder();

export interface ParseEpubOptions {
  /** Injectable for tests; defaults to the global DOMParser. */
  domParser?: DOMParser;
}

function xml(text: string, parser: DOMParser): Document {
  const doc = parser.parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('epub: malformed XML');
  }
  return doc;
}

/** getElementsByTagName that ignores namespace prefixes. */
function byLocalName(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((el) => el.localName === name);
}

function firstText(root: ParentNode, name: string): string | undefined {
  return byLocalName(root, name)[0]?.textContent?.trim() || undefined;
}

function mimeFromExt(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return (
    {
      xhtml: 'application/xhtml+xml',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'text/javascript',
      ncx: 'application/x-dtbncx+xml',
      opf: 'application/oebps-package+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      otf: 'font/otf',
    }[ext] ?? 'application/octet-stream'
  );
}

export function parseEpub(bytes: Uint8Array, opts: ParseEpubOptions = {}): EpubBook {
  const parser = opts.domParser ?? new DOMParser();
  const files = unzipSync(bytes);
  const entries = Object.keys(files);

  const container = files[CONTAINER_PATH];
  if (!container) throw new Error('epub: missing META-INF/container.xml');
  const opfPath = xml(decoder.decode(container), parser)
    .querySelector('rootfile')
    ?.getAttribute('full-path');
  if (!opfPath || !files[opfPath]) throw new Error('epub: OPF not found');

  const opf = xml(decoder.decode(files[opfPath]), parser);
  const opfDir = dirOf(opfPath);

  // --- manifest ---
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  for (const item of byLocalName(opf, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (!id || !href) continue;
    manifest.set(id, {
      href: resolvePath(opfDir, href),
      mediaType: item.getAttribute('media-type') ?? mimeFromExt(href),
      properties: item.getAttribute('properties') ?? '',
    });
  }

  // --- spine ---
  const spineEl = byLocalName(opf, 'spine')[0];
  const spine: SpineItem[] = [];
  for (const ref of spineEl ? byLocalName(spineEl, 'itemref') : []) {
    const idref = ref.getAttribute('idref');
    const entry = idref ? manifest.get(idref) : undefined;
    if (!idref || !entry) continue;
    spine.push({
      idref,
      href: entry.href,
      mediaType: entry.mediaType,
      linear: ref.getAttribute('linear') !== 'no',
    });
  }

  // --- metadata ---
  const metaEl = byLocalName(opf, 'metadata')[0] ?? opf;
  const renditionLayout = byLocalName(metaEl, 'meta').find(
    (m) => m.getAttribute('property') === 'rendition:layout',
  )?.textContent;
  const language = firstText(metaEl, 'language');
  const creator = firstText(metaEl, 'creator');
  const metadata: EpubMetadata = {
    title: firstText(metaEl, 'title') ?? 'Untitled',
    ...(language ? { language } : {}),
    ...(creator ? { creator } : {}),
    direction: spineEl?.getAttribute('page-progression-direction') === 'rtl' ? 'rtl' : 'ltr',
    fixedLayout: renditionLayout?.trim() === 'pre-paginated',
  };

  // --- TOC: EPUB3 nav, else EPUB2 ncx ---
  let toc: TocEntry[] = [];
  const navEntry = [...manifest.values()].find((m) => m.properties.split(/\s+/).includes('nav'));
  if (navEntry && files[navEntry.href]) {
    toc = parseNav(xml(decoder.decode(files[navEntry.href]), parser), dirOf(navEntry.href));
  } else {
    const tocId = spineEl?.getAttribute('toc');
    const ncx = tocId ? manifest.get(tocId) : undefined;
    if (ncx && files[ncx.href]) {
      toc = parseNcx(xml(decoder.decode(files[ncx.href]), parser), dirOf(ncx.href));
    }
  }

  const resource = (href: string): EpubResource | null => {
    const path = stripHash(href).startsWith(opfDir) ? stripHash(href) : resolvePath(opfDir, href);
    const data = files[path] ?? files[stripHash(href)];
    if (!data) return null;
    const known = [...manifest.values()].find((m) => m.href === path);
    return { bytes: data, mediaType: known?.mediaType ?? mimeFromExt(path) };
  };

  return { metadata, spine, toc, opfPath, resource, entries };
}

function parseNav(doc: Document, navDir: string): TocEntry[] {
  const nav =
    byLocalName(doc, 'nav').find(
      (n) => (n.getAttribute('epub:type') ?? n.getAttribute('type')) === 'toc',
    ) ?? byLocalName(doc, 'nav')[0];
  const ol = nav ? byLocalName(nav, 'ol')[0] : undefined;
  return ol ? readOl(ol, navDir) : [];
}

function readOl(ol: Element, navDir: string): TocEntry[] {
  const out: TocEntry[] = [];
  for (const li of Array.from(ol.children).filter((c) => c.localName === 'li')) {
    const a = Array.from(li.children).find((c) => c.localName === 'a' || c.localName === 'span');
    const childOl = Array.from(li.children).find((c) => c.localName === 'ol');
    out.push({
      label: a?.textContent?.trim() ?? '',
      href: a?.getAttribute('href') ? resolveHref(navDir, a.getAttribute('href')!) : '',
      children: childOl ? readOl(childOl, navDir) : [],
    });
  }
  return out;
}

function parseNcx(doc: Document, ncxDir: string): TocEntry[] {
  const map = byLocalName(doc, 'navMap')[0];
  return map ? readNavPoints(map, ncxDir) : [];
}

function readNavPoints(parent: Element, ncxDir: string): TocEntry[] {
  const out: TocEntry[] = [];
  for (const np of Array.from(parent.children).filter((c) => c.localName === 'navPoint')) {
    const label = firstText(np, 'text') ?? '';
    const src = byLocalName(np, 'content')[0]?.getAttribute('src') ?? '';
    out.push({
      label,
      href: src ? resolveHref(ncxDir, src) : '',
      children: readNavPoints(np, ncxDir),
    });
  }
  return out;
}
