import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { route, json, readQuery, pagination, paged } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { toPublicUser } from "@/server/modules/users/dto";

/** User directory for staff. Moderators can view (needed for suspensions); only admins can change roles/quotas. */
export const GET = route(async (req) => {
  await requireRole(req, "MODERATOR");
  const p = pagination(req, 30);
  const q = readQuery(
    req,
    z.object({
      q: z.string().trim().max(100).optional(),
      role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
      status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  );
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? { OR: [{ username: { contains: q.q, mode: "insensitive" } }, { displayName: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: { _count: { select: { tracks: true, followers: true } } },
    }),
    db.user.count({ where }),
  ]);
  return json(
    paged(
      rows.map((u) => ({
        ...toPublicUser(u),
        email: u.email,
        status: u.status,
        suspendedUntil: u.suspendedUntil,
        emailVerified: Boolean(u.emailVerifiedAt),
        strikeCount: u.strikeCount,
        storageUsedBytes: Number(u.storageUsedBytes),
        storageQuotaBytes: Number(u.storageQuotaBytes),
        trackCount: u._count.tracks,
        followerCount: u._count.followers,
      })),
      total,
      p,
    ),
  );
});
