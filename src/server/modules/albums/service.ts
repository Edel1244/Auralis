import "server-only";
import type { Prisma, User } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db";
import { notFound } from "../../http";
import { hasRole } from "../../auth/session";
import { mediaUrl, toUserRef } from "../users/dto";
import { toGenre } from "../tracks/dto";
import { visibilitySchema } from "@/lib/validation";

type Viewer = Pick<User, "id" | "role"> | null | undefined;

export const albumSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artistName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  genreId: z.string().max(40).nullable().optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  visibility: visibilitySchema.default("PUBLIC"),
});

export const albumInclude = {
  owner: { select: { id: true, username: true, displayName: true, avatarKey: true } },
  genre: true,
  _count: { select: { tracks: { where: { status: "READY" } } } },
} satisfies Prisma.AlbumInclude;

export type AlbumRow = Prisma.AlbumGetPayload<{ include: typeof albumInclude }>;

export function toAlbum(a: AlbumRow) {
  return {
    id: a.id,
    title: a.title,
    artistName: a.artistName,
    description: a.description,
    coverUrl: mediaUrl(a.coverKey),
    releaseDate: a.releaseDate,
    visibility: a.visibility,
    owner: toUserRef(a.owner),
    genre: toGenre(a.genre),
    trackCount: a._count.tracks,
    createdAt: a.createdAt,
  };
}

export function canViewAlbum(a: { ownerId: string; visibility: string }, viewer: Viewer) {
  if (a.visibility !== "PRIVATE") return true;
  return Boolean(viewer && (viewer.id === a.ownerId || hasRole(viewer, "MODERATOR")));
}

export async function getAlbumFor(id: string, viewer: Viewer) {
  const a = await db.album.findUnique({ where: { id }, include: albumInclude });
  if (!a || !canViewAlbum(a, viewer)) throw notFound("Album");
  return a;
}

export const publicAlbumWhere: Prisma.AlbumWhereInput = {
  visibility: "PUBLIC",
  tracks: { some: { status: "READY", visibility: "PUBLIC" } },
  owner: { status: { not: "BANNED" } },
};
