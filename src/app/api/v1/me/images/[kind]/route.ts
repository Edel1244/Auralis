import { route, json, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { deleteObjectQuietly, readImageFile, storeImage } from "@/server/media/images";
import { toMe } from "@/server/modules/users/dto";

type Ctx = RouteContext<"/api/v1/me/images/[kind]">;

function field(kind: string) {
  if (kind === "avatar") return "avatarKey" as const;
  if (kind === "banner") return "bannerKey" as const;
  throw new ApiError("NOT_FOUND", "Unknown image type");
}

/** POST multipart {file} → replaces the avatar or banner. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { kind } = await ctx.params;
  const f = field(kind);
  const { user } = await requireAuth(req);
  rateLimit(`image:${user.id}`, 30, 60 * 60 * 1000);
  const buf = await readImageFile((await req.formData()).get("file"));
  const key = await storeImage(buf, kind as "avatar" | "banner", user.id);
  const updated = await db.user.update({ where: { id: user.id }, data: { [f]: key } });
  await deleteObjectQuietly(user[f]);
  return json({ user: toMe(updated) });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { kind } = await ctx.params;
  const f = field(kind);
  const { user } = await requireAuth(req);
  const updated = await db.user.update({ where: { id: user.id }, data: { [f]: null } });
  await deleteObjectQuietly(user[f]);
  return json({ user: toMe(updated) });
});
