import { z } from "zod";
import { route, json, readJson, clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { passwordSchema } from "@/lib/validation";
import { resetPassword } from "@/server/modules/auth/service";

export const POST = route(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const { token, password } = await readJson(req, z.object({ token: z.string().min(10).max(200), password: passwordSchema }));
  await resetPassword(token, password);
  return json({ ok: true });
});
