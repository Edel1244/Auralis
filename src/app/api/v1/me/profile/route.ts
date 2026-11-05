import { route, json, readJson, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { profileSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { toMe } from "@/server/modules/users/dto";

export const PATCH = route(async (req) => {
  const { user } = await requireAuth(req);
  const input = await readJson(req, profileSchema);
  if (input.username && input.username !== user.username) {
    const taken = await db.user.findUnique({ where: { username: input.username }, select: { id: true } });
    if (taken) throw new ApiError("CONFLICT", "That username is taken", { field: "username" });
  }
  const updated = await db.user.update({ where: { id: user.id }, data: input });
  return json({ user: toMe(updated) });
});
