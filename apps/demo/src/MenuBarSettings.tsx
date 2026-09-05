import type { MenuBar, MenuBehaviour, MenuPlacement } from './use-menu-bar.js';

const PLACEMENTS: { value: MenuPlacement; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];
const BEHAVIOURS: { value: MenuBehaviour; label: string; hint: string }[] = [
  { value: 'always', label: 'Always visible', hint: 'Hides only in fullscreen' },
  { value: 'auto-hide', label: 'Auto-hide', hint: 'Slides away when idle' },
];

/** The "Menu bar" settings tab — passed to `<SettingsPanel extraTabs>`. */
export function MenuBarSettings({ menu }: { menu: MenuBar }) {
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
    </div>
  );
}
