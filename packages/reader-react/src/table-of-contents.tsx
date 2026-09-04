import type { TocEntry } from '@pore/reader-core';
import { useReader, useTableOfContents } from './reader.js';

export interface TableOfContentsProps {
  className?: string;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Render nothing when the book has no TOC (default `true`). */
  hideWhenEmpty?: boolean;
}

function flatten(entries: TocEntry[], depth = 0): { label: string; href: string; depth: number }[] {
  return entries.flatMap((e) => [
    { label: e.label, href: e.href, depth },
    ...flatten(e.children, depth + 1),
  ]);
}

/**
 * A native `<select>` bound to the reader's table of contents — picking an
 * entry calls `goToHref`. Native on purpose: it is fully accessible and the
 * demo styles it via `data-pore-toc`. (A Radix `DropdownMenu` variant can
 * layer on top later without touching this API.)
 */
export function TableOfContents({
  className,
  placeholder = 'Contents…',
  hideWhenEmpty = true,
}: TableOfContentsProps) {
  const toc = useTableOfContents();
  const { goToHref } = useReader();
  const items = flatten(toc).filter((e) => e.href);
  if (items.length === 0 && hideWhenEmpty) return null;

  return (
    <select
      {...(className ? { className } : {})}
      data-pore-toc
      aria-label="Table of contents"
      value=""
      onChange={(e) => e.target.value && goToHref(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {items.map((t, i) => (
        <option key={`${t.href}-${i}`} value={t.href}>
          {'  '.repeat(t.depth)}
          {t.label}
        </option>
      ))}
    </select>
  );
}
