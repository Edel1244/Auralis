import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../../db";

/** Appends to the immutable moderation audit log. */
export function logModeration(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  reason = "",
  metadata: Prisma.InputJsonObject = {},
) {
  return db.moderationAction.create({ data: { actorId, action, targetType, targetId, reason, metadata } });
}
