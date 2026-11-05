import { z } from "zod";
import { route, json, readQuery, pagination, paged } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { previewTargets } from "@/server/modules/moderation/targets";
import { toUserRef } from "@/server/modules/users/dto";

/** Moderation queue. ?status=OPEN|REVIEWING|RESOLVED|DISMISSED&reason= */
export const GET = route(async (req) => {
  await requireRole(req, "MODERATOR");
  const p = pagination(req, 30);
  const q = readQuery(
    req,
    z.object({
      status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]).default("OPEN"),
      reason: z.enum(["COPYRIGHT", "SPAM", "ABUSE", "EXPLICIT_UNLABELED", "IMPERSONATION", "OTHER"]).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  );
  const where = { status: q.status, ...(q.reason ? { reason: q.reason } : {}) };
  const [rows, total] = await Promise.all([
    db.report.findMany({
      where,
      include: { reporter: true, handledBy: true },
      orderBy: { createdAt: q.status === "OPEN" ? "asc" : "desc" },
      skip: p.skip,
      take: p.take,
    }),
    db.report.count({ where }),
  ]);
  const preview = await previewTargets(rows);
  // How many reports each target has in total (signals pile-ons / repeated issues).
  const counts = await db.report.groupBy({
    by: ["targetType", "targetId"],
    where: { OR: rows.map((r) => ({ targetType: r.targetType, targetId: r.targetId })) },
    _count: true,
  });
  const countOf = (t: string, id: string) => counts.find((c) => c.targetType === t && c.targetId === id)?._count ?? 1;
  return json(
    paged(
      rows.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        resolution: r.resolution,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        reporter: r.reporter ? toUserRef(r.reporter) : null,
        handledBy: r.handledBy ? toUserRef(r.handledBy) : null,
        target: preview(r.targetType, r.targetId),
        reportCount: countOf(r.targetType, r.targetId),
      })),
      total,
      p,
    ),
  );
});
