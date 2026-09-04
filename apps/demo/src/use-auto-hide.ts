import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hides the chrome after `delay` ms of no pointer / key / touch activity, and
 * reveals it again on the next activity. Returns `[hidden, pin]` — call `pin()`
 * to keep it shown (e.g. while a panel is open).
 */
export function useAutoHide(delay = 2600, enabled = true): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedUntil = useRef(0);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!enabled) return;
    timer.current = setTimeout(() => {
      if (Date.now() >= pinnedUntil.current) setHidden(true);
    }, delay);
  }, [delay, enabled]);

  const wake = useCallback(() => {
    setHidden(false);
    arm();
  }, [arm]);

  const pin = useCallback(() => {
    pinnedUntil.current = Date.now() + 400;
    wake();
  }, [wake]);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    arm();
    const opts = { passive: true } as const;
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) addEventListener(e, wake, opts);
    return () => {
      for (const e of events) removeEventListener(e, wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm, wake, enabled]);

  return [hidden, pin];
}
