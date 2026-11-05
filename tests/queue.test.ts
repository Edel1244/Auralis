import { describe, expect, it } from "vitest";
import {
  createQueue, currentItem, cycleRepeat, enqueue, enqueueNext, move, next, nextPosition, previous, removeAt, setShuffle, upcoming,
} from "@/audio/queue";

const t = (id: string) => ({ id });
const items = ["a", "b", "c", "d"].map(t);
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("queue", () => {
  it("starts at the requested index", () => {
    const q = createQueue(items, 2);
    expect(currentItem(q)?.id).toBe("c");
  });

  it("advances and stops at the end with repeat off", () => {
    let q = createQueue(items, 3);
    expect(next(q)).toBeNull();
    q = cycleRepeat(q); // all
    expect(currentItem(next(q)!)?.id).toBe("a");
  });

  it("repeat one replays only on auto-advance", () => {
    let q = createQueue(items, 1);
    q = cycleRepeat(cycleRepeat(q)); // one
    expect(q.repeat).toBe("one");
    expect(nextPosition(q, true)).toBe(1);
    expect(currentItem(next(q, false)!)?.id).toBe("c");
  });

  it("previous goes back, wraps only with repeat all", () => {
    const q = createQueue(items, 0);
    expect(previous(q).position).toBe(0);
    expect(currentItem(previous(cycleRepeat(q)))?.id).toBe("d");
  });

  it("shuffle keeps the current track and all items", () => {
    const q = setShuffle(createQueue(items, 1), true, rand);
    expect(currentItem(q)?.id).toBe("b");
    expect([...q.order].sort()).toEqual([0, 1, 2, 3]);
    const unshuffled = setShuffle(q, false);
    expect(currentItem(unshuffled)?.id).toBe("b");
    expect(unshuffled.order).toEqual([0, 1, 2, 3]);
  });

  it("createQueue with shuffle starts on the chosen track", () => {
    const q = createQueue(items, 3, { shuffle: true, repeat: "off" }, rand);
    expect(currentItem(q)?.id).toBe("d");
    expect(q.order.length).toBe(4);
  });

  it("play next inserts after current; enqueue appends", () => {
    let q = createQueue(items, 0);
    q = enqueueNext(q, [t("x")]);
    q = enqueue(q, [t("z")]);
    expect(upcoming(q).map((u) => u.item.id)).toEqual(["x", "b", "c", "d", "z"]);
  });

  it("remove and move keep the current pointer stable", () => {
    let q = createQueue(items, 1);
    q = removeAt(q, 0);
    expect(currentItem(q)?.id).toBe("b");
    expect(q.position).toBe(0);
    q = move(q, 2, 1); // d before c
    expect(upcoming(q).map((u) => u.item.id)).toEqual(["d", "c"]);
    expect(removeAt(q, q.position)).toBe(q); // cannot remove current
  });
});
