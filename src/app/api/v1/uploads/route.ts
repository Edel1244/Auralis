import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { handleUpload } from "@/server/modules/tracks/service";
import { trackInclude } from "@/server/modules/tracks/dto";
import { serializeTracks } from "@/server/modules/tracks/queries";
import { db } from "@/server/db";

/**
 * POST multipart/form-data:
 *   audio   – the audio file (required)
 *   artwork – cover image (optional)
 *   meta    – JSON (see trackMetaSchema)
 */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`upload:${user.id}`, 120, 60 * 60 * 1000);
  const created = await handleUpload(req, user);
  const track = await db.track.findUniqueOrThrow({ where: { id: created.id }, include: trackInclude });
  const [dto] = await serializeTracks([track], user);
  return json({ track: dto }, { status: 201 });
});
