import { route, json, forbidden } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getViewableTrack, serializeTracks } from "@/server/modules/tracks/queries";
import { deleteObjectQuietly, readImageFile, storeImage } from "@/server/media/images";
import { trackInclude } from "@/server/modules/tracks/dto";

type Ctx = RouteContext<"/api/v1/tracks/[id]/cover">;

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`image:${user.id}`, 60, 60 * 60 * 1000);
  const t = await getViewableTrack((await ctx.params).id, user);
  if (t.ownerId !== user.id) throw forbidden();
  const key = await storeImage(await readImageFile((await req.formData()).get("file")), "cover", user.id);
  const updated = await db.track.update({ where: { id: t.id }, data: { coverKey: key }, include: trackInclude });
  await deleteObjectQuietly(t.coverKey);
  const [track] = await serializeTracks([updated], user);
  return json({ track });
});
