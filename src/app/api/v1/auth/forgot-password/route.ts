import { z } from "zod";
import { route, json, readJson, clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { emailSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/server/modules/auth/service";

export const POST = route(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60 * 1000);
  const { email } = await readJson(req, z.object({ email: emailSchema }));
  rateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000);
  await requestPasswordReset(email);
  return json({ ok: true });
});
