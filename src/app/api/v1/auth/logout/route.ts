import { route, json } from "@/server/http";
import { db } from "@/server/db";
import { clearSessionCookie, getAuth } from "@/server/auth/session";

export const POST = route(async (req) => {
  const auth = await getAuth(req);
  if (auth) await db.session.delete({ where: { id: auth.sessionId } }).catch(() => {});
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
