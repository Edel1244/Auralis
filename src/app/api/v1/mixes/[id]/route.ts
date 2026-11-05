import { route, json, readJson, notFound } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { mixSchema } from "@/server/modules/mixes/schema";

type Ctx = RouteContext<"/api/v1/mixes/[id]">;

async function own(id: string, userId: string) {
  const m = await db.mix.findUnique({ where: { id } });
  if (!m || m.ownerId !== userId) throw notFound("Mix");
  return m;
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const m = await own((await ctx.params).id, user.id);
  const input = await readJson(req, mixSchema.partial());
  const u = await db.mix.update({ where: { id: m.id }, data: input });
  return json({ mix: { id: u.id, title: u.title, updatedAt: u.updatedAt, data: u.data } });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const m = await own((await ctx.params).id, user.id);
  await db.mix.delete({ where: { id: m.id } });
  return json({ ok: true });
});
