import { route, json, readJson, pagination, paged, ApiError } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { themeInclude, themeInputSchema, toTheme } from "@/server/modules/themes/service";
import type { Prisma } from "@prisma/client";

/** Community theme gallery: ?sort=popular|new&q= */
export const GET = route(async (req) => {
  const viewer = (await getAuth(req))?.user;
  const p = pagination(req, 24);
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 60);
  const sort = req.nextUrl.searchParams.get("sort") === "new" ? "new" : "popular";
  const where: Prisma.ThemeWhereInput = {
    isPublic: true,
    author: { status: { not: "BANNED" } },
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  const [rows, total, mine] = await Promise.all([
    db.theme.findMany({
      where,
      include: themeInclude,
      orderBy: sort === "new" ? [{ createdAt: "desc" }] : [{ installs: "desc" }, { createdAt: "desc" }],
      skip: p.skip,
      take: p.take,
    }),
    db.theme.count({ where }),
    viewer ? db.themeInstall.findMany({ where: { userId: viewer.id }, select: { themeId: true } }) : Promise.resolve([]),
  ]);
  const installed = new Set(mine.map((m) => m.themeId));
  return json(paged(rows.map((r) => toTheme(r, viewer ? installed.has(r.id) : undefined)), total, p));
});

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`theme:${user.id}`, 30, 60 * 60 * 1000);
  const input = await readJson(req, themeInputSchema);
  if ((await db.theme.count({ where: { authorId: user.id } })) >= 100) throw new ApiError("BAD_REQUEST", "Theme limit reached (100)");
  const t = await db.theme.create({ data: { ...input, authorId: user.id }, include: themeInclude });
  return json({ theme: toTheme(t) }, { status: 201 });
});
