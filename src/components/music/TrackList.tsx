"use client";

import Link from "next/link";
import { Heart, Play, Pause, GripVertical, Clock3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatMs } from "@/lib/format";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { usePlayer } from "@/player/PlayerProvider";
import { useLibrary } from "@/state/library";
import { Cover, Badge } from "@/components/ui/misc";
import type { Track } from "@/lib/types";
import { TrackMenu } from "./TrackMenu";

function PlayingBars() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="au-eq-bar w-[3px] rounded-full bg-primary" style={{ height: "100%", animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

export type TrackRowExtra = { addedAt?: string; key?: string };

/**
 * Accessible track table. Double-click / Enter plays from that row. Optional
 * drag-and-drop reordering (HTML5 DnD + keyboard Alt+↑/↓ fallback).
 */
export function TrackList({
  tracks,
  source,
  showAlbum = true,
  showCover = true,
  numbered = true,
  extras,
  onRemove,
  onReorder,
}: {
  tracks: Track[];
  source?: string;
  showAlbum?: boolean;
  showCover?: boolean;
  numbered?: boolean;
  extras?: TrackRowExtra[];
  onRemove?: (index: number) => void;
  onReorder?: (from: number, to: number) => void;
}) {
  const t = useT();
  const { formatDate } = useI18n();
  const player = usePlayer();
  const { isLiked, toggleLike } = useLibrary();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const playAt = (i: number) => {
    const tr = tracks[i];
    if (player.current?.id === tr.id) player.toggle();
    else player.playTracks(tracks, i, source);
  };

  return (
    <div role="table" aria-label={source} className="w-full">
      <div
        role="row"
        className="mb-1 hidden grid-cols-[32px_minmax(0,1fr)_minmax(0,0.7fr)_96px_72px] items-center gap-4 border-b border-line px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle md:grid"
      >
        <span role="columnheader">#</span>
        <span role="columnheader">{t("track.title")}</span>
        <span role="columnheader">{showAlbum ? t("track.album") : extras ? t("track.added") : ""}</span>
        <span role="columnheader" className="text-right">
          <Clock3 size={14} className="ml-auto" aria-label={t("track.duration")} />
        </span>
        <span role="columnheader" />
      </div>
      {tracks.map((tr, i) => {
        const isCurrent = player.current?.id === tr.id;
        const playing = isCurrent && player.snapshot.status === "playing";
        const unavailable = tr.status !== "READY";
        const extra = extras?.[i];
        return (
          <div
            role="row"
            key={extra?.key ?? `${tr.id}-${i}`}
            tabIndex={0}
            draggable={Boolean(onReorder)}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              setDragOver(i);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== i) onReorder?.(dragFrom, i);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDoubleClick={() => !unavailable && playAt(i)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" && !unavailable) playAt(i);
              if (onReorder && e.altKey && e.key === "ArrowUp" && i > 0) (e.preventDefault(), onReorder(i, i - 1));
              if (onReorder && e.altKey && e.key === "ArrowDown" && i < tracks.length - 1) (e.preventDefault(), onReorder(i, i + 1));
            }}
            className={cn(
              "group grid grid-cols-[32px_minmax(0,1fr)_72px] items-center gap-3 rounded-xl px-3 py-[calc(0.45rem*var(--density))] transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 md:grid-cols-[32px_minmax(0,1fr)_minmax(0,0.7fr)_96px_72px] md:gap-4",
              isCurrent && "bg-surface-2/50",
              unavailable && "opacity-50",
              dragOver === i && "ring-1 ring-primary",
            )}
          >
            <div role="cell" className="relative flex h-8 items-center justify-center text-sm tabular-nums text-subtle">
              {onReorder && <GripVertical size={14} className="absolute -left-3 hidden cursor-grab text-subtle group-hover:block" />}
              <span className={cn("group-hover:hidden", isCurrent && "text-primary")}>
                {playing ? <PlayingBars /> : numbered ? i + 1 : "•"}
              </span>
              <button
                className="hidden text-fg group-hover:block"
                disabled={unavailable}
                onClick={() => playAt(i)}
                aria-label={playing ? t("player.pause") : `${t("player.play")} ${tr.title}`}
              >
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
            </div>
            <div role="cell" className="flex min-w-0 items-center gap-3">
              {showCover && <Cover src={tr.coverUrl} seed={tr.id} className="w-10 shrink-0" rounded="rounded-md" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/track/${tr.id}`} className={cn("truncate text-sm font-medium hover:underline", isCurrent && "text-primary")}>
                    {tr.title}
                  </Link>
                  {tr.explicit && <Badge>E</Badge>}
                  {tr.visibility !== "PUBLIC" && <Badge>{tr.visibility === "PRIVATE" ? t("common.private") : t("common.unlisted")}</Badge>}
                  {tr.status === "PROCESSING" && <Badge tone="warning">{t("track.processing")}</Badge>}
                  {tr.status === "FAILED" && <Badge tone="danger">{t("track.failed")}</Badge>}
                  {tr.status === "REMOVED" && <Badge tone="danger">{t("track.removed")}</Badge>}
                </div>
                <Link href={`/u/${tr.owner.username}`} className="block truncate text-xs text-muted hover:text-fg hover:underline">
                  {tr.artistName}
                </Link>
              </div>
            </div>
            <div role="cell" className="hidden truncate text-sm text-muted md:block">
              {showAlbum && tr.album ? (
                <Link href={`/album/${tr.album.id}`} className="hover:text-fg hover:underline">
                  {tr.album.title}
                </Link>
              ) : extra?.addedAt ? (
                formatDate(extra.addedAt)
              ) : null}
            </div>
            <div role="cell" className="hidden items-center justify-end gap-3 text-sm tabular-nums text-subtle md:flex">
              <button
                onClick={() => void toggleLike(tr.id)}
                aria-label={isLiked(tr.id) ? t("track.unlike") : t("track.like")}
                className={cn(isLiked(tr.id) ? "text-primary" : "opacity-0 hover:text-fg group-hover:opacity-100 focus:opacity-100")}
              >
                <Heart size={16} fill={isLiked(tr.id) ? "currentColor" : "none"} />
              </button>
              {formatMs(tr.durationMs)}
            </div>
            <div role="cell" className="flex justify-end">
              <TrackMenu track={tr} onRemove={onRemove ? () => onRemove(i) : undefined} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
