import { z } from "zod";
import { route, json, readQuery, pagination, paged } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { previewTargets } from "@/server/modules/moderation/targets";
import { toUserRef } from "@/server/modules/users/dto";

/** Copyright takedown claims queue. ?status= */
export const GET = route(async (req) => {
  await requireRole(req, "MODERATOR");
  const p = pagination(req, 30);
  const { status } = readQuery(
    req,
    z.object({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]).default("OPEN"), page: z.string().optional(), limit: z.string().optional() }),
  );
  const [rows, total] = await Promise.all([
    db.copyrightClaim.findMany({ where: { status }, include: { reviewer: true }, orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" }, skip: p.skip, take: p.take }),
    db.copyrightClaim.count({ where: { status } }),
  ]);
  const preview = await previewTargets(rows.map((r) => ({ targetType: "TRACK" as const, targetId: r.trackId })));
  return json(
    paged(
      rows.map((c) => ({
        id: c.id,
        status: c.status,
        claimantName: c.claimantName,
        claimantEmail: c.claimantEmail,
        workDescription: c.workDescription,
        evidenceUrl: c.evidenceUrl,
        resolution: c.resolution,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
        reviewer: c.reviewer ? toUserRef(c.reviewer) : null,
        track: preview("TRACK", c.trackId),
      })),
      total,
      p,
    ),
  );
});
