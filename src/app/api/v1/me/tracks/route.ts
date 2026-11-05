import { route, json, pagination, paged } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { findTracks } from "@/server/modules/tracks/queries";
import type { Prisma } from "@prisma/client";

/** The signed-in user's uploads (all statuses), for upload management. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const p = pagination(req, 30);
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where: Prisma.TrackWhereInput = {
    ownerId: user.id,
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { artistName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    findTracks(where, user, { skip: p.skip, take: p.take }),
    db.track.count({ where }),
  ]);
  return json({
    ...paged(items, total, p),
    storage: { used: Number(user.storageUsedBytes), quota: Number(user.storageQuotaBytes) },
  });
});
