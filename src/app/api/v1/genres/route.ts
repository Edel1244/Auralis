import { route, json } from "@/server/http";
import { db } from "@/server/db";
import { publicTrackWhere } from "@/server/modules/tracks/access";
import { toGenre } from "@/server/modules/tracks/dto";

/** Active genres with their public track counts. */
export const GET = route(async () => {
  const genres = await db.genre.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { tracks: { where: publicTrackWhere } } } },
  });
  return json({ items: genres.map((g) => ({ ...toGenre(g)!, trackCount: g._count.tracks })) });
});
