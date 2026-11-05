"use client";

import Link from "next/link";
import { Heart, ListMusic, Maximize2, SlidersHorizontal, Play, Pause } from "lucide-react";
import { cn } from "@/lib/cn";
import { Cover } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { useLibrary } from "@/state/library";
import { usePlaybackTime, usePlayer } from "./PlayerProvider";
import { TransportControls, VolumeControl } from "./Controls";
import { SeekBar } from "./SeekBar";

function MobileProgress() {
  const { snapshot } = usePlayer();
  const time = usePlaybackTime();
  const pct = snapshot.duration ? (time / snapshot.duration) * 100 : 0;
  return (
    <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-fg/10">
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PlayerBar() {
  const p = usePlayer();
  const t = useT();
  const { isLiked, toggleLike } = useLibrary();
  const track = p.current;
  const playing = p.snapshot.status === "playing";

  return (
    <>
      {/* Mobile mini-player */}
      <div className="fixed inset-x-2 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 md:hidden">
        {track && (
          <div
            className="player-surface relative flex items-center gap-3 rounded-2xl border border-line px-2.5 py-2 shadow-2xl"
            onClick={() => p.setExpanded(true)}
          >
            <Cover src={track.coverUrl} seed={track.id} className="w-10 shrink-0" rounded="rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{track.title}</div>
              <div className="truncate text-xs text-muted">{track.artistName}</div>
            </div>
            <IconButton
              label={isLiked(track.id) ? t("track.unlike") : t("track.like")}
              active={isLiked(track.id)}
              onClick={(e) => {
                e.stopPropagation();
                void toggleLike(track.id);
              }}
              size="sm"
            >
              <Heart size={18} fill={isLiked(track.id) ? "currentColor" : "none"} />
            </IconButton>
            <IconButton
              label={playing ? t("player.pause") : t("player.play")}
              onClick={(e) => {
                e.stopPropagation();
                p.toggle();
              }}
              size="sm"
              className="text-fg"
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </IconButton>
            <MobileProgress />
          </div>
        )}
      </div>

      {/* Desktop player bar */}
      <footer
        className="player-surface hidden h-[var(--player-height)] shrink-0 items-center gap-4 border-t border-line px-4 md:flex"
        aria-label={t("player.nowPlaying")}
      >
        <div className="flex w-[30%] min-w-0 items-center gap-3">
          {track ? (
            <>
              <button onClick={() => p.setExpanded(true)} aria-label={t("player.expand")} className="group relative shrink-0">
                <Cover src={track.coverUrl} seed={track.id} className="w-14 shadow-lg" rounded="rounded-lg" />
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 size={16} />
                </span>
              </button>
              <div className="min-w-0">
                <Link href={`/track/${track.id}`} className="block truncate text-sm font-semibold hover:underline">
                  {track.title}
                </Link>
                <Link href={`/u/${track.owner.username}`} className="block truncate text-xs text-muted hover:text-fg hover:underline">
                  {track.artistName}
                </Link>
              </div>
              <IconButton
                label={isLiked(track.id) ? t("track.unlike") : t("track.like")}
                active={isLiked(track.id)}
                onClick={() => void toggleLike(track.id)}
                size="sm"
              >
                <Heart size={17} fill={isLiked(track.id) ? "currentColor" : "none"} />
              </IconButton>
            </>
          ) : (
            <div className="text-sm text-subtle">{t("player.pickSomething")}</div>
          )}
        </div>

        <div className="flex max-w-[640px] flex-1 flex-col items-center gap-1">
          <TransportControls />
          <SeekBar />
        </div>

        <div className="flex w-[30%] items-center justify-end gap-1">
          <IconButton label={t("player.queue")} active={p.queueOpen} onClick={() => p.setQueueOpen(!p.queueOpen)} size="sm">
            <ListMusic size={18} />
          </IconButton>
          <Link
            href="/equalizer"
            aria-label={t("nav.equalizer")}
            title={t("nav.equalizer")}
            className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg")}
          >
            <SlidersHorizontal size={17} />
          </Link>
          <VolumeControl />
          <IconButton label={t("player.fullscreen")} onClick={() => p.setExpanded(true)} disabled={!track} size="sm">
            <Maximize2 size={17} />
          </IconButton>
        </div>
      </footer>
    </>
  );
}
