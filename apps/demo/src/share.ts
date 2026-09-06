/** A copy-only pointer into a book: `…/?book=<id>&cfi=<epubcfi>`. No server. */
export function deepLink(bookId: string, cfi: string): string {
  const u = new URL(location.href);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) u.searchParams.delete(key);
  if (bookId) u.searchParams.set('book', bookId);
  u.searchParams.set('cfi', cfi);
  return u.toString();
}

/** Quoted passage + a citation line (locator · link), for the clipboard. */
export function citation(quote: string, locator: string | undefined, link: string): string {
  const q = quote.trim().replace(/\s+/g, ' ');
  return [`"${q}"`, [locator, link].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
