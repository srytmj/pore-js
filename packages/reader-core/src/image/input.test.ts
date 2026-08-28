import { describe, expect, it } from 'vitest';
import { clampZoom, resolveTap, swipeTurn, zoneForPoint } from './input.js';

describe('zoneForPoint', () => {
  it('splits width into thirds', () => {
    expect(zoneForPoint(50, 300)).toBe('left');
    expect(zoneForPoint(150, 300)).toBe('center');
    expect(zoneForPoint(250, 300)).toBe('right');
  });
});

describe('resolveTap', () => {
  it('center always toggles chrome', () => {
    expect(resolveTap('center', 'directional', 'ltr')).toBe('toggle-chrome');
    expect(resolveTap('center', 'never', 'rtl')).toBe('toggle-chrome');
  });
  it('directional respects reading direction', () => {
    expect(resolveTap('right', 'directional', 'ltr')).toBe('forward');
    expect(resolveTap('left', 'directional', 'ltr')).toBe('back');
    expect(resolveTap('right', 'directional', 'rtl')).toBe('back');
    expect(resolveTap('left', 'directional', 'rtl')).toBe('forward');
  });
  it('always-forward ignores the zone side', () => {
    expect(resolveTap('left', 'always-forward', 'ltr')).toBe('forward');
    expect(resolveTap('right', 'always-forward', 'rtl')).toBe('forward');
  });
  it('never disables edge taps', () => {
    expect(resolveTap('left', 'never', 'ltr')).toBeNull();
    expect(resolveTap('right', 'never', 'ltr')).toBeNull();
  });
});

describe('swipeTurn', () => {
  it('ignores short swipes', () => {
    expect(swipeTurn(20, 'ltr')).toBeNull();
  });
  it('swiping left advances in LTR, goes back in RTL', () => {
    expect(swipeTurn(-80, 'ltr')).toBe('forward');
    expect(swipeTurn(-80, 'rtl')).toBe('back');
    expect(swipeTurn(80, 'ltr')).toBe('back');
    expect(swipeTurn(80, 'rtl')).toBe('forward');
  });
});

describe('clampZoom', () => {
  it('clamps to [0.25, 5]', () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(9)).toBe(5);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});
