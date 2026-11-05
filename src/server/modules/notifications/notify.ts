import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../../db";
import { logger } from "../../logger";

export type NotificationType =
  | "follow"
  | "track_like"
  | "playlist_follow"
  | "playlist_invite"
  | "comment"
  | "upload_ready"
  | "upload_failed"
  | "content_removed"
  | "report_resolved"
  | "account_status";

/** Creates an in-app notification. Never throws: notifications are best-effort. */
export async function notify(userId: string, type: NotificationType, data: Prisma.InputJsonObject = {}) {
  try {
    await db.notification.create({ data: { userId, type, data } });
  } catch (e) {
    logger.warn("notify_failed", { type, error: String(e) });
  }
}
