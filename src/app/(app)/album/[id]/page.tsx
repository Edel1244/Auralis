"use client";

import Link from "next/link";
import { use } from "react";
import { Play, Heart, Share2 } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { formatLength } from "@/lib/format";
import { PageState } from "@/components/ui/PageState";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CollectionHeader } from "@/components/music/CollectionHeader";
import { TrackList } from "@/components/music/TrackList";
import { usePlayer } from "@/player/PlayerProvider";
import { useSession } from "@/state/session";
import type { Album, Track } from "@/lib/types";

export default function AlbumPage({ params }: PageProps<"/album/[id]">) {
  const { id } = use(params);
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const player = usePlayer();
  const { user } = useSession();
  const { data, error, loading, reload, setData } = useApi<{ album: Album & { liked: boolean; canEdit: boolean }; tracks: Track[] }>(`/albums/${id}`);
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const a = data.album;
  const total = data.tracks.reduce((s, x) => s + x.durationMs, 0);
  return (
    <div className="space-y-6">
      <CollectionHeader kind={t("track.album")} title={a.title} cover={a.coverUrl} seed={a.id}>
        <Avatar src={a.owner.avatarUrl} name={a.owner.displayName} size={22} />
        <Link href={`/u/${a.owner.username}`} className="font-semibold text-fg hover:underline">
          {a.artistName}
        </Link>
        {a.releaseDate && <span>· {formatDate(a.releaseDate, { year: "numeric" })}</span>}
        <span>· {t("common.tracks", { count: data.tracks.length })}</span>
        {total > 0 && <span>· {formatLength(total)}</span>}
      </CollectionHeader>
      {a.description && <p className="max-w-3xl whitespace-pre-line text-sm text-muted">{a.description}</p>}
      <div className="flex items-center gap-2">
        <button
          disabled={!data.tracks.length}
          onClick={() => player.playTracks(data.tracks, 0, a.title)}
          aria-label={t("player.play")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_32px_-10px_var(--au-primary)] transition-transform hover:scale-105 disabled:opacity-40"
        >
          <Play size={24} fill="currentColor" className="translate-x-[1px]" />
        </button>
        {user && !a.canEdit && (
          <IconButton
            label={a.liked ? t("track.unlike") : t("track.like")}
            active={a.liked}
            size="lg"
            onClick={async () => {
              await api(`/albums/${a.id}/like`, { method: a.liked ? "DELETE" : "POST" });
              setData({ ...data, album: { ...a, liked: !a.liked } });
            }}
          >
            <Heart size={24} fill={a.liked ? "currentColor" : "none"} />
          </IconButton>
        )}
        <IconButton
          label={t("common.share")}
          onClick={async () => {
            await navigator.clipboard?.writeText(`${location.origin}/album/${a.id}`);
            toast(t("common.linkCopied"), "success");
          }}
        >
          <Share2 size={19} />
        </IconButton>
      </div>
      {data.tracks.length ? <TrackList tracks={data.tracks} source={a.title} showAlbum={false} showCover={false} /> : <EmptyState title={t("playlist.empty")} />}
    </div>
  );
}
