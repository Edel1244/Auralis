import "server-only";
import { db } from "../../db";
import { storage } from "../../storage";
import { logger } from "../../logger";

/** Deletes a user, cascading DB rows, then removes their stored objects. */
export async function deleteUserData(userId: string) {
  const [user, tracks, albums, playlists, assets] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true, bannerKey: true } }),
    db.track.findMany({ where: { ownerId: userId }, select: { audioKey: true, coverKey: true } }),
    db.album.findMany({ where: { ownerId: userId }, select: { coverKey: true } }),
    db.playlist.findMany({ where: { ownerId: userId }, select: { coverKey: true } }),
    db.trackAsset.findMany({ where: { track: { ownerId: userId } }, select: { key: true } }),
  ]);
  await db.user.delete({ where: { id: userId } });
  const keys = [
    user.avatarKey,
    user.bannerKey,
    ...tracks.flatMap((t) => [t.audioKey, t.coverKey]),
    ...albums.map((a) => a.coverKey),
    ...playlists.map((p) => p.coverKey),
    ...assets.map((a) => a.key),
  ].filter((k): k is string => Boolean(k));
  const s = storage();
  await Promise.all(keys.map((k) => s.delete(k).catch(() => {})));
  logger.info("user_deleted", { userId, objects: keys.length });
}
