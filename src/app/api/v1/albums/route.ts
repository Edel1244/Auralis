import { route, json, pagination, paged, ApiError } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { albumInclude, albumSchema, publicAlbumWhere, toAlbum } from "@/server/modules/albums/service";
import { storeImage } from "@/server/media/images";

/** Public albums, newest first. */
export const GET = route(async (req) => {
  await getAuth(req);
  const p = pagination(req, 20);
  const [rows, total] = await Promise.all([
    db.album.findMany({ where: publicAlbumWhere, include: albumInclude, orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], skip: p.skip, take: p.take }),
    db.album.count({ where: publicAlbumWhere }),
  ]);
  return json(paged(rows.map(toAlbum), total, p));
});

/** Creates an album. multipart: meta (JSON) + optional cover image. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`album-create:${user.id}`, 30, 60 * 60 * 1000);
  const form = await req.formData();
  let meta: unknown;
  try {
    meta = JSON.parse(String(form.get("meta") ?? "{}"));
  } catch {
    throw new ApiError("BAD_REQUEST", "meta must be JSON");
  }
  const input = albumSchema.parse(meta);
  const cover = form.get("cover");
  let coverKey: string | null = null;
  if (cover && typeof cover !== "string" && cover.size > 0) {
    if (cover.size > 8 * 1024 * 1024) throw new ApiError("PAYLOAD_TOO_LARGE", "Artwork must be 8 MB or smaller");
    coverKey = await storeImage(Buffer.from(await cover.arrayBuffer()), "cover", user.id);
  }
  const album = await db.album.create({
    data: { ...input, description: input.description ?? "", ownerId: user.id, coverKey },
    include: albumInclude,
  });
  return json({ album: toAlbum(album) }, { status: 201 });
});
