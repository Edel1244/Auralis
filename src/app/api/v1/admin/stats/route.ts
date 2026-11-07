import { route, json } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { jobStats } from "@/server/jobs/queue";
import { emailDeliveryMode } from "@/server/mail";

const DAY = 24 * 3600 * 1000;

/** Platform statistics for the admin overview (aggregates only; no personal data). */
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const since30 = new Date(Date.now() - 30 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);
  const [users, byStatus, byRole, tracks, trackStatus, storage, plays30, newUsers30, openReports, openClaims, playlists, uploadsDaily, playsDaily, signupsDaily, topUploaders] =
    await Promise.all([
      db.user.count(),
      db.user.groupBy({ by: ["status"], _count: true }),
      db.user.groupBy({ by: ["role"], _count: true }),
      db.track.count(),
      db.track.groupBy({ by: ["status"], _count: true }),
      db.user.aggregate({ _sum: { storageUsedBytes: true, storageQuotaBytes: true } }),
      db.playEvent.count({ where: { playedAt: { gte: since30 } } }),
      db.user.count({ where: { createdAt: { gte: since30 } } }),
      db.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      db.copyrightClaim.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      db.playlist.count(),
      db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n FROM "Track" WHERE "createdAt" >= ${since14} GROUP BY 1 ORDER BY 1`,
      db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "playedAt") AS day, COUNT(*) AS n FROM "PlayEvent" WHERE "playedAt" >= ${since14} GROUP BY 1 ORDER BY 1`,
      db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n FROM "User" WHERE "createdAt" >= ${since14} GROUP BY 1 ORDER BY 1`,
      db.user.findMany({ orderBy: { storageUsedBytes: "desc" }, take: 5, select: { id: true, username: true, displayName: true, storageUsedBytes: true, storageQuotaBytes: true } }),
    ]);

  // Fill missing days with zeros so charts have a continuous axis.
  const series = (rows: { day: Date; n: bigint }[]) => {
    const map = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.n)]));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10);
      return { day: d, value: map.get(d) ?? 0 };
    });
  };

  return json({
    users: { total: users, new30d: newUsers30, byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])), byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count])) },
    tracks: { total: tracks, byStatus: Object.fromEntries(trackStatus.map((s) => [s.status, s._count])) },
    playlists,
    plays30d: plays30,
    storage: { usedBytes: Number(storage._sum.storageUsedBytes ?? 0), allocatedBytes: Number(storage._sum.storageQuotaBytes ?? 0) },
    moderation: { openReports, openClaims },
    jobs: jobStats(),
    emailDelivery: emailDeliveryMode(),
    daily: { uploads: series(uploadsDaily), plays: series(playsDaily), signups: series(signupsDaily) },
    topStorage: topUploaders.map((u) => ({ ...u, storageUsedBytes: Number(u.storageUsedBytes), storageQuotaBytes: Number(u.storageQuotaBytes) })),
  });
});
