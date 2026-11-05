import { z } from "zod";
import { route, json, readJson, clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { verifyEmail } from "@/server/modules/auth/service";

export const POST = route(async (req) => {
  rateLimit(`verify:${clientIp(req)}`, 20, 15 * 60 * 1000);
  const { token } = await readJson(req, z.object({ token: z.string().min(10).max(200) }));
  await verifyEmail(token);
  return json({ ok: true });
});
