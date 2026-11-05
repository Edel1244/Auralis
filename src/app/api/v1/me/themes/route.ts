import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { themeInclude, toTheme } from "@/server/modules/themes/service";

/** Themes the user created and themes they installed. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const [own, installs] = await Promise.all([
    db.theme.findMany({ where: { authorId: user.id }, include: themeInclude, orderBy: { updatedAt: "desc" } }),
    db.themeInstall.findMany({
      where: { userId: user.id, theme: { OR: [{ isPublic: true }, { authorId: user.id }] } },
      include: { theme: { include: themeInclude } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return json({ own: own.map((t) => toTheme(t)), installed: installs.map((i) => toTheme(i.theme, true)) });
});
