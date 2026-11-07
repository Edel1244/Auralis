"use client";

import { useEffect, useRef, useState } from "react";
import { Disc3, Circle, Square, Download, Save, FolderOpen, Trash2, Merge, Shuffle } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useSession } from "@/state/session";
import { usePlayer } from "@/player/PlayerProvider";
import { Mixer } from "@/audio/studio/Mixer";
import { DeckPanel } from "@/components/studio/DeckPanel";
import { TrackPicker } from "@/components/studio/TrackPicker";
import { MergeModal, exportable } from "@/components/studio/MergeModal";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { LogoMark } from "@/components/brand/Logo";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import type { Track } from "@/lib/types";

type Mix = { id: string; title: string; updatedAt: string; data: MixData };
type DeckSave = {
  trackId: string | null; tempo: number; keyLock: boolean; pitch: number; volume: number; trim: number;
  eq: { low: number; mid: number; high: number }; filter: number; echo: number; cue: number; hotCues: (number | null)[];
};
type MixData = { version: 1; crossfader: number; master: number; decks: { a: DeckSave; b: DeckSave } };

const COLORS = { a: "#008CFF", b: "#FF4F8B" };

/** Local-time file stamp, e.g. 2026-11-06-00-31-35. */
function localStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}


function MasterMeter({ mixer }: { mixer: Mixer }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const data = new Uint8Array(mixer.analyser.frequencyBinCount);
    let raf = 0;
    const draw = () => {
      const w = (c.width = c.clientWidth * devicePixelRatio);
      const h = (c.height = c.clientHeight * devicePixelRatio);
      mixer.analyser.getByteFrequencyData(data);
      const bars = 40;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor(Math.pow(i / bars, 2) * data.length * 0.7)] / 255;
        const g = ctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, "#008CFF");
        g.addColorStop(1, "#3DF2FF");
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [mixer]);
  return <canvas ref={canvas} className="h-20 w-full rounded-xl bg-black/30" aria-hidden="true" />;
}

function Studio() {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const { user } = useSession();
  const player = usePlayer();
  const [mixer, setMixer] = useState<Mixer | null>(null);
  const [xfade, setXfade] = useState(0);
  const [master, setMaster] = useState(0.9);
  const [picker, setPicker] = useState<"a" | "b" | null>(null);
  const [loaded, setLoaded] = useState<{ a: Track | null; b: Track | null }>({ a: null, b: null });
  const [recording, setRecording] = useState(false);
  const [recStart, setRecStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recorded, setRecorded] = useState<{ url: string; stamp: string; ext: string; allowed: boolean } | null>(null);
  const usedDuringRecording = useRef<Track[]>([]);
  const [sessions, setSessions] = useState<Mix[] | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [currentSession, setCurrentSession] = useState<Mix | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [autoSec, setAutoSec] = useState(8);

  useEffect(() => () => mixer?.dispose(), [mixer]);
  useEffect(() => () => void (recorded && URL.revokeObjectURL(recorded.url)), [recorded]);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((Date.now() - recStart) / 1000), 500);
    return () => clearInterval(id);
  }, [recording, recStart]);

  const start = () => {
    const m = new Mixer();
    setMixer(m);
  };

  const loadTrack = async (side: "a" | "b", tr: Track) => {
    if (!mixer) return;
    setLoaded((l) => ({ ...l, [side]: tr }));
    if (recording) usedDuringRecording.current.push(tr);
    await mixer[side].load({ id: tr.id, title: tr.title, artistName: tr.artistName, streamUrl: tr.streamUrl, bpm: tr.bpm, coverUrl: tr.coverUrl });
  };

  const snapshot = (): MixData => {
    const d = (side: "a" | "b"): DeckSave => {
      const s = mixer![side].state;
      return {
        trackId: s.track?.id ?? null, tempo: s.tempo, keyLock: s.keyLock, pitch: s.pitch, volume: s.volume, trim: s.trim,
        eq: s.eq, filter: s.filter, echo: s.echo, cue: s.cue, hotCues: s.hotCues,
      };
    };
    return { version: 1, crossfader: xfade, master, decks: { a: d("a"), b: d("b") } };
  };

  const restore = async (mix: Mix) => {
    if (!mixer) return;
    setCurrentSession(mix);
    setXfade(mix.data.crossfader);
    mixer.setCrossfader(mix.data.crossfader);
    setMaster(mix.data.master);
    mixer.setMasterVolume(mix.data.master);
    for (const side of ["a", "b"] as const) {
      const d = mix.data.decks[side];
      if (d.trackId) {
        try {
          const r = await api<{ track: Track }>(`/tracks/${d.trackId}`);
          await loadTrack(side, r.track);
        } catch {
          toast(t("player.error"), "error");
        }
      }
      mixer[side].applySettings(d);
    }
    setSessionOpen(false);
  };

  if (!mixer) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-16 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl" />
          <Disc3 size={72} className="relative text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">{t("studio.title")}</h1>
        <p className="text-muted">{t("studio.startHint")}</p>
        <Button size="lg" onClick={start}>
          {t("studio.start")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("studio.title")}</h1>
        {currentSession && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">{currentSession.title}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMergeOpen(true)}>
            <Merge size={15} /> {t("studio.merge")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setSessionOpen(true);
              const r = await api<{ items: Mix[] }>("/mixes");
              setSessions(r.items);
            }}
          >
            <FolderOpen size={15} /> {t("studio.sessions")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                if (currentSession) {
                  const r = await api<{ mix: Mix }>(`/mixes/${currentSession.id}`, { method: "PATCH", body: { data: snapshot() } });
                  setCurrentSession(r.mix);
                } else {
                  const title = sessionName.trim() || `${t("studio.title")} ${new Date().toLocaleString()}`;
                  const r = await api<{ mix: Mix }>("/mixes", { body: { title, data: snapshot() } });
                  setCurrentSession(r.mix);
                }
                toast(t("common.saved"), "success");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            <Save size={15} /> {t("studio.saveMix")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px_1fr]">
        <DeckPanel
          deck={mixer.a}
          name={t("studio.deckA")}
          color={COLORS.a}
          onLoad={() => setPicker("a")}
          onSync={() => !mixer.sync("a") && toast(t("studio.syncFailed"))}
          onPlayStart={() => player.engine?.pause()}
        />

        <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4" aria-label={t("studio.master")}>
          <div className="flex items-center justify-center">
            <LogoMark size={36} />
          </div>
          <MasterMeter mixer={mixer} />
          <label className="block">
            <span className="mb-1 flex justify-between text-xs text-muted">
              <span>{t("studio.master")}</span>
              <span className="tabular-nums">{Math.round(master * 100)}</span>
            </span>
            <input
              type="range"
              className="au-range w-full"
              min={0}
              max={1}
              step={0.01}
              value={master}
              style={{ ["--pct" as string]: `${master * 100}%` }}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaster(v);
                mixer.setMasterVolume(v);
              }}
            />
          </label>
          <div className="mt-auto space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                title={t("studio.autoMixHint", { n: autoSec })}
                disabled={!loaded.a || !loaded.b}
                onClick={() => {
                  player.engine?.pause();
                  mixer.autoTransition(autoSec, setXfade);
                }}
              >
                <Shuffle size={14} /> {t("studio.autoMix")}
              </Button>
              <select
                aria-label={t("studio.overlap")}
                value={autoSec}
                onChange={(e) => setAutoSec(Number(e.target.value))}
                className="h-9 rounded-full border border-line bg-surface-2 px-2 text-xs"
              >
                {[4, 8, 16, 32].map((n) => (
                  <option key={n} value={n}>
                    {n}s
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span style={{ color: COLORS.a }}>A</span>
              <span className="text-subtle">{t("studio.crossfader")}</span>
              <span style={{ color: COLORS.b }}>B</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={xfade}
              aria-label={t("studio.crossfader")}
              onDoubleClick={() => (mixer.cancelAutoTransition(), setXfade(0), mixer.setCrossfader(0))}
              onChange={(e) => {
                mixer.cancelAutoTransition();
                const v = Number(e.target.value);
                setXfade(v);
                mixer.setCrossfader(v);
              }}
              className="w-full cursor-pointer accent-[var(--au-accent)]"
            />
          </div>
          <div className="space-y-2 border-t border-line pt-4">
            {!recording ? (
              <Button
                variant="danger"
                className="w-full"
                onClick={() => {
                  setRecorded(null);
                  usedDuringRecording.current = [loaded.a, loaded.b].filter((x): x is Track => Boolean(x));
                  mixer.startRecording();
                  setRecStart(Date.now());
                  setElapsed(0);
                  setRecording(true);
                }}
              >
                <Circle size={14} fill="currentColor" /> {t("studio.record")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  const blob = await mixer.stopRecording();
                  setRecording(false);
                  if (!blob) return;
                  const allowed = usedDuringRecording.current.every((tr) => exportable(tr, user!));
                  setRecorded({ url: URL.createObjectURL(blob), stamp: localStamp(), ext: blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm", allowed });
                }}
              >
                <Square size={14} fill="currentColor" className="text-danger" /> {t("studio.stopRecording")} · {formatDuration(elapsed)}
              </Button>
            )}
            {recording && (
              <p className="flex items-center justify-center gap-2 text-xs text-danger">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> {t("studio.recording")}
              </p>
            )}
            {recorded && (
              <div className="space-y-2">
                <audio controls src={recorded.url} className="w-full" />
                {recorded.allowed ? (
                  <a href={recorded.url} download={`auralis-mix-${recorded.stamp}.${recorded.ext}`} className="block">
                    <Button className="w-full" size="sm">
                      <Download size={15} /> {t("studio.download")}
                    </Button>
                  </a>
                ) : (
                  <p className="text-xs text-muted">{t("studio.exportBlocked")}</p>
                )}
              </div>
            )}
          </div>
        </section>

        <DeckPanel
          deck={mixer.b}
          name={t("studio.deckB")}
          color={COLORS.b}
          onLoad={() => setPicker("b")}
          onSync={() => !mixer.sync("b") && toast(t("studio.syncFailed"))}
          onPlayStart={() => player.engine?.pause()}
        />
      </div>

      <MergeModal open={mergeOpen} onClose={() => setMergeOpen(false)} mixer={mixer} tracks={loaded} />

      <TrackPicker open={picker !== null} onClose={() => setPicker(null)} onPick={(tr) => picker && void loadTrack(picker, tr)} />

      <Modal open={sessionOpen} onClose={() => setSessionOpen(false)} title={t("studio.sessions")}>
        <form
          className="mb-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api<{ mix: Mix }>("/mixes", { body: { title: sessionName.trim(), data: snapshot() } });
            setCurrentSession(r.mix);
            setSessions((s) => [r.mix, ...(s ?? [])]);
            setSessionName("");
            toast(t("common.saved"), "success");
          }}
        >
          <Input aria-label={t("studio.sessionName")} placeholder={t("studio.sessionName")} value={sessionName} maxLength={100} onChange={(e) => setSessionName(e.target.value)} />
          <Button type="submit" disabled={!sessionName.trim()}>
            <Save size={15} />
          </Button>
        </form>
        {sessions && sessions.length === 0 && <p className="text-sm text-subtle">{t("studio.noSessions")}</p>}
        <ul className="space-y-1">
          {sessions?.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => void restore(m)}>
                <span className="block truncate text-sm font-medium">{m.title}</span>
                <span className="block text-xs text-subtle">{formatDate(m.updatedAt, { dateStyle: "medium", timeStyle: "short" })}</span>
              </button>
              <IconButton
                label={t("common.delete")}
                size="sm"
                onClick={async () => {
                  await api(`/mixes/${m.id}`, { method: "DELETE" });
                  setSessions((s) => s?.filter((x) => x.id !== m.id) ?? null);
                  if (currentSession?.id === m.id) setCurrentSession(null);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

export default function StudioPage() {
  return (
    <RequireAuth>
      <Studio />
    </RequireAuth>
  );
}
