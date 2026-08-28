/**
 * Remappable keybindings — see docs/image-engine-spec.md §7.
 * Defaults follow the MangaDex web reader.
 *
 * "turn-forward" / "turn-back" are LOGICAL; the engine maps physical keys
 * (turn-right / turn-left) to these via `direction` (RTL swaps).
 */

export type ActionId =
  | 'toggle-menu'
  | 'turn-forward'
  | 'turn-back'
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

/** Physical-key defaults; `turn-forward`/`turn-back` are filled per direction. */
export const DEFAULT_KEYMAP: Keymap = {
  'toggle-menu': ['m'],
  'turn-forward': ['ArrowRight', 'd', '6'],
  'turn-back': ['ArrowLeft', 'a', '4'],
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
