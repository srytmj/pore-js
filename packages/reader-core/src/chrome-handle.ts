/**
 * The small idle-fading affordance at the bottom-centre of the reading surface
 * that toggles the host chrome (`reader:chrometoggle`). Shared by the image and
 * text engines. Rendered with inline styles so it works with no stylesheet;
 * `[data-pore-chrome-handle]` is the hook to restyle or hide it.
 */
export interface ChromeHandleOptions {
  root: HTMLElement;
  doc: Document;
  onToggle: () => void;
  /** ms of stillness before it fades back to the idle opacity. */
  idleMs?: number;
}

export interface ChromeHandle {
  el: HTMLButtonElement;
  /** Show / remove the handle (per the `chromeGesture` setting). */
  setActive(active: boolean): void;
  /** Hide the handle while the host chrome is open. */
  setChromeOpen(open: boolean): void;
  /** Bump to full opacity and restart the idle timer. */
  wake(): void;
  destroy(): void;
}

const CHEVRON =
  '<svg viewBox="0 0 24 12" width="22" height="11" aria-hidden="true" focusable="false">' +
  '<path d="M2 10 L12 2.5 L22 10" fill="none" stroke="currentColor" stroke-width="2.4" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

const IDLE_OPACITY = '0.28';
const ACTIVE_OPACITY = '0.6';

export function createChromeHandle(opts: ChromeHandleOptions): ChromeHandle {
  const { root, doc, onToggle, idleMs = 3000 } = opts;

  const el = doc.createElement('button');
  el.type = 'button';
  el.className = 'pore-chrome-handle';
  el.setAttribute('data-pore-chrome-handle', '');
  el.setAttribute('aria-label', 'Show menu');
  el.innerHTML = CHEVRON;
  el.style.cssText = [
    'position:absolute',
    'left:50%',
    'bottom:calc(env(safe-area-inset-bottom, 0px) + 8px)',
    'transform:translateX(-50%)',
    'z-index:3',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'width:46px',
    'height:26px',
    'padding:0',
    'border:0',
    'border-radius:999px',
    'color:currentColor',
    'background:color-mix(in srgb, currentColor 10%, transparent)',
    '-webkit-backdrop-filter:blur(6px)',
    'backdrop-filter:blur(6px)',
    'box-shadow:0 1px 6px rgba(0,0,0,0.18)',
    'cursor:pointer',
    'touch-action:manipulation',
    `opacity:${IDLE_OPACITY}`,
    'transition:opacity 0.25s ease',
  ].join(';');

  let active = false;
  let chromeOpen = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const render = () => {
    el.style.display = active && !chromeOpen ? 'inline-flex' : 'none';
  };

  const wake = () => {
    if (!active || chromeOpen) return;
    el.style.opacity = ACTIVE_OPACITY;
    clearIdle();
    idleTimer = setTimeout(() => {
      el.style.opacity = IDLE_OPACITY;
    }, idleMs);
  };

  const onEnter = () => wake();
  const onClick = (ev: MouseEvent) => {
    ev.stopPropagation();
    onToggle();
  };

  el.addEventListener('click', onClick);
  el.addEventListener('pointerenter', onEnter);
  root.appendChild(el);

  return {
    el,
    setActive(next) {
      active = next;
      render();
      if (next) wake();
      else clearIdle();
    },
    setChromeOpen(open) {
      chromeOpen = open;
      render();
      if (!open) wake();
    },
    wake,
    destroy() {
      clearIdle();
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointerenter', onEnter);
      el.remove();
    },
  };
}
