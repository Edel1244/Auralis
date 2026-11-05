import { describe, expect, it } from "vitest";
import { buildProfile, diversify, rank, type Candidate } from "@/server/modules/recommendations/scoring";

const now = new Date("2026-11-01T00:00:00Z").getTime();
const c = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id, ownerId: "o-" + id, genreId: null, tags: [], mood: null, playCount: 0, likeCount: 0, createdAt: new Date(now - 86400000), ...over,
});

describe("recommendation scoring", () => {
  it("prefers the listener's favorite genre", () => {
    const profile = buildProfile([{ trackId: "x", ownerId: "a", genreId: "jazz", tags: [], weight: 3 }], []);
    const r = rank([c("rock", { genreId: "rock" }), c("jazz", { genreId: "jazz" })], profile, undefined, now);
    expect(r[0].id).toBe("jazz");
  });

  it("falls back to popularity for new listeners", () => {
    const r = rank([c("quiet"), c("hit", { playCount: 5000, likeCount: 200 })], buildProfile([], []), undefined, now);
    expect(r[0].id).toBe("hit");
  });

  it("demotes already-liked and heavily played tracks", () => {
    const profile = buildProfile(
      [
        { trackId: "a", ownerId: "o", genreId: "g", tags: [], weight: 1 },
        { trackId: "a", ownerId: "o", genreId: "g", tags: [], weight: 1 },
        { trackId: "a", ownerId: "o", genreId: "g", tags: [], weight: 1 },
      ],
      ["b"],
    );
    const r = rank([c("a", { genreId: "g", ownerId: "o" }), c("b", { genreId: "g", ownerId: "o" }), c("n", { genreId: "g", ownerId: "o" })], profile, undefined, now);
    expect(r[0].id).toBe("n");
  });

  it("diversifies artists", () => {
    const list = [{ ownerId: "a" }, { ownerId: "a" }, { ownerId: "a" }, { ownerId: "b" }];
    expect(diversify(list, 2).map((x) => x.ownerId)).toEqual(["a", "a", "b", "a"]);
  });
});
