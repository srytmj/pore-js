/** Directory portion of an archive path ("OEBPS/x/y.opf" → "OEBPS/x/"). */
export function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i + 1);
}

/** Strip `?query` and `#fragment`. */
export function stripHash(href: string): string {
  return href.replace(/[?#].*$/, '');
}

/** The `#fragment` of an href, without the `#` ("" if none). */
export function fragmentOf(href: string): string {
  const i = href.indexOf('#');
  return i === -1 ? '' : href.slice(i + 1);
}

/**
 * Resolve `rel` against `base` (a directory path), collapsing `.` and `..`.
 * Both are archive-internal POSIX paths, no scheme.
 */
export function resolvePath(base: string, rel: string): string {
  if (/^[a-z]+:/i.test(rel)) return rel; // absolute URL — leave it
  const stack = (rel.startsWith('/') ? '' : base).split('/').filter(Boolean);
  for (const part of stripHash(rel).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

/** Like {@link resolvePath} but keeps any `#fragment`. */
export function resolveHref(base: string, rel: string): string {
  const frag = fragmentOf(rel);
  const path = resolvePath(base, rel);
  return frag ? `${path}#${frag}` : path;
}
