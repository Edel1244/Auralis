import { route, json, readJson, notFound, forbidden } from "@/server/http";
import { getAuth, hasRole, requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { themeInclude, themeInputSchema, toTheme } from "@/server/modules/themes/service";
import { logModeration } from "@/server/modules/moderation/audit";

type Ctx = RouteContext<"/api/v1/themes/[id]">;

async function load(id: string) {
  const t = await db.theme.findUnique({ where: { id }, include: themeInclude });
  if (!t) throw notFound("Theme");
  return t;
}

export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user;
  const t = await load((await ctx.params).id);
  if (!t.isPublic && t.authorId !== viewer?.id) throw notFound("Theme");
  return json({ theme: toTheme(t) });
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const t = await load((await ctx.params).id);
  if (t.authorId !== user.id) throw forbidden();
  const input = await readJson(req, themeInputSchema.partial());
  const u = await db.theme.update({ where: { id: t.id }, data: input, include: themeInclude });
  return json({ theme: toTheme(u) });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const t = await load((await ctx.params).id);
  const staff = hasRole(user, "MODERATOR");
  if (t.authorId !== user.id && !staff) throw forbidden();
  await db.theme.delete({ where: { id: t.id } });
  if (t.authorId !== user.id) await logModeration(user.id, "theme.delete", "THEME", t.id, "", { name: t.name });
  return json({ ok: true });
});
