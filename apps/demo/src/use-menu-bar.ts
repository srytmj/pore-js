import { useCallback, useEffect, useState } from 'react';

export type MenuPlacement = 'left' | 'right';
/** `always`: visible while windowed, hidden in fullscreen. `auto-hide`: hides on idle everywhere. */
export type MenuBehaviour = 'always' | 'auto-hide';

export interface MenuBar {
  placement: MenuPlacement;
  behaviour: MenuBehaviour;
  /** Collapsed to an icon-only rail (shadcn-style). */
  collapsed: boolean;
  setPlacement: (p: MenuPlacement) => void;
  setBehaviour: (b: MenuBehaviour) => void;
  setCollapsed: (c: boolean) => void;
  toggleCollapsed: () => void;
}

const KEY = 'pore:demo:menubar:v4';
const PLACEMENTS: MenuPlacement[] = ['left', 'right'];
const BEHAVIOURS: MenuBehaviour[] = ['always', 'auto-hide'];

interface Stored {
  placement: MenuPlacement;
  behaviour: MenuBehaviour;
  collapsed: boolean;
}

function load(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Partial<Stored>;
    if (
      PLACEMENTS.includes(s.placement as MenuPlacement) &&
      BEHAVIOURS.includes(s.behaviour as MenuBehaviour)
    ) {
      return {
        placement: s.placement as MenuPlacement,
        behaviour: s.behaviour as MenuBehaviour,
        collapsed: s.collapsed === true,
      };
    }
  } catch {
    /* no / bad stored value */
  }
  return { placement: 'right', behaviour: 'always', collapsed: false };
}

/** Persisted demo-shell setting for where the menu bar sits, how it hides, and whether it's collapsed. */
export function useMenuBar(): MenuBar {
  const [state, setState] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode / blocked */
    }
  }, [state]);
  return {
    placement: state.placement,
    behaviour: state.behaviour,
    collapsed: state.collapsed,
    setPlacement: useCallback((placement) => setState((s) => ({ ...s, placement })), []),
    setBehaviour: useCallback((behaviour) => setState((s) => ({ ...s, behaviour })), []),
    setCollapsed: useCallback((collapsed) => setState((s) => ({ ...s, collapsed })), []),
    toggleCollapsed: useCallback(() => setState((s) => ({ ...s, collapsed: !s.collapsed })), []),
  };
}
