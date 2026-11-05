import { describe, expect, it } from "vitest";
import { assertCanModerateUser, STRIKE_LIMIT } from "@/server/modules/moderation/service";

const u = (id: string, role: "USER" | "MODERATOR" | "ADMIN") => ({ id, role });

describe("moderation rank rules", () => {
  it("moderators can act on regular users", () => {
    expect(() => assertCanModerateUser(u("m", "MODERATOR"), u("x", "USER"))).not.toThrow();
  });
  it("nobody can act on themselves or on equal/higher rank", () => {
    expect(() => assertCanModerateUser(u("m", "MODERATOR"), u("m", "MODERATOR"))).toThrow();
    expect(() => assertCanModerateUser(u("m", "MODERATOR"), u("m2", "MODERATOR"))).toThrow();
    expect(() => assertCanModerateUser(u("m", "MODERATOR"), u("a", "ADMIN"))).toThrow();
    expect(() => assertCanModerateUser(u("a", "ADMIN"), u("a2", "ADMIN"))).toThrow();
  });
  it("admins can act on moderators", () => {
    expect(() => assertCanModerateUser(u("a", "ADMIN"), u("m", "MODERATOR"))).not.toThrow();
  });
  it("repeat-infringer threshold is 3 strikes", () => {
    expect(STRIKE_LIMIT).toBe(3);
  });
});
