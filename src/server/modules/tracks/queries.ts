import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "../../db";
import { notFound } from "../../http";
import { canViewTrack } from "./access";
import { toTrack, trackInclude, type TrackWithRelations } from "./dto";

type Viewer = Pick<User, "id" | "role"> | null | undefined;

export async function getViewableTrack(id: string, viewer: Viewer) {
  const t = await db.track.findUnique({ where: { id }, include: trackInclude });
  if (!t || !canViewTrack(t, viewer)) throw notFound("Track");
  return t;
}

/** Serializes tracks with the viewer's like state in one extra query. */
export async function serializeTracks(tracks: TrackWithRelations[], viewer: Viewer) {
  let liked = new Set<string>();
  if (viewer && tracks.length) {
    const likes = await db.trackLike.findMany({
      where: { userId: viewer.id, trackId: { in: tracks.map((t) => t.id) } },
      select: { trackId: true },
    });
    liked = new Set(likes.map((l) => l.trackId));
  }
  return tracks.map((t) =>
    toTrack(t, { liked: viewer ? liked.has(t.id) : undefined, includePrivate: viewer?.id === t.ownerId }),
  );
}

export async function findTracks(where: Prisma.TrackWhereInput, viewer: Viewer, opts: { orderBy?: Prisma.TrackOrderByWithRelationInput[]; skip?: number; take?: number } = {}) {
  const tracks = await db.track.findMany({
    where,
    include: trackInclude,
    orderBy: opts.orderBy ?? [{ createdAt: "desc" }],
    skip: opts.skip,
    take: opts.take ?? 20,
  });
  return serializeTracks(tracks, viewer);
}
