import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { albumInclude, toAlbum } from "@/server/modules/albums/service";

/** Albums the user created plus albums they saved. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const [own, liked] = await Promise.all([
    db.album.findMany({ where: { ownerId: user.id }, include: albumInclude, orderBy: { createdAt: "desc" }, take: 200 }),
    db.albumLike.findMany({
      where: { userId: user.id, album: { visibility: { not: "PRIVATE" } } },
      include: { album: { include: albumInclude } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return json({ own: own.map(toAlbum), saved: liked.map((l) => toAlbum(l.album)) });
});
