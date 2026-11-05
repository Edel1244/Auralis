import { route, json, notFound, pagination, paged } from "@/server/http";
import { getAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { publicTrackWhere } from "@/server/modules/tracks/access";
import { findTracks } from "@/server/modules/tracks/queries";
import { toGenre } from "@/server/modules/tracks/dto";

type Ctx = RouteContext<"/api/v1/genres/[slug]">;

/** Genre collection: ?sort=popular|new */
export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user;
  const genre = await db.genre.findUnique({ where: { slug: (await ctx.params).slug } });
  if (!genre || !genre.active) throw notFound("Genre");
  const p = pagination(req, 30);
  const sort = req.nextUrl.searchParams.get("sort") === "new" ? "new" : "popular";
  const where = { ...publicTrackWhere, genreId: genre.id };
  const [items, total] = await Promise.all([
    findTracks(where, viewer, {
      orderBy: sort === "new" ? [{ createdAt: "desc" }] : [{ playCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
      skip: p.skip,
      take: p.take,
    }),
    db.track.count({ where }),
  ]);
  return json({ genre: toGenre(genre), ...paged(items, total, p) });
});
