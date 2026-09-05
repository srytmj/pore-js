import { useCallback, useEffect, useState } from 'react';

export type MenuPlacement = 'top' | 'left' | 'right';
/** `always`: visible while windowed, hidden in fullscreen. `auto-hide`: hides on idle everywhere. */
export type MenuBehaviour = 'always' | 'auto-hide';

export interface MenuBar {
  placement: MenuPlacement;
  behaviour: MenuBehaviour;
  setPlacement: (p: MenuPlacement) => void;
  setBehaviour: (b: MenuBehaviour) => void;
}

const KEY = 'pore:demo:menubar';
const PLACEMENTS: MenuPlacement[] = ['top', 'left', 'right'];
const BEHAVIOURS: MenuBehaviour[] = ['always', 'auto-hide'];

function load(): { placement: MenuPlacement; behaviour: MenuBehaviour } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Partial<MenuBar>;
    if (
      PLACEMENTS.includes(s.placement as MenuPlacement) &&
      BEHAVIOURS.includes(s.behaviour as MenuBehaviour)
    ) {
      return { placement: s.placement as MenuPlacement, behaviour: s.behaviour as MenuBehaviour };
    }
  } catch {
    /* no / bad stored value */
  }
  return { placement: 'top', behaviour: 'always' };
}

/** Persisted demo-shell setting for where the menu bar sits and how it hides. */
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
    setPlacement: useCallback((placement) => setState((s) => ({ ...s, placement })), []),
    setBehaviour: useCallback((behaviour) => setState((s) => ({ ...s, behaviour })), []),
  };
}
