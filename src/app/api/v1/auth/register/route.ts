import { route, json, readJson, clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { registerSchema } from "@/lib/validation";
import { registerUser } from "@/server/modules/auth/service";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { toMe } from "@/server/modules/users/dto";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  const input = await readJson(req, registerSchema);
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const user = await registerUser(input, isLocale(cookieLocale) ? cookieLocale : "en");
  const { token, expiresAt } = await createSession(user.id, { userAgent: req.headers.get("user-agent"), ip });
  const res = json({ user: toMe(user) }, { status: 201 });
  setSessionCookie(res, token, expiresAt);
  return res;
});
