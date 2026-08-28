/**
 * Minimal typed event emitter. `EventMap` maps event name → payload type.
 */
export interface Emitter<EventMap> {
  on<E extends keyof EventMap>(event: E, handler: (payload: EventMap[E]) => void): () => void;
  off<E extends keyof EventMap>(event: E, handler: (payload: EventMap[E]) => void): void;
  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void;
  clear(): void;
}

export function createEmitter<EventMap>(): Emitter<EventMap> {
  type AnyHandler = (payload: unknown) => void;
  const map = new Map<keyof EventMap, Set<AnyHandler>>();

  return {
    on(event, handler) {
      let set = map.get(event);
      if (!set) {
        set = new Set();
        map.set(event, set);
      }
      set.add(handler as AnyHandler);
      return () => this.off(event, handler);
    },
    off(event, handler) {
      map.get(event)?.delete(handler as AnyHandler);
    },
    emit(event, payload) {
      const set = map.get(event);
      if (!set) return;
      for (const handler of [...set]) handler(payload);
    },
    clear() {
      map.clear();
    },
  };
}
