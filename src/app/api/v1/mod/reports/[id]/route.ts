import { z } from "zod";
import { route, json, readJson, notFound, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { removeTarget } from "@/server/modules/moderation/service";
import { logModeration } from "@/server/modules/moderation/audit";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/mod/reports/[id]">;

const schema = z.object({
  action: z.enum(["review", "dismiss", "remove"]),
  note: z.string().trim().max(1000).default(""),
  /** Count a copyright strike against the uploader (track removals only). */
  strike: z.boolean().default(false),
});

/**
 * Decides a report. "remove" applies the takedown to the target and resolves
 * every other open report on the same target; all actions are audited.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireRole(req, "MODERATOR");
  const r = await db.report.findUnique({ where: { id: (await ctx.params).id } });
  if (!r) throw notFound("Report");
  const input = await readJson(req, schema);
  if (r.status === "RESOLVED" || r.status === "DISMISSED") throw new ApiError("CONFLICT", "This report was already decided");

  if (input.action === "review") {
    await db.report.update({ where: { id: r.id }, data: { status: "REVIEWING", handledById: user.id } });
    return json({ ok: true });
  }
  if (input.action === "dismiss") {
    await db.report.update({ where: { id: r.id }, data: { status: "DISMISSED", handledById: user.id, resolution: input.note || "Dismissed", resolvedAt: new Date() } });
    await logModeration(user.id, "report.dismiss", r.targetType, r.targetId, input.note, { reportId: r.id });
  } else {
    await removeTarget(user, r.targetType, r.targetId, input.note || `Report: ${r.reason}`, input.strike && r.targetType === "TRACK");
    const decided = await db.report.findMany({
      where: { targetType: r.targetType, targetId: r.targetId, status: { in: ["OPEN", "REVIEWING"] } },
      select: { id: true, reporterId: true },
    });
    await db.report.updateMany({
      where: { id: { in: decided.map((d) => d.id) } },
      data: { status: "RESOLVED", handledById: user.id, resolution: input.note || "Content removed", resolvedAt: new Date() },
    });
    await logModeration(user.id, "report.resolve", r.targetType, r.targetId, input.note, { reports: decided.length });
    // Let reporters know their report led to action (no details about the decision are shared).
    for (const d of decided) if (d.reporterId) await notify(d.reporterId, "report_resolved", {});
  }
  if (r.reporterId && input.action === "dismiss") await notify(r.reporterId, "report_resolved", {});
  return json({ ok: true });
});
