import type { ReaderTransitions } from '@pore/reader-core';

/**
 * The slice of GSAP's API this adapter needs. Pass the real `gsap` object
 * (`import gsap from 'gsap'`) — it is an *optional peer dependency* of
 * `@pore/reader-react`, never bundled.
 */
export interface GsapLike {
  to(target: unknown, vars: Record<string, unknown>): unknown;
  fromTo(target: unknown, from: Record<string, unknown>, to: Record<string, unknown>): unknown;
  set(target: unknown, vars: Record<string, unknown>): unknown;
  killTweensOf(target: unknown): void;
}

export interface GsapAdapterOptions {
  /** Page-turn / scroll duration in seconds. Default `0.22`. */
  duration?: number;
  /** GSAP ease. Default `'power2.out'`. */
  ease?: string;
  /** Fade the incoming page from this opacity on a real turn. `1` disables. Default `0.6`. */
  turnFadeFrom?: number;
}

/**
 * A {@link ReaderTransitions} backed by GSAP: direction-aware page slides with a
 * slight fade, eased zoom, eased programmatic scroll. `ctx.reduced` (or the
 * `reduced` arg) makes every method apply instantly.
 *
 * ```ts
 * import gsap from 'gsap';
 * <Reader transitions={gsapAdapter(gsap)}>
 * ```
 */
export function gsapAdapter(gsap: GsapLike, opts: GsapAdapterOptions = {}): ReaderTransitions {
  const duration = opts.duration ?? 0.22;
  const ease = opts.ease ?? 'power2.out';
  const fadeFrom = opts.turnFadeFrom ?? 0.6;
  const tracked = new Set<HTMLElement>();

  const translate = (axis: 'x' | 'y', px: number) =>
    axis === 'x' ? `translateX(${px}px)` : `translateY(${px}px)`;

  return {
    page(el, from, to, ctx) {
      tracked.add(el);
      if (ctx.reduced) {
        gsap.killTweensOf(el);
        el.style.transform = translate(ctx.axis, to);
        el.style.opacity = '';
        return;
      }
      const prop = ctx.axis;
      gsap.set(el, { [prop]: from });
      gsap.to(el, { [prop]: to, duration, ease, overwrite: 'auto' });
      if (ctx.dir !== 0 && fadeFrom < 1) {
        gsap.fromTo(
          el,
          { opacity: fadeFrom },
          { opacity: 1, duration: duration * 0.85, ease, clearProps: 'opacity' },
        );
      }
    },

    zoom(el, transform, reduced) {
      tracked.add(el);
      if (reduced || transform === '') {
        gsap.killTweensOf(el);
        el.style.transform = transform;
        return;
      }
      gsap.to(el, { transform, duration: 0.18, ease, overwrite: 'auto' });
    },

    scrollTo(el, prop, to, reduced) {
      tracked.add(el);
      if (reduced) {
        el[prop] = to;
        return;
      }
      gsap.to(el, { [prop]: to, duration: Math.max(duration, 0.3), ease, overwrite: 'auto' });
    },

    cancel() {
      for (const el of tracked) gsap.killTweensOf(el);
    },
  };
}
