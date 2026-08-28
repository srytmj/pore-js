import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYMAP, resolveAction } from './keymap.js';

describe('resolveAction', () => {
  it('maps a default key to its action', () => {
    expect(resolveAction(DEFAULT_KEYMAP, 'ArrowRight')).toBe('page-right');
    expect(resolveAction(DEFAULT_KEYMAP, '.')).toBe('chapter-back');
  });

  it('returns null for an unbound key', () => {
    expect(resolveAction(DEFAULT_KEYMAP, 'z')).toBeNull();
  });
});
