import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { playlistSummaryInclude, toPlaylistSummaries } from "@/server/modules/playlists/service";

/** Playlists in the user's library: owned, collaborating, and followed. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const rows = await db.playlist.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { collaborators: { some: { userId: user.id } } },
        { followers: { some: { userId: user.id } }, visibility: { not: "PRIVATE" } },
      ],
    },
    include: playlistSummaryInclude,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return json({ items: await toPlaylistSummaries(rows, user) });
});
