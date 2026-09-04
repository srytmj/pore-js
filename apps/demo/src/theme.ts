import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function initial(): Theme {
  try {
    const saved = localStorage.getItem('pore:demo:theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* private mode / blocked storage */
  }
  return matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Demo-only light/dark toggle. Sets `<html class="dark">` and remembers the choice. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('pore:demo:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return [theme, toggle];
}
