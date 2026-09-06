import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hides the chrome after `delay` ms of no pointer / key / wheel / touch
 * activity anywhere in the window, and reveals it again on the next activity.
 * Returns `[hidden, pin, hide]` — `pin()` forces it shown (e.g. while a panel
 * is open), `hide()` forces it away.
 */
export function useAutoHide(delay = 2600, enabled = true): [boolean, () => void, () => void] {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pin = useCallback(() => setHidden(false), []);
  const hide = useCallback(() => setHidden(true), []);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const arm = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setHidden(true), delay);
    };
    const wake = () => {
      setHidden(false);
      arm();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    arm();
    return () => {
      clearTimeout(timer.current);
      for (const e of events) window.removeEventListener(e, wake);
    };
  }, [delay, enabled]);

  return [hidden, pin, hide];
}
