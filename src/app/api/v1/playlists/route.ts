import { route, json, readJson, pagination, paged } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { playlistCreateSchema, playlistSummaryInclude, toPlaylistSummaries } from "@/server/modules/playlists/service";

/** Public playlists, most followed first (Featured / Explore). */
export const GET = route(async (req) => {
  const viewer = (await getAuth(req))?.user;
  const p = pagination(req, 20);
  const where = { visibility: "PUBLIC" as const, tracks: { some: {} }, owner: { status: { not: "BANNED" as const } } };
  const [rows, total] = await Promise.all([
    db.playlist.findMany({
      where,
      include: playlistSummaryInclude,
      orderBy: [{ followers: { _count: "desc" } }, { updatedAt: "desc" }],
      skip: p.skip,
      take: p.take,
    }),
    db.playlist.count({ where }),
  ]);
  return json(paged(await toPlaylistSummaries(rows, viewer), total, p));
});

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`playlist-create:${user.id}`, 60, 60 * 60 * 1000);
  const input = await readJson(req, playlistCreateSchema);
  const row = await db.playlist.create({
    data: { ownerId: user.id, title: input.title, description: input.description ?? "", visibility: input.visibility ?? "PRIVATE" },
    include: playlistSummaryInclude,
  });
  const [playlist] = await toPlaylistSummaries([row], user);
  return json({ playlist }, { status: 201 });
});
