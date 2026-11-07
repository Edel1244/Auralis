"use client";

import Link from "next/link";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Cover } from "@/components/ui/misc";
import { VisibilityBadge } from "./VisibilityBadge";
import { usePlayer } from "@/player/PlayerProvider";
import { useT } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import type { Album, Playlist, PublicUser, Track } from "@/lib/types";

/** Floating play button revealed on card hover/focus. */
function HoverPlay({ onPlay, playing, label }: { onPlay: () => void; playing: boolean; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPlay();
      }}
      aria-label={label}
      className={cn(
        "absolute bottom-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_30px_-8px_var(--au-primary)] transition-all duration-200",
        playing ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
      )}
    >
      {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-[1px]" />}
    </button>
  );
}

const cardBase =
  "group relative block rounded-[var(--radius-card)] p-3 transition-colors duration-200 hover:bg-surface-2/80 focus-within:bg-surface-2/80";

export function TrackCard({ track, list, index, source }: { track: Track; list: Track[]; index: number; source?: string }) {
  const p = usePlayer();
  const t = useT();
  const isCurrent = p.current?.id === track.id;
  const playing = isCurrent && p.snapshot.status === "playing";
  return (
    <div className={cardBase}>
      <div className="relative mb-3">
        <Cover src={track.coverUrl} seed={track.id} className="w-full shadow-lg" />
        <VisibilityBadge visibility={track.visibility} className="absolute left-2 top-2 z-10" />
        <HoverPlay playing={playing} label={`${t("player.play")} ${track.title}`} onPlay={() => (isCurrent ? p.toggle() : p.playTracks(list, index, source))} />
      </div>
      <Link href={`/track/${track.id}`} className="block truncate text-sm font-semibold after:absolute after:inset-0">
        {track.title}
      </Link>
      <div className="truncate text-xs text-muted">{track.artistName}</div>
    </div>
  );
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const p = usePlayer();
  const t = useT();
  return (
    <div className={cardBase}>
      <div className="relative mb-3">
        <Cover src={playlist.coverUrl} mosaic={playlist.coverMosaic} seed={playlist.id} className="w-full shadow-lg" />
        <VisibilityBadge visibility={playlist.visibility} className="absolute left-2 top-2 z-10" />
        {playlist.trackCount > 0 && (
          <HoverPlay
            playing={false}
            label={`${t("player.play")} ${playlist.title}`}
            onPlay={async () => {
              const r = await api<{ entries: { track: Track }[] }>(`/playlists/${playlist.id}`);
              p.playTracks(r.entries.map((e) => e.track), 0, playlist.title);
            }}
          />
        )}
      </div>
      <Link href={`/playlist/${playlist.id}`} className="block truncate text-sm font-semibold after:absolute after:inset-0">
        {playlist.title}
      </Link>
      <div className="truncate text-xs text-muted">
        {t("common.by", { name: playlist.owner.displayName })} · {t("common.tracks", { count: playlist.trackCount })}
      </div>
    </div>
  );
}

export function AlbumCard({ album }: { album: Album }) {
  const p = usePlayer();
  const t = useT();
  return (
    <div className={cardBase}>
      <div className="relative mb-3">
        <Cover src={album.coverUrl} seed={album.id} className="w-full shadow-lg" />
        <VisibilityBadge visibility={album.visibility} className="absolute left-2 top-2 z-10" />
        <HoverPlay
          playing={false}
          label={`${t("player.play")} ${album.title}`}
          onPlay={async () => {
            const r = await api<{ tracks: Track[] }>(`/albums/${album.id}`);
            p.playTracks(r.tracks, 0, album.title);
          }}
        />
      </div>
      <Link href={`/album/${album.id}`} className="block truncate text-sm font-semibold after:absolute after:inset-0">
        {album.title}
      </Link>
      <div className="truncate text-xs text-muted">{album.artistName}</div>
    </div>
  );
}

export function ArtistCard({ user, sub }: { user: PublicUser; sub?: string }) {
  return (
    <Link href={`/u/${user.username}`} className={cn(cardBase, "text-center")}>
      <Avatar src={user.avatarUrl} name={user.displayName} size={140} className="mx-auto mb-3 aspect-square h-auto w-full max-w-[160px] shadow-lg" />
      <div className="truncate text-sm font-semibold">{user.displayName}</div>
      <div className="truncate text-xs text-muted">{sub ?? `@${user.username}`}</div>
    </Link>
  );
}

/**
 * Horizontal shelf of cards. Cards keep a fixed width (never stretch to fill
 * the row, so one or two items don't turn into giant tiles) and the row
 * scrolls sideways when there are more than fit.
 */
export function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-3 grid snap-x auto-cols-[clamp(140px,40vw,196px)] grid-flow-col justify-start gap-1 overflow-x-auto overscroll-x-contain pb-2 [&>*]:snap-start">
      {children}
    </div>
  );
}

/**
 * Wrapping card grid sized by the space it actually has (not the screen width,
 * which ignores the sidebar and window size): as many ~160 px columns as fit.
 * auto-fill keeps empty tracks, so a few items never stretch.
 */
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">{children}</div>;
}
