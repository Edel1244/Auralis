"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Heart, Pause, Play, Share2, Flag, Pencil } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { formatBytes, formatMs } from "@/lib/format";
import { PageState } from "@/components/ui/PageState";
import { Avatar, Badge } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CollectionHeader } from "@/components/music/CollectionHeader";
import { TrackMenu } from "@/components/music/TrackMenu";
import { ReportDialog } from "@/components/music/ReportDialog";
import { StaticWaveform } from "@/components/music/StaticWaveform";
import { Comments } from "@/components/music/Comments";
import { usePlayer } from "@/player/PlayerProvider";
import { useLibrary } from "@/state/library";
import { useSession } from "@/state/session";
import type { Track } from "@/lib/types";

const OWNERSHIP = {
  ORIGINAL: "upload.ownershipOriginal",
  LICENSED: "upload.ownershipLicensed",
  PUBLIC_DOMAIN: "upload.ownershipPublicDomain",
  CREATIVE_COMMONS: "upload.ownershipCC",
} as const;

export default function TrackPage({ params }: PageProps<"/track/[id]">) {
  const { id } = use(params);
  const t = useT();
  const { formatDate, formatNumber } = useI18n();
  const toast = useToast();
  const player = usePlayer();
  const { user } = useSession();
  const { isLiked, toggleLike } = useLibrary();
  const [report, setReport] = useState(false);
  const { data, error, loading, reload } = useApi<{ track: Track; canEdit: boolean }>(`/tracks/${id}`);
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const tr = data.track;
  const isCurrent = player.current?.id === tr.id;
  const playing = isCurrent && player.snapshot.status === "playing";

  return (
    <div className="space-y-8">
      <CollectionHeader kind={tr.album ? t("track.album") + " · " + tr.album.title : t("track.title")} title={tr.title} cover={tr.coverUrl} seed={tr.id}>
        <Avatar src={tr.owner.avatarUrl} name={tr.owner.displayName} size={22} />
        <Link href={`/u/${tr.owner.username}`} className="font-semibold text-fg hover:underline">
          {tr.artistName}
        </Link>
        <span>· {formatMs(tr.durationMs)}</span>
        <span>· {t("common.plays", { count: tr.playCount })}</span>
        <span>· {t("common.likes", { count: tr.likeCount })}</span>
        {tr.explicit && <Badge>E</Badge>}
        {tr.status !== "READY" && <Badge tone={tr.status === "PROCESSING" ? "warning" : "danger"}>{tr.status}</Badge>}
      </CollectionHeader>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => (isCurrent ? player.toggle() : player.playTracks([tr], 0, tr.title))}
          disabled={tr.status !== "READY"}
          aria-label={playing ? t("player.pause") : t("player.play")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_32px_-10px_var(--au-primary)] transition-transform hover:scale-105 disabled:opacity-40"
        >
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="translate-x-[1px]" />}
        </button>
        <IconButton label={isLiked(tr.id) ? t("track.unlike") : t("track.like")} active={isLiked(tr.id)} size="lg" onClick={() => void toggleLike(tr.id)}>
          <Heart size={24} fill={isLiked(tr.id) ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          label={t("common.share")}
          onClick={async () => {
            const url = `${location.origin}/track/${tr.id}`;
            if (navigator.share) await navigator.share({ title: tr.title, url }).catch(() => {});
            else {
              await navigator.clipboard?.writeText(url);
              toast(t("common.linkCopied"), "success");
            }
          }}
        >
          <Share2 size={20} />
        </IconButton>
        {data.canEdit && user?.id === tr.owner.id ? (
          <Link href={`/uploads?edit=${tr.id}`}>
            <Button variant="secondary" size="sm">
              <Pencil size={15} /> {t("common.edit")}
            </Button>
          </Link>
        ) : (
          user && (
            <IconButton label={t("common.report")} onClick={() => setReport(true)}>
              <Flag size={18} />
            </IconButton>
          )
        )}
        <TrackMenu track={tr} />
      </div>

      {tr.waveform && tr.waveform.length > 0 && <StaticWaveform track={tr} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {tr.description && <p className="whitespace-pre-line text-muted">{tr.description}</p>}
          {(tr.genre || tr.tags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {tr.genre && (
                <Link href={`/genre/${tr.genre.slug}`} className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: tr.genre.color }}>
                  {tr.genre.name}
                </Link>
              )}
              {tr.tags.map((tag) => (
                <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-fg">
                  #{tag}
                </Link>
              ))}
            </div>
          )}
          <Comments track={tr} />
        </div>
        <aside className="h-fit space-y-2 rounded-2xl border border-line bg-surface p-5 text-sm">
          {(
            [
              [t("track.duration"), formatMs(tr.durationMs)],
              ["BPM", tr.bpm ? String(tr.bpm) : "—"],
              [t("player.quality"), [tr.codec, tr.lossless ? "lossless" : null, tr.bitrate ? `${Math.round(tr.bitrate / 1000)} kbps` : null].filter(Boolean).join(" · ") || "—"],
              ["Sample rate", tr.sampleRate ? `${(tr.sampleRate / 1000).toFixed(1)} kHz` : "—"],
              ["Size", formatBytes(tr.sizeBytes)],
              [t("upload.releaseDate"), tr.releaseDate ? formatDate(tr.releaseDate) : "—"],
              [t("track.added"), formatDate(tr.createdAt)],
              [t("upload.ownership"), t(OWNERSHIP[tr.ownership])],
              ["Plays", formatNumber(tr.playCount)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <span className="text-subtle">{k}</span>
              <span className="text-right">{v}</span>
            </div>
          ))}
          {tr.licenseNote && <p className="pt-2 text-xs text-muted">{tr.licenseNote}</p>}
        </aside>
      </div>
      <ReportDialog open={report} onClose={() => setReport(false)} targetType="TRACK" targetId={tr.id} />
    </div>
  );
}
