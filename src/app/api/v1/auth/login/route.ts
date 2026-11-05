import { route, json, readJson, clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/server/modules/auth/service";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { toMe } from "@/server/modules/users/dto";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const input = await readJson(req, loginSchema);
  rateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000);
  rateLimit(`login:id:${input.identifier}`, 10, 15 * 60 * 1000);
  const user = await authenticate(input);
  const { token, expiresAt } = await createSession(user.id, { userAgent: req.headers.get("user-agent"), ip });
  const res = json({ user: toMe(user) });
  setSessionCookie(res, token, expiresAt);
  return res;
});
