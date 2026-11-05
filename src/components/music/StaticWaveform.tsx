"use client";

import { usePlayer } from "@/player/PlayerProvider";
import { Waveform } from "@/player/Waveform";
import type { Track } from "@/lib/types";

/** Waveform for a track page: live progress when it's the current track, otherwise click-to-play-from. */
export function StaticWaveform({ track }: { track: Track }) {
  const player = usePlayer();
  if (player.current?.id === track.id) return <Waveform peaks={track.waveform!} className="h-20" />;
  return (
    <button
      className="flex h-20 w-full items-center gap-[2px]"
      aria-label={`Play ${track.title}`}
      onClick={() => player.playTracks([track], 0, track.title)}
    >
      {track.waveform!.map((v, i) => (
        <span key={i} className="flex-1 rounded-full bg-fg/20 hover:bg-primary/60" style={{ height: `${Math.max(6, v * 100)}%` }} />
      ))}
    </button>
  );
}
