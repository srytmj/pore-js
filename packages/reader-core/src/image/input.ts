import type { Direction } from '../types.js';

export type TapZone = 'left' | 'center' | 'right';
export type TapToTurn = 'directional' | 'always-forward' | 'never';
export type TapResult = 'forward' | 'back' | 'toggle-chrome' | null;

/** Which third of the width `x` falls in (0..width). Center band is the middle third. */
export function zoneForPoint(x: number, width: number): TapZone {
  if (width <= 0) return 'center';
  const r = x / width;
  if (r < 1 / 3) return 'left';
  if (r > 2 / 3) return 'right';
  return 'center';
}

/**
 * Resolve a tap in a screen zone to an action. Center always toggles chrome.
 * Edges depend on `tapToTurn` and (for `directional`) reading `direction`.
 */
export function resolveTap(zone: TapZone, tapToTurn: TapToTurn, direction: Direction): TapResult {
  if (zone === 'center') return 'toggle-chrome';
  if (tapToTurn === 'never') return null;
  if (tapToTurn === 'always-forward') return 'forward';
  // directional: right zone = forward in LTR, back in RTL
  const rightIsForward = direction !== 'rtl';
  const isRight = zone === 'right';
  return isRight === rightIsForward ? 'forward' : 'back';
}

/** Classify a horizontal swipe by dx (px) against a threshold. */
export function swipeTurn(
  dx: number,
  direction: Direction,
  threshold = 40,
): 'forward' | 'back' | null {
  if (Math.abs(dx) < threshold) return null;
  const swipedLeft = dx < 0;
  // swiping left advances in LTR, goes back in RTL
  const leftIsForward = direction !== 'rtl';
  return swipedLeft === leftIsForward ? 'forward' : 'back';
}

/** Clamp a zoom scale into the supported range. */
export function clampZoom(scale: number, min = 0.25, max = 5): number {
  return Math.min(max, Math.max(min, scale));
}
