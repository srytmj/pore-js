export interface SpineItem {
  idref: string;
  /** Path within the archive, resolved against the OPF directory. */
  href: string;
  mediaType: string;
  linear: boolean;
}

export interface TocEntry {
  label: string;
  /** Archive path, may carry a `#fragment`. Empty for a pure heading. */
  href: string;
  children: TocEntry[];
}

export interface EpubMetadata {
  title: string;
  language?: string;
  creator?: string;
  /** From `<spine page-progression-direction>`. */
  direction: 'ltr' | 'rtl';
  /** `rendition:layout` === "pre-paginated" — fixed-layout, not supported in v1. */
  fixedLayout: boolean;
}

export interface EpubResource {
  bytes: Uint8Array;
  mediaType: string;
}

export interface EpubBook {
  metadata: EpubMetadata;
  spine: SpineItem[];
  toc: TocEntry[];
  /** Archive path of the OPF, for resolving relative hrefs. */
  opfPath: string;
  /** Look up a resource by archive path (query/fragment stripped). */
  resource(href: string): EpubResource | null;
  /** All archive entry paths. */
  entries: string[];
}
