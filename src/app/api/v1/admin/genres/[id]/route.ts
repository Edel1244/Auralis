import { route, json, readJson, notFound } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { logModeration } from "@/server/modules/moderation/audit";
import { genreSchema } from "@/server/modules/genres/schema";

type Ctx = RouteContext<"/api/v1/admin/genres/[id]">;

/** Edit or (de)activate a genre. Genres are deactivated rather than deleted so tracks keep their tag. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user } = await requireRole(req, "ADMIN");
  const id = (await ctx.params).id;
  if (!(await db.genre.findUnique({ where: { id } }))) throw notFound("Genre");
  const input = await readJson(req, genreSchema.partial());
  const g = await db.genre.update({ where: { id }, data: input });
  await logModeration(user.id, "genre.update", "GENRE", id, "", { ...input });
  return json({ genre: g });
});
