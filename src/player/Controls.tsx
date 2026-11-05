"use client";

import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { usePlayer } from "./PlayerProvider";

export function TransportControls({ size = "md" }: { size?: "md" | "lg" }) {
  const p = usePlayer();
  const t = useT();
  const playing = p.snapshot.status === "playing";
  const loading = p.snapshot.status === "loading";
  const big = size === "lg";
  const repeatLabel = p.queue.repeat === "one" ? t("player.repeatOne") : p.queue.repeat === "all" ? t("player.repeatAll") : t("player.repeatOff");
  return (
    <div className={cn("flex items-center justify-center", big ? "gap-5" : "gap-2")}>
      <IconButton label={t("player.shuffle")} active={p.queue.shuffle} onClick={p.toggleShuffle} size={big ? "md" : "sm"} aria-pressed={p.queue.shuffle}>
        <Shuffle size={big ? 20 : 17} />
      </IconButton>
      <IconButton label={t("player.previous")} onClick={p.previous} disabled={!p.current} size={big ? "lg" : "sm"}>
        <SkipBack size={big ? 26 : 19} fill="currentColor" />
      </IconButton>
      <button
        onClick={p.toggle}
        disabled={!p.current}
        aria-label={playing ? t("player.pause") : t("player.play")}
        className={cn(
          "flex items-center justify-center rounded-full bg-fg text-bg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40",
          big ? "h-16 w-16" : "h-9 w-9",
        )}
      >
        {loading ? (
          <Loader2 size={big ? 28 : 17} className="animate-spin" />
        ) : playing ? (
          <Pause size={big ? 28 : 17} fill="currentColor" />
        ) : (
          <Play size={big ? 28 : 17} fill="currentColor" className="translate-x-[1px]" />
        )}
      </button>
      <IconButton label={t("player.next")} onClick={p.next} disabled={!p.current} size={big ? "lg" : "sm"}>
        <SkipForward size={big ? 26 : 19} fill="currentColor" />
      </IconButton>
      <IconButton label={repeatLabel} active={p.queue.repeat !== "off"} onClick={p.cycleRepeat} size={big ? "md" : "sm"}>
        {p.queue.repeat === "one" ? <Repeat1 size={big ? 20 : 17} /> : <Repeat size={big ? 20 : 17} />}
      </IconButton>
    </div>
  );
}

export function VolumeControl({ className }: { className?: string }) {
  const { snapshot, setVolume, toggleMute } = usePlayer();
  const t = useT();
  const v = snapshot.muted ? 0 : snapshot.volume;
  const Icon = v === 0 ? VolumeX : v < 0.5 ? Volume1 : Volume2;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <IconButton label={snapshot.muted ? t("player.unmute") : t("player.mute")} onClick={toggleMute} size="sm">
        <Icon size={18} />
      </IconButton>
      <input
        type="range"
        className="au-range w-24"
        min={0}
        max={1}
        step={0.01}
        value={v}
        aria-label={t("player.volume")}
        style={{ ["--pct" as string]: `${v * 100}%` }}
        onChange={(e) => setVolume(Number(e.target.value))}
      />
    </div>
  );
}
