import { describe, expect, it } from 'vitest';
import { createSettingsPersistence, type SettingsStorage } from './settings-store.js';
import type { AnySettings } from './reader.js';

function memStorage(): SettingsStorage & { dump: Record<string, string> } {
  const dump: Record<string, string> = {};
  return {
    dump,
    getItem: (k) => dump[k] ?? null,
    setItem: (k, v) => {
      dump[k] = v;
    },
  };
}

const imageSettings = {
  layout: 'paged-double',
  direction: 'rtl',
  spreadOffset: 1,
  fit: 'width',
  brightness: 0.7,
  loadingMethod: 'blob',
  tapToTurn: 'directional',
} as unknown as AnySettings;

describe('createSettingsPersistence', () => {
  it('splits per-book layout keys from global preferences', () => {
    const storage = memStorage();
    const p = createSettingsPersistence(storage);
    p.save('book-1', 'image', imageSettings);

    const global = JSON.parse(storage.dump['pore:settings:global']!);
    const book = JSON.parse(storage.dump['pore:settings:book:book-1']!);
    expect(book).toMatchObject({
      layout: 'paged-double',
      direction: 'rtl',
      spreadOffset: 1,
      fit: 'width',
    });
    expect(book).not.toHaveProperty('brightness');
    expect(global).toMatchObject({
      brightness: 0.7,
      loadingMethod: 'blob',
      tapToTurn: 'directional',
    });
    expect(global).not.toHaveProperty('layout');
  });

  it('seeds a book from global + its own layer, book layer winning', () => {
    const storage = memStorage();
    storage.setItem(
      'pore:settings:global',
      JSON.stringify({ brightness: 0.5, layout: 'paged-single' }),
    );
    storage.setItem(
      'pore:settings:book:b2',
      JSON.stringify({ layout: 'continuous-vertical', direction: 'ltr' }),
    );
    const p = createSettingsPersistence(storage);
    const seed = p.initial('b2', 'image');
    expect(seed).toMatchObject({
      brightness: 0.5,
      layout: 'continuous-vertical', // book layer overrides the global one
      direction: 'ltr',
    });
  });

  it('is a no-op when storage is unavailable', () => {
    const p = createSettingsPersistence(null);
    expect(p.initial('x', 'text')).toEqual({});
    expect(() => p.save('x', 'text', {} as AnySettings)).not.toThrow();
  });

  it('per-book layer only keeps whitelisted keys on read', () => {
    const storage = memStorage();
    storage.setItem(
      'pore:settings:book:b3',
      JSON.stringify({ layout: 'paged-double', brightness: 0.2 }),
    );
    const seed = createSettingsPersistence(storage).initial('b3', 'image');
    expect(seed).toMatchObject({ layout: 'paged-double' });
    expect(seed).not.toHaveProperty('brightness');
  });
});
