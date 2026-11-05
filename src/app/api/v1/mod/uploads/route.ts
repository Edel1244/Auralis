import { z } from "zod";
import { route, json, readQuery, pagination, paged } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { findTracks } from "@/server/modules/tracks/queries";

/** Upload review queue: recent public uploads, or by status. */
export const GET = route(async (req) => {
  const { user } = await requireRole(req, "MODERATOR");
  const p = pagination(req, 30);
  const { status } = readQuery(
    req,
    z.object({ status: z.enum(["recent", "PROCESSING", "FAILED", "REMOVED"]).default("recent"), page: z.string().optional(), limit: z.string().optional() }),
  );
  const where = status === "recent" ? { status: "READY" as const } : { status };
  const [items, total] = await Promise.all([findTracks(where, user, { skip: p.skip, take: p.take }), db.track.count({ where })]);
  return json(paged(items, total, p));
});
