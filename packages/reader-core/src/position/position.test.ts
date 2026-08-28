import { describe, expect, it } from 'vitest';
import { clampPagePosition } from './position.js';
import type { Position } from './types.js';

describe('clampPagePosition', () => {
  it('returns the stored value when totals match', () => {
    const p: Position = { type: 'page', value: 12, total: 22 };
    expect(clampPagePosition(p, 22)).toBe(12);
  });

  it('scales by ratio when the total changed on re-sync', () => {
    const p: Position = { type: 'page', value: 10, total: 20 };
    expect(clampPagePosition(p, 40)).toBe(20);
  });

  it('clamps into range', () => {
    const p: Position = { type: 'page', value: 999, total: 100 };
    expect(clampPagePosition(p, 10)).toBe(9);
  });

  it('uses the scroll anchor page when present', () => {
    const p: Position = { type: 'scroll', value: 0.5, total: 1, page: 7 };
    expect(clampPagePosition(p, 20)).toBe(7);
  });

  it('falls back to 0 for an empty book', () => {
    const p: Position = { type: 'page', value: 3, total: 5 };
    expect(clampPagePosition(p, 0)).toBe(0);
  });
});
