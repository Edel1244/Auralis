import { z } from "zod";
import { route, json, readJson, clientIp, notFound } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { emailSchema } from "@/lib/validation";

const schema = z.object({
  trackId: z.string().min(1).max(40),
  claimantName: z.string().trim().min(2).max(200),
  claimantEmail: emailSchema,
  workDescription: z.string().trim().min(10).max(4000),
  evidenceUrl: z.string().trim().url().max(500).optional().or(z.literal("").transform(() => undefined)),
  goodFaith: z.literal(true, { error: "You must confirm the good-faith statement" }),
});

/**
 * Formal copyright takedown notice. Open to anyone (rights holders may not have
 * an account); rate limited per IP. Moderators review it in the claims queue.
 */
export const POST = route(async (req) => {
  rateLimit(`claim:${clientIp(req)}`, 10, 24 * 60 * 60 * 1000);
  const input = await readJson(req, schema);
  const track = await db.track.findUnique({ where: { id: input.trackId }, select: { id: true } });
  if (!track) throw notFound("Track");
  const claim = await db.copyrightClaim.create({ data: input });
  return json({ claim: { id: claim.id } }, { status: 201 });
});
