import "server-only";
import type { Album, Genre, Prisma, Track, TrackAsset, User } from "@prisma/client";
import { mediaUrl, toUserRef } from "../users/dto";

/** Prisma include used everywhere a track is returned to clients. */
export const trackInclude = {
  owner: { select: { id: true, username: true, displayName: true, avatarKey: true } },
  album: { select: { id: true, title: true, coverKey: true } },
  genre: true,
  assets: { select: { quality: true } },
} satisfies Prisma.TrackInclude;

export type TrackWithRelations = Track & {
  owner: Pick<User, "id" | "username" | "displayName" | "avatarKey">;
  album: Pick<Album, "id" | "title" | "coverKey"> | null;
  genre: Genre | null;
  assets: Pick<TrackAsset, "quality">[];
};

export function toGenre(g: Genre | null) {
  return g ? { id: g.id, slug: g.slug, name: g.name, color: g.color } : null;
}

export function toTrack(t: TrackWithRelations, opts: { liked?: boolean; includePrivate?: boolean } = {}) {
  return {
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    description: t.description,
    durationMs: t.durationMs,
    coverUrl: mediaUrl(t.coverKey ?? t.album?.coverKey),
    genre: toGenre(t.genre),
    tags: t.tags,
    mood: t.mood,
    visibility: t.visibility,
    status: t.status,
    statusReason: opts.includePrivate ? t.statusReason : null,
    explicit: t.explicit,
    commentsEnabled: t.commentsEnabled,
    album: t.album ? { id: t.album.id, title: t.album.title } : null,
    trackNumber: t.trackNumber,
    owner: toUserRef(t.owner),
    playCount: t.playCount,
    likeCount: t.likeCount,
    liked: opts.liked,
    bpm: t.bpm,
    loudnessDb: t.loudnessDb,
    waveform: (t.waveform as number[] | null) ?? null,
    codec: t.codec,
    lossless: t.lossless,
    bitrate: t.bitrate,
    sampleRate: t.sampleRate,
    mimeType: t.mimeType,
    sizeBytes: Number(t.sizeBytes),
    releaseDate: t.releaseDate,
    createdAt: t.createdAt,
    ownership: t.ownership,
    licenseNote: t.licenseNote,
    streamUrl: `/api/v1/tracks/${t.id}/stream`,
    qualities: ["original", ...t.assets.map((a) => a.quality).filter((q) => q !== "original")],
  };
}
