import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getPlaylistFor, playlistSummaryInclude, toPlaylistSummaries } from "@/server/modules/playlists/service";
import { canViewTrack } from "@/server/modules/tracks/access";

type Ctx = RouteContext<"/api/v1/playlists/[id]/duplicate">;

/** Copies a viewable playlist into a new private playlist owned by the caller. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`playlist-create:${user.id}`, 60, 60 * 60 * 1000);
  const src = await getPlaylistFor((await ctx.params).id, user);
  const entries = await db.playlistTrack.findMany({
    where: { playlistId: src.id },
    orderBy: { position: "asc" },
    include: { track: { select: { id: true, ownerId: true, visibility: true, status: true } } },
  });
  const tracks = entries.filter((e) => canViewTrack(e.track, user));
  const row = await db.playlist.create({
    data: {
      ownerId: user.id,
      title: `${src.title} (copy)`.slice(0, 100),
      description: src.description,
      background: src.background,
      visibility: "PRIVATE",
      tracks: { create: tracks.map((e, i) => ({ trackId: e.trackId, position: i, addedById: user.id })) },
    },
    include: playlistSummaryInclude,
  });
  const [playlist] = await toPlaylistSummaries([row], user);
  return json({ playlist }, { status: 201 });
});
