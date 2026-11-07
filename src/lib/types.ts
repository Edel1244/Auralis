/** Client-side shapes of API responses (mirrors server DTOs). */

export type Role = "USER" | "MODERATOR" | "ADMIN";
export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export type UserRef = { id: string; username: string; displayName: string; avatarUrl: string | null };

export type PublicUser = UserRef & {
  bio: string;
  bannerUrl: string | null;
  isArtist: boolean;
  isPrivate: boolean;
  role: Role;
  createdAt: string;
};

export type Privacy = { showListening: boolean; showStats: boolean; showFollowing: boolean };

export type Me = PublicUser & {
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  suspendedUntil: string | null;
  emailVerified: boolean;
  locale: string;
  privacy: Privacy;
  storageUsedBytes: number;
  storageQuotaBytes: number;
};

export type InstanceInfo = {
  /** "smtp" = real email is sent; "outbox" = messages only go to the server's development outbox. */
  emailDelivery: "smtp" | "outbox";
  /** Development mailbox page (/dev/mailbox) available. */
  devMailbox: boolean;
};

export type Preferences = {
  appearance: Record<string, unknown>;
  playback: Record<string, unknown>;
  equalizer: Record<string, unknown>;
  activeThemeId: string | null;
};

export type Genre = { id: string; slug: string; name: string; color: string };

export type Track = {
  id: string;
  title: string;
  artistName: string;
  description: string;
  durationMs: number;
  coverUrl: string | null;
  genre: Genre | null;
  tags: string[];
  mood: string | null;
  visibility: Visibility;
  status: "PROCESSING" | "READY" | "FAILED" | "REMOVED";
  statusReason: string | null;
  explicit: boolean;
  commentsEnabled: boolean;
  album: { id: string; title: string } | null;
  trackNumber: number | null;
  owner: UserRef;
  playCount: number;
  likeCount: number;
  liked?: boolean;
  bpm: number | null;
  loudnessDb: number | null;
  waveform: number[] | null;
  codec: string | null;
  lossless: boolean;
  bitrate: number | null;
  sampleRate: number | null;
  mimeType: string;
  sizeBytes: number;
  releaseDate: string | null;
  createdAt: string;
  ownership: "ORIGINAL" | "LICENSED" | "PUBLIC_DOMAIN" | "CREATIVE_COMMONS";
  licenseNote: string;
  streamUrl: string;
  qualities: string[];
};

export type Album = {
  id: string;
  title: string;
  artistName: string;
  description: string;
  coverUrl: string | null;
  releaseDate: string | null;
  visibility: Visibility;
  owner: UserRef;
  genre: Genre | null;
  trackCount: number;
  createdAt: string;
  tracks?: Track[];
};

export type Playlist = {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  background: string | null;
  visibility: Visibility;
  isCollaborative: boolean;
  kind: "MANUAL" | "SMART";
  owner: UserRef;
  trackCount: number;
  durationMs: number;
  followerCount: number;
  createdAt: string;
  updatedAt: string;
  coverMosaic: string[];
  canEdit?: boolean;
  isOwner?: boolean;
  following?: boolean;
};

export type Paged<T> = { items: T[]; page: number; limit: number; total: number; hasMore: boolean };
