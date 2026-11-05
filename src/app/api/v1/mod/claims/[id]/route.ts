import { z } from "zod";
import { route, json, readJson, notFound, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { removeTrack } from "@/server/modules/moderation/service";
import { logModeration } from "@/server/modules/moderation/audit";

type Ctx = RouteContext<"/api/v1/mod/claims/[id]">;

/** uphold = take the track down + copyright strike (repeat-infringer policy); reject = keep it up. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireRole(req, "MODERATOR");
  const c = await db.copyrightClaim.findUnique({ where: { id: (await ctx.params).id } });
  if (!c) throw notFound("Claim");
  if (c.status === "RESOLVED" || c.status === "DISMISSED") throw new ApiError("CONFLICT", "This claim was already decided");
  const { action, note } = await readJson(req, z.object({ action: z.enum(["uphold", "reject"]), note: z.string().trim().max(1000).default("") }));
  if (action === "uphold") {
    await removeTrack(user, c.trackId, note || `Copyright takedown requested by ${c.claimantName}`, { strike: true });
  }
  await db.copyrightClaim.update({
    where: { id: c.id },
    data: { status: action === "uphold" ? "RESOLVED" : "DISMISSED", reviewerId: user.id, resolution: note || action, resolvedAt: new Date() },
  });
  await logModeration(user.id, `claim.${action}`, "TRACK", c.trackId, note, { claimId: c.id, claimant: c.claimantName });
  return json({ ok: true });
});
