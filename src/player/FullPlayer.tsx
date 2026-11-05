"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Heart, ListMusic, Activity, Disc, AudioWaveform, Gauge } from "lucide-react";
import { cn } from "@/lib/cn";
import { Cover } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { useLibrary } from "@/state/library";
import { usePlayer } from "./PlayerProvider";
import { TransportControls, VolumeControl } from "./Controls";
import { SeekBar } from "./SeekBar";
import { Visualizer, type VisualizerMode } from "./Visualizer";
import { QueueList } from "./QueuePanel";
import { Waveform } from "./Waveform";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function FullPlayer() {
  const p = usePlayer();
  const t = useT();
  const { isLiked, toggleLike } = useLibrary();
  const [view, setView] = useState<"art" | VisualizerMode>("art");
  const [showQueue, setShowQueue] = useState(false);
  const track = p.current;

  useEffect(() => {
    if (!p.expanded) return;
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, [p.expanded]);

  return (
    <AnimatePresence>
      {p.expanded && track && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t("player.nowPlaying")}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 300 }}
          className="fixed inset-0 z-[70] overflow-hidden bg-bg"
        >
          {/* Ambient backdrop from the artwork */}
          <div className="absolute inset-0 opacity-50">
            {track.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.coverUrl} alt="" className="h-full w-full scale-125 object-cover blur-[90px]" />
            )}
            <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/70 to-bg" />
          </div>

          <div className="relative flex h-full flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 md:px-10">
            <header className="flex items-center justify-between">
              <IconButton label={t("player.collapse")} onClick={() => p.setExpanded(false)}>
                <ChevronDown size={24} />
              </IconButton>
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">{t("player.nowPlaying")}</div>
                {p.source && <div className="text-xs text-muted">{p.source}</div>}
              </div>
              <IconButton label={t("player.queue")} active={showQueue} onClick={() => setShowQueue((v) => !v)}>
                <ListMusic size={20} />
              </IconButton>
            </header>

            <div className="flex min-h-0 flex-1 gap-10 py-6">
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-8">
                <div className="relative aspect-square w-full max-w-[min(440px,48vh)]">
                  {view === "art" ? (
                    <Cover src={track.coverUrl} seed={track.id} className="w-full shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]" rounded="rounded-[calc(var(--radius-card)*1.4)]" />
                  ) : (
                    <Visualizer mode={view} className="h-full w-full" bars={view === "radial" ? 96 : 56} />
                  )}
                </div>

                <div className="w-full max-w-[640px]">
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-2xl font-bold md:text-3xl">{track.title}</h2>
                      <Link
                        href={`/u/${track.owner.username}`}
                        onClick={() => p.setExpanded(false)}
                        className="truncate text-muted hover:text-fg hover:underline"
                      >
                        {track.artistName}
                      </Link>
                    </div>
                    <IconButton
                      label={isLiked(track.id) ? t("track.unlike") : t("track.like")}
                      active={isLiked(track.id)}
                      onClick={() => void toggleLike(track.id)}
                    >
                      <Heart size={22} fill={isLiked(track.id) ? "currentColor" : "none"} />
                    </IconButton>
                  </div>
                  {track.waveform && track.waveform.length > 0 && (
                    <Waveform peaks={track.waveform} className="mb-2 h-14" />
                  )}
                  <SeekBar />
                  <div className="mt-4">
                    <TransportControls size="lg" />
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-line bg-surface/60 p-1" role="group" aria-label={t("player.visualizer")}>
                      {(
                        [
                          ["art", Disc],
                          ["bars", Activity],
                          ["radial", Gauge],
                          ["wave", AudioWaveform],
                        ] as const
                      ).map(([v, Icon]) => (
                        <button
                          key={v}
                          onClick={() => setView(v)}
                          aria-pressed={view === v}
                          aria-label={`${t("player.visualizer")}: ${v}`}
                          className={cn("rounded-full p-2", view === v ? "bg-primary text-white" : "text-muted hover:text-fg")}
                        >
                          <Icon size={16} />
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      {t("player.speed")}
                      <select
                        value={p.snapshot.rate}
                        onChange={(e) => p.setRate(Number(e.target.value))}
                        className="rounded-full border border-line bg-surface px-2 py-1 text-fg"
                      >
                        {SPEEDS.map((s) => (
                          <option key={s} value={s}>
                            {s}×
                          </option>
                        ))}
                      </select>
                    </label>
                    <VolumeControl />
                  </div>
                </div>
              </div>

              {showQueue && (
                <aside className="hidden w-[360px] shrink-0 overflow-y-auto rounded-3xl border border-line bg-surface/70 p-5 backdrop-blur-xl lg:block">
                  <QueueList />
                </aside>
              )}
            </div>

            {showQueue && (
              <div className="absolute inset-x-0 bottom-0 top-16 overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 lg:hidden">
                <QueueList />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
