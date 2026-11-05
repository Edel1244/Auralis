import { route, json, pagination, paged } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { toUserRef } from "@/server/modules/users/dto";

/** Read-only audit trail of every privileged action. ?action=prefix&targetId= */
export const GET = route(async (req) => {
  await requireRole(req, "MODERATOR");
  const p = pagination(req, 50);
  const action = req.nextUrl.searchParams.get("action")?.slice(0, 40);
  const targetId = req.nextUrl.searchParams.get("targetId")?.slice(0, 40);
  const where = { ...(action ? { action: { startsWith: action } } : {}), ...(targetId ? { targetId } : {}) };
  const [rows, total] = await Promise.all([
    db.moderationAction.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
    db.moderationAction.count({ where }),
  ]);
  return json(
    paged(
      rows.map((r) => ({ id: r.id, action: r.action, targetType: r.targetType, targetId: r.targetId, reason: r.reason, metadata: r.metadata, createdAt: r.createdAt, actor: toUserRef(r.actor) })),
      total,
      p,
    ),
  );
});
