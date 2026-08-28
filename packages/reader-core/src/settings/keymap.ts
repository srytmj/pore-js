/**
 * Remappable keybindings — see docs/image-engine-spec.md §7.
 * Defaults follow the MangaDex web reader.
 *
 * Actions are **physical** where the reference UI is physical: `page-right` /
 * `page-left` describe screen direction. The engine translates them to a
 * logical turn (`forward` / `back`) via the current {@link Direction} — RTL
 * swaps them.
 */

export type ActionId =
  | 'toggle-menu'
  | 'page-right'
  | 'page-left'
  | 'scroll-up'
  | 'scroll-down'
  | 'chapter-forward'
  | 'chapter-back'
  | 'toggle-fullscreen'
  | 'cycle-fit'
  | 'toggle-spread-offset'
  | 'first-page'
  | 'last-page'
  | 'toggle-autoscroll';

export type Keymap = Record<ActionId, string[]>;

export const DEFAULT_KEYMAP: Keymap = {
  'toggle-menu': ['m'],
  'page-right': ['ArrowRight', 'd', '6'],
  'page-left': ['ArrowLeft', 'a', '4'],
  'scroll-up': ['w', '8'],
  'scroll-down': ['s', '2'],
  'chapter-forward': [','],
  'chapter-back': ['.'],
  'toggle-fullscreen': ['f'],
  'cycle-fit': ['i'],
  'toggle-spread-offset': ['o'],
  'first-page': ['Home'],
  'last-page': ['End'],
  'toggle-autoscroll': [],
};

/** Resolve a KeyboardEvent key to the bound action, if any. */
export function resolveAction(keymap: Keymap, key: string): ActionId | null {
  for (const action of Object.keys(keymap) as ActionId[]) {
    if (keymap[action].includes(key)) return action;
  }
  return null;
}
