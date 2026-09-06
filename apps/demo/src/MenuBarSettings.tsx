import type { MenuBar, MenuBehaviour, MenuPlacement } from './use-menu-bar.js';

const PLACEMENTS: { value: MenuPlacement; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];
const BEHAVIOURS: { value: MenuBehaviour; label: string; hint: string }[] = [
  { value: 'always', label: 'Always visible', hint: 'Hides only in fullscreen' },
  { value: 'auto-hide', label: 'Auto-hide', hint: 'Slides away when idle' },
];

/** The demo-level "Menu bar" section for the settings accordion. */
export function MenuBarSettings({
  menu,
  animate,
  onToggleAnimate,
}: {
  menu: MenuBar;
  animate: boolean;
  onToggleAnimate: () => void;
}) {
  return (
    <div className="menubar-settings">
      <fieldset>
        <legend>Placement</legend>
        <div className="menubar-settings__row">
          {PLACEMENTS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={menu.placement === p.value}
              className={menu.placement === p.value ? 'active' : ''}
              onClick={() => menu.setPlacement(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Behaviour</legend>
        <div className="menubar-settings__col">
          {BEHAVIOURS.map((b) => (
            <button
              key={b.value}
              type="button"
              aria-pressed={menu.behaviour === b.value}
              className={menu.behaviour === b.value ? 'active' : ''}
              onClick={() => menu.setBehaviour(b.value)}
            >
              <span>{b.label}</span>
              <span className="menubar-settings__hint">{b.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="menubar-settings__toggle">
        <span>Page-turn animations</span>
        <input
          type="checkbox"
          checked={animate}
          onChange={onToggleAnimate}
          aria-label="Page-turn animations"
        />
      </label>
    </div>
  );
}
