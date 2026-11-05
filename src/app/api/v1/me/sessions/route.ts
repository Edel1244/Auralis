import { z } from "zod";
import { route, json, readJson } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";

export const GET = route(async (req) => {
  const { user, sessionId } = await requireAuth(req);
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
  });
  return json({ items: sessions.map((s) => ({ ...s, current: s.id === sessionId })) });
});

/** Revoke one session ({id}) or all other sessions ({all: true}). */
export const DELETE = route(async (req) => {
  const { user, sessionId } = await requireAuth(req);
  const input = await readJson(req, z.object({ id: z.string().optional(), all: z.boolean().optional() }));
  if (input.all) await db.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } });
  else if (input.id) await db.session.deleteMany({ where: { userId: user.id, id: input.id } });
  return json({ ok: true });
});
