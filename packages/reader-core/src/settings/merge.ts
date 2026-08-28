import { DEFAULT_IMAGE_SETTINGS, type ImageEngineSettings } from './types.js';
import { DEFAULT_KEYMAP, type Keymap } from './keymap.js';

/** Merge a settings patch over a base, with a one-level merge for `progressBar`. */
export function mergeSettings(
  base: ImageEngineSettings,
  patch?: Partial<ImageEngineSettings>,
): ImageEngineSettings {
  if (!patch) return base;
  const next: ImageEngineSettings = { ...base, ...patch };
  if (patch.progressBar) {
    next.progressBar = { ...base.progressBar, ...patch.progressBar };
  }
  return next;
}

/** Resolve initial settings from DEFAULT_IMAGE_SETTINGS + an optional patch. */
export function resolveSettings(patch?: Partial<ImageEngineSettings>): ImageEngineSettings {
  return mergeSettings(DEFAULT_IMAGE_SETTINGS, patch);
}

/** Merge a keymap patch over a base (per-action replace, not append). */
export function mergeKeymap(base: Keymap, patch?: Partial<Keymap>): Keymap {
  if (!patch) return base;
  return { ...base, ...patch };
}

export function resolveKeymap(patch?: Partial<Keymap>): Keymap {
  return mergeKeymap(DEFAULT_KEYMAP, patch);
}
