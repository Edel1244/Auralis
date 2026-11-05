import "server-only";
import type { Prisma, Track, User } from "@prisma/client";
import { hasRole } from "../../auth/session";

type Viewer = Pick<User, "id" | "role"> | null | undefined;

/**
 * Who may see/stream a track:
 *  - owner and moderators: always (to manage it, including REMOVED/FAILED)
 *  - everyone else: READY tracks that are PUBLIC or UNLISTED (unlisted = link-only)
 */
export function canViewTrack(track: Pick<Track, "ownerId" | "visibility" | "status">, viewer: Viewer) {
  if (viewer && (viewer.id === track.ownerId || hasRole(viewer, "MODERATOR"))) return true;
  return track.status === "READY" && track.visibility !== "PRIVATE";
}

export function canEditTrack(track: Pick<Track, "ownerId">, viewer: Viewer) {
  return Boolean(viewer && (viewer.id === track.ownerId || hasRole(viewer, "MODERATOR")));
}

/** Prisma filter for tracks that may appear in public listings (search, feeds, profiles). */
export const publicTrackWhere: Prisma.TrackWhereInput = {
  status: "READY",
  visibility: "PUBLIC",
  owner: { status: { not: "BANNED" } },
};

/** Tracks a viewer can see in a list context (adds their own private tracks). */
export function listableTrackWhere(viewer: Viewer): Prisma.TrackWhereInput {
  if (!viewer) return { status: "READY", visibility: { not: "PRIVATE" } };
  return {
    OR: [
      { status: "READY", visibility: { not: "PRIVATE" } },
      { ownerId: viewer.id, status: { not: "REMOVED" } },
    ],
  };
}
