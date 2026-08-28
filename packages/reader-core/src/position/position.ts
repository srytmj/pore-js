import type { Position } from './types.js';

export function isPagePosition(p: Position): p is Extract<Position, { type: 'page' }> {
  return p.type === 'page';
}

export function isScrollPosition(p: Position): p is Extract<Position, { type: 'scroll' }> {
  return p.type === 'scroll';
}

/**
 * Restore a stored `page` position against a possibly-changed total
 * (a book can be re-synced with a different page count). See spec §2.2.1.
 */
export function clampPagePosition(stored: Position, currentTotal: number): number {
  if (currentTotal <= 0) return 0;
  if (stored.type === 'page') {
    if (stored.total === currentTotal || stored.total <= 0) {
      return clamp(stored.value, 0, currentTotal - 1);
    }
    const ratio = stored.value / stored.total;
    return clamp(Math.round(ratio * currentTotal), 0, currentTotal - 1);
  }
  if (stored.type === 'scroll' && typeof stored.page === 'number') {
    return clamp(stored.page, 0, currentTotal - 1);
  }
  return 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
