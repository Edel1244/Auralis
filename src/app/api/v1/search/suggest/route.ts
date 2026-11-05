import { z } from "zod";
import { route, json, readQuery, clientIp } from "@/server/http";
import { getAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { publicTrackWhere } from "@/server/modules/tracks/access";

/** Instant suggestions while typing (lightweight: titles/names only). */
export const GET = route(async (req) => {
  const viewer = (await getAuth(req))?.user;
  rateLimit(`suggest:${viewer?.id ?? clientIp(req)}`, 600, 60 * 1000);
  const { q } = readQuery(req, z.object({ q: z.string().trim().min(1).max(100) }));
  const ci = { contains: q, mode: "insensitive" as const };
  const [tracks, users, playlists] = await Promise.all([
    db.track.findMany({
      where: { ...publicTrackWhere, OR: [{ title: ci }, { artistName: ci }] },
      select: { id: true, title: true, artistName: true },
      orderBy: { playCount: "desc" },
      take: 5,
    }),
    db.user.findMany({
      where: { status: { not: "BANNED" }, OR: [{ displayName: ci }, { username: ci }] },
      select: { username: true, displayName: true },
      take: 3,
    }),
    db.playlist.findMany({ where: { visibility: "PUBLIC", title: ci }, select: { id: true, title: true }, take: 3 }),
  ]);
  return json({
    suggestions: [
      ...tracks.map((t) => ({ kind: "track" as const, id: t.id, label: t.title, sub: t.artistName })),
      ...users.map((u) => ({ kind: "user" as const, id: u.username, label: u.displayName, sub: `@${u.username}` })),
      ...playlists.map((p) => ({ kind: "playlist" as const, id: p.id, label: p.title, sub: "" })),
    ],
  });
});
