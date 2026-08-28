import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from './emitter.js';

interface Events {
  hello: { name: string };
  tick: number;
}

describe('createEmitter', () => {
  it('delivers payloads to subscribers', () => {
    const e = createEmitter<Events>();
    const fn = vi.fn();
    e.on('hello', fn);
    e.emit('hello', { name: 'ada' });
    expect(fn).toHaveBeenCalledWith({ name: 'ada' });
  });

  it('unsubscribes via the returned fn and via off()', () => {
    const e = createEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    const offA = e.on('tick', a);
    e.on('tick', b);
    offA();
    e.off('tick', b);
    e.emit('tick', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('tolerates handlers that unsubscribe during emit', () => {
    const e = createEmitter<Events>();
    const seen: number[] = [];
    const off = e.on('tick', () => {
      seen.push(1);
      off();
    });
    e.on('tick', () => seen.push(2));
    e.emit('tick', 0);
    e.emit('tick', 0);
    expect(seen).toEqual([1, 2, 2]);
  });
});
