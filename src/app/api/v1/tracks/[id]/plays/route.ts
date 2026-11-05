import { z } from "zod";
import { route, json, readJson } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getViewableTrack } from "@/server/modules/tracks/queries";

type Ctx = RouteContext<"/api/v1/tracks/[id]/plays">;

/**
 * Records a listen in the user's history. A listen counts toward the public
 * play count when ≥ 30 s (or ≥ half of a short track) was actually heard;
 * repeated reports for the same track within 30 s are ignored (anti-inflation).
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`plays:${user.id}`, 400, 60 * 60 * 1000);
  const body = await readJson(
    req,
    z.object({
      msPlayed: z.number().int().min(0).max(6 * 3600 * 1000),
      completed: z.boolean().default(false),
      source: z.string().max(80).nullable().optional(),
    }),
  );
  const t = await getViewableTrack((await ctx.params).id, user);
  const recent = await db.playEvent.findFirst({
    where: { userId: user.id, trackId: t.id, playedAt: { gt: new Date(Date.now() - 30_000) } },
    select: { id: true },
  });
  if (recent) return json({ recorded: false });
  const msPlayed = Math.min(body.msPlayed, t.durationMs + 5000 || body.msPlayed);
  const counts = msPlayed >= Math.min(30_000, t.durationMs / 2);
  await db.playEvent.create({
    data: { userId: user.id, trackId: t.id, msPlayed, completed: body.completed, source: body.source ?? null },
  });
  if (counts && t.ownerId !== user.id) await db.track.update({ where: { id: t.id }, data: { playCount: { increment: 1 } } });
  return json({ recorded: true, counted: counts });
});
