// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { instantTransitions } from './transitions.js';

describe('instantTransitions', () => {
  it('page() sets a translate on the requested axis', () => {
    const el = document.createElement('div');
    instantTransitions.page(el, 0, -320, { axis: 'x', dir: 1, reduced: false });
    expect(el.style.transform).toBe('translateX(-320px)');
    instantTransitions.page(el, -320, 0, { axis: 'y', dir: -1, reduced: false });
    expect(el.style.transform).toBe('translateY(0px)');
  });

  it('zoom() sets the transform string verbatim', () => {
    const el = document.createElement('div');
    instantTransitions.zoom(el, 'translate(4px, 8px) scale(2)', false);
    expect(el.style.transform).toBe('translate(4px, 8px) scale(2)');
  });

  it('scrollTo() assigns the scroll property', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: 0, writable: true });
    instantTransitions.scrollTo(el, 'scrollTop', 500, false);
    expect(el.scrollTop).toBe(500);
  });

  it('cancel() is a no-op', () => {
    expect(() => instantTransitions.cancel()).not.toThrow();
  });
});
