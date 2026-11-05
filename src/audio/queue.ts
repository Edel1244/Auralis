/**
 * Pure, immutable playback-queue logic (unit tested in tests/queue.test.ts).
 * `items` keeps insertion order; `order` is the play order (identity or shuffled)
 * as indices into `items`; `position` points into `order`.
 */
export type RepeatMode = "off" | "all" | "one";

export type QueueState<T extends { id: string }> = {
  items: T[];
  order: number[];
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
};

export function emptyQueue<T extends { id: string }>(): QueueState<T> {
  return { items: [], order: [], position: -1, shuffle: false, repeat: "off" };
}

function shuffled(indices: number[], first: number | null, rand = Math.random) {
  const rest = indices.filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first === null ? rest : [first, ...rest];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function createQueue<T extends { id: string }>(
  items: T[],
  startIndex: number,
  prev: Pick<QueueState<T>, "shuffle" | "repeat"> = { shuffle: false, repeat: "off" },
  rand = Math.random,
): QueueState<T> {
  if (!items.length) return { ...emptyQueue<T>(), shuffle: prev.shuffle, repeat: prev.repeat };
  const start = Math.max(0, Math.min(startIndex, items.length - 1));
  const order = prev.shuffle ? shuffled(range(items.length), start, rand) : range(items.length);
  return { items, order, position: prev.shuffle ? 0 : start, shuffle: prev.shuffle, repeat: prev.repeat };
}

export function currentItem<T extends { id: string }>(q: QueueState<T>): T | null {
  const idx = q.order[q.position];
  return idx === undefined ? null : q.items[idx] ?? null;
}

/** Position that follows, or null when playback should stop. `auto` = track ended by itself. */
export function nextPosition<T extends { id: string }>(q: QueueState<T>, auto: boolean): number | null {
  if (!q.order.length) return null;
  if (auto && q.repeat === "one") return q.position;
  if (q.position + 1 < q.order.length) return q.position + 1;
  return q.repeat === "off" ? null : 0;
}

export function peekNext<T extends { id: string }>(q: QueueState<T>, auto = true): T | null {
  const p = nextPosition(q, auto);
  return p === null ? null : q.items[q.order[p]] ?? null;
}

export function goTo<T extends { id: string }>(q: QueueState<T>, position: number): QueueState<T> {
  if (position < 0 || position >= q.order.length) return q;
  return { ...q, position };
}

export function next<T extends { id: string }>(q: QueueState<T>, auto = false): QueueState<T> | null {
  const p = nextPosition(q, auto);
  return p === null ? null : { ...q, position: p };
}

export function previous<T extends { id: string }>(q: QueueState<T>): QueueState<T> {
  if (q.position > 0) return { ...q, position: q.position - 1 };
  if (q.repeat === "all" && q.order.length) return { ...q, position: q.order.length - 1 };
  return q;
}

export function setShuffle<T extends { id: string }>(q: QueueState<T>, on: boolean, rand = Math.random): QueueState<T> {
  if (on === q.shuffle) return q;
  const cur = q.order[q.position] ?? null;
  if (on) {
    // Keep history before the current item, shuffle what's upcoming.
    const played = q.order.slice(0, q.position);
    const upcoming = q.order.slice(q.position + 1);
    const order = cur === null ? shuffled(upcoming, null, rand) : [...played, cur, ...shuffled(upcoming, null, rand)];
    return { ...q, shuffle: true, order };
  }
  const order = range(q.items.length);
  return { ...q, shuffle: false, order, position: cur === null ? -1 : cur };
}

export function cycleRepeat<T extends { id: string }>(q: QueueState<T>): QueueState<T> {
  const nextMode: RepeatMode = q.repeat === "off" ? "all" : q.repeat === "all" ? "one" : "off";
  return { ...q, repeat: nextMode };
}

/** Appends to the end of the play order. */
export function enqueue<T extends { id: string }>(q: QueueState<T>, add: T[]): QueueState<T> {
  if (!add.length) return q;
  const base = q.items.length;
  const items = [...q.items, ...add];
  const order = [...q.order, ...add.map((_, i) => base + i)];
  return { ...q, items, order, position: q.position < 0 ? 0 : q.position };
}

/** Inserts right after the current item ("Play next"). */
export function enqueueNext<T extends { id: string }>(q: QueueState<T>, add: T[]): QueueState<T> {
  if (!add.length) return q;
  if (q.position < 0) return enqueue(q, add);
  const base = q.items.length;
  const items = [...q.items, ...add];
  const order = [...q.order];
  order.splice(q.position + 1, 0, ...add.map((_, i) => base + i));
  return { ...q, items, order };
}

/** Removes the entry at a play-order position (cannot remove the current one). */
export function removeAt<T extends { id: string }>(q: QueueState<T>, position: number): QueueState<T> {
  if (position === q.position || position < 0 || position >= q.order.length) return q;
  const order = q.order.filter((_, i) => i !== position);
  return { ...q, order, position: position < q.position ? q.position - 1 : q.position };
}

/** Moves an upcoming entry within the play order. */
export function move<T extends { id: string }>(q: QueueState<T>, from: number, to: number): QueueState<T> {
  if (from === to || from < 0 || to < 0 || from >= q.order.length || to >= q.order.length) return q;
  const order = [...q.order];
  const [x] = order.splice(from, 1);
  order.splice(to, 0, x);
  let position = q.position;
  if (from === q.position) position = to;
  else if (from < q.position && to >= q.position) position--;
  else if (from > q.position && to <= q.position) position++;
  return { ...q, order, position };
}

/** Clears everything after the current item. */
export function clearUpcoming<T extends { id: string }>(q: QueueState<T>): QueueState<T> {
  return { ...q, order: q.order.slice(0, q.position + 1) };
}

export function upcoming<T extends { id: string }>(q: QueueState<T>): { item: T; position: number }[] {
  return q.order.slice(q.position + 1).map((idx, i) => ({ item: q.items[idx], position: q.position + 1 + i }));
}
