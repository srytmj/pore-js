import { useCallback, useEffect, useState } from 'react';

/**
 * `[isFullscreen, toggle]` for the real browser Fullscreen API. Entering
 * fullscreen is what forces the menu bar into auto-hide (see App / Chrome).
 */
export function useFullscreen(): [boolean, () => void] {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement,
  );

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  return [isFullscreen, toggle];
}
