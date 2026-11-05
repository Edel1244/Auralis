export type Listener<T> = (payload: T) => void;

/** Tiny typed event emitter (no DOM dependency, works in tests). */
export class Emitter<Events extends Record<string, unknown>> {
  private map = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    let set = this.map.get(event);
    if (!set) this.map.set(event, (set = new Set()));
    set.add(fn as Listener<never>);
    return () => set!.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.map.get(event)?.forEach((fn) => (fn as Listener<Events[K]>)(payload));
  }

  clear() {
    this.map.clear();
  }
}
