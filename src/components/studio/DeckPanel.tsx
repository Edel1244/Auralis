"use client";

import { Play, Pause, Disc3, Lock, Unlock, Minus, Plus, Repeat } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useT } from "@/i18n/I18nProvider";
import { effectiveBpm } from "@/audio/studio/math";
import type { Deck } from "@/audio/studio/Deck";
import { Cover, Spinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { DeckWaveform } from "./DeckWaveform";
import { useDeckPosition, useDeckState } from "./useDeck";

const HOT_COLORS = ["bg-[#FF4F8B]", "bg-[#2FD18A]", "bg-[#7C5CFF]", "bg-[#FF6A2B]"];

function VSlider({ label, value, min, max, step, onChange, format, tall }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; tall?: boolean;
}) {
  return (
    <label className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(min < 0 ? 0 : value)}
        className={cn("w-5 cursor-pointer accent-[var(--au-primary)] [direction:rtl] [writing-mode:vertical-lr]", tall ? "h-40" : "h-24")}
      />
      <span className="text-[10px] tabular-nums text-muted">{format(value)}</span>
    </label>
  );
}

export function DeckPanel({
  deck,
  name,
  color,
  onLoad,
  onSync,
  onPlayStart,
}: {
  deck: Deck;
  name: string;
  color: string;
  onLoad: () => void;
  onSync: () => void;
  onPlayStart: () => void;
}) {
  const t = useT();
  const s = useDeckState(deck)!;
  const pos = useDeckPosition(deck, s?.playing ?? false);
  if (!s) return null;
  const bpm = effectiveBpm(s.bpm, s.tempo);
  const pct = ((s.tempo - 1) * 100).toFixed(1);
  const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}`;

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-surface p-4" aria-label={name}>
      <header className="flex items-center gap-3">
        <span className="rounded-lg px-2 py-1 text-xs font-bold text-white" style={{ background: color }}>
          {name}
        </span>
        {s.track ? (
          <>
            <Cover src={s.track.coverUrl} seed={s.track.id} className="w-10" rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{s.track.title}</div>
              <div className="truncate text-xs text-muted">{s.track.artistName}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-sm text-subtle">{t("studio.emptyDeck")}</div>
        )}
        <Button size="sm" variant="secondary" onClick={onLoad}>
          <Disc3 size={15} /> {t("studio.load")}
        </Button>
      </header>

      <div className="relative">
        <DeckWaveform state={s} position={pos} color={color} onSeek={(x) => deck.seek(x)} />
        {s.loading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted">
            <Spinner size={14} /> {t("studio.analyzing")}
          </span>
        )}
      </div>
      {s.error && <p className="text-xs text-danger">{s.error}</p>}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-mono tabular-nums">{formatDuration(pos)}</span>
        <span className="text-subtle">/ {formatDuration(s.duration)}</span>
        <span className="ml-auto rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-base font-bold tabular-nums" title={s.bpm ? `${s.bpm} BPM original` : t("studio.bpmUnknown")}>
          {bpm ?? "—"} <span className="text-[10px] font-normal text-subtle">BPM</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            if (!s.playing) onPlayStart();
            void deck.toggle();
          }}
          disabled={!s.track}
          aria-label={s.playing ? t("player.pause") : t("player.play")}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white disabled:opacity-40"
          style={{ background: color }}
        >
          {s.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-[1px]" />}
        </button>
        <button
          onClick={() => deck.cue()}
          disabled={!s.track}
          className="h-12 rounded-full border-2 border-warning px-4 text-sm font-bold text-warning disabled:opacity-40"
        >
          {t("studio.cue")}
        </button>
        <Button size="sm" variant="outline" disabled={!s.track} onClick={onSync}>
          {t("studio.sync")}
        </Button>
        <div className="flex items-center gap-1" role="group" aria-label={t("studio.nudge")}>
          {([-0.04, 0.04] as const).map((amt) => (
            <button
              key={amt}
              disabled={!s.track}
              aria-label={`${t("studio.nudge")} ${amt < 0 ? "−" : "+"}`}
              onPointerDown={() => deck.nudge(amt)}
              onPointerUp={() => deck.releaseNudge()}
              onPointerLeave={() => deck.releaseNudge()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-fg disabled:opacity-40"
            >
              {amt < 0 ? <Minus size={15} /> : <Plus size={15} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("studio.hotCues")}>
        {s.hotCues.map((hc, i) => (
          <button
            key={i}
            disabled={!s.track}
            onClick={() => deck.setHotCue(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              deck.clearHotCue(i);
            }}
            title={hc === null ? "Set hot cue" : `${formatDuration(hc)} (right-click to clear)`}
            className={cn("h-8 w-10 rounded-lg text-xs font-bold disabled:opacity-40", hc === null ? "bg-surface-2 text-subtle" : `${HOT_COLORS[i]} text-white`)}
          >
            {i + 1}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-line" />
        <Repeat size={14} className="text-subtle" aria-hidden="true" />
        {[1, 2, 4, 8, 16].map((b) => (
          <button
            key={b}
            disabled={!s.track || !s.bpm}
            onClick={() => deck.setLoop(s.loop?.beats === b ? null : b)}
            aria-pressed={s.loop?.beats === b}
            aria-label={t("studio.beats", { n: b })}
            className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-bold disabled:opacity-40", s.loop?.beats === b ? "bg-accent text-bg" : "bg-surface-2 text-muted")}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-surface-2/60 p-3">
        <VSlider label={t("studio.trim")} value={s.trim} min={-12} max={12} step={0.5} onChange={(v) => deck.setTrim(v)} format={db} />
        <VSlider label="High" value={s.eq.high} min={-24} max={6} step={0.5} onChange={(v) => deck.setEq("high", v)} format={db} />
        <VSlider label="Mid" value={s.eq.mid} min={-24} max={6} step={0.5} onChange={(v) => deck.setEq("mid", v)} format={db} />
        <VSlider label="Low" value={s.eq.low} min={-24} max={6} step={0.5} onChange={(v) => deck.setEq("low", v)} format={db} />
        <VSlider label={t("studio.filter")} value={s.filter} min={-1} max={1} step={0.02} onChange={(v) => deck.setFilter(v)} format={(v) => (Math.abs(v) < 0.02 ? "—" : v < 0 ? "LP" : "HP")} />
        <VSlider label={t("studio.echo")} value={s.echo} min={0} max={1} step={0.02} onChange={(v) => deck.setEcho(v)} format={(v) => `${Math.round(v * 100)}%`} />
        <VSlider label={t("studio.tempo")} value={s.tempo} min={0.84} max={1.16} step={0.001} onChange={(v) => deck.setTempo(v)} format={() => `${Number(pct) > 0 ? "+" : ""}${pct}%`} tall />
        <VSlider label={t("studio.volume")} value={s.volume} min={0} max={1} step={0.01} onChange={(v) => deck.setVolume(v)} format={(v) => `${Math.round(v * 100)}`} tall />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={() => deck.setKeyLock(!s.keyLock)}
          aria-pressed={s.keyLock}
          className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", s.keyLock ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted")}
        >
          {s.keyLock ? <Lock size={13} /> : <Unlock size={13} />} {t("studio.keyLock")}
        </button>
        <div className="flex items-center gap-1.5" role="group" aria-label={t("studio.pitch")}>
          <span className="text-xs text-muted">{t("studio.pitch")}</span>
          <button className="h-7 w-7 rounded-full bg-surface-2" aria-label="Pitch down" onClick={() => deck.shiftPitch(-1)}>
            −
          </button>
          <span className="w-8 text-center font-mono text-xs tabular-nums">{s.pitch > 0 ? `+${s.pitch}` : s.pitch}</span>
          <button className="h-7 w-7 rounded-full bg-surface-2" aria-label="Pitch up" onClick={() => deck.shiftPitch(1)}>
            +
          </button>
        </div>
      </div>
    </section>
  );
}
