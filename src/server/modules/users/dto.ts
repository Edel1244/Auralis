import "server-only";
import type { User } from "@prisma/client";

export const mediaUrl = (key: string | null | undefined) => (key ? `/api/v1/media/${key}` : null);

export type Privacy = { showListening: boolean; showStats: boolean; showFollowing: boolean };
export const DEFAULT_PRIVACY: Privacy = { showListening: true, showStats: true, showFollowing: true };

export function privacyOf(user: Pick<User, "privacy">): Privacy {
  return { ...DEFAULT_PRIVACY, ...((user.privacy as Partial<Privacy>) ?? {}) };
}

export function toPublicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: mediaUrl(u.avatarKey),
    bannerUrl: mediaUrl(u.bannerKey),
    isArtist: u.isArtist,
    isPrivate: u.isPrivate,
    role: u.role,
    createdAt: u.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

/** Minimal author reference embedded in tracks, playlists, comments. */
export function toUserRef(u: Pick<User, "id" | "username" | "displayName" | "avatarKey">) {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: mediaUrl(u.avatarKey) };
}

export function toMe(u: User) {
  return {
    ...toPublicUser(u),
    email: u.email,
    status: u.status,
    suspendedUntil: u.suspendedUntil,
    emailVerified: Boolean(u.emailVerifiedAt),
    locale: u.locale,
    privacy: privacyOf(u),
    storageUsedBytes: Number(u.storageUsedBytes),
    storageQuotaBytes: Number(u.storageQuotaBytes),
  };
}

export type Me = ReturnType<typeof toMe>;
