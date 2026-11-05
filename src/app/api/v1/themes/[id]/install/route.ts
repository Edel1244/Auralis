import { route, json, notFound } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { themeInclude, toTheme } from "@/server/modules/themes/service";

type Ctx = RouteContext<"/api/v1/themes/[id]/install">;

/** Installs a public (or own) theme: counts the install and returns validated tokens to apply. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const t = await db.theme.findUnique({ where: { id: (await ctx.params).id }, include: themeInclude });
  if (!t || (!t.isPublic && t.authorId !== user.id)) throw notFound("Theme");
  const r = await db.themeInstall.createMany({ data: [{ userId: user.id, themeId: t.id }], skipDuplicates: true });
  const updated = r.count ? await db.theme.update({ where: { id: t.id }, data: { installs: { increment: 1 } }, include: themeInclude }) : t;
  await db.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, activeThemeId: t.id },
    update: { activeThemeId: t.id },
  });
  return json({ theme: toTheme(updated, true) });
});
