"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Merge, Upload } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import type { Mixer } from "@/audio/studio/Mixer";
import { planMerge, renderMerge, type MergeOptions } from "@/audio/studio/merge";
import { encodeWav } from "@/audio/wav";
import { analyzeChannels } from "@/audio/analysis";
import { uploadWithProgress } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import type { Me, Track, Visibility } from "@/lib/types";

/** Export/publish is allowed only for the user's own, public-domain or Creative Commons tracks. */
export const exportable = (tr: Track, me: Me) => tr.owner.id === me.id || tr.ownership === "PUBLIC_DOMAIN" || tr.ownership === "CREATIVE_COMMONS";

type Result = { url: string; blob: Blob; duration: number; buffer: AudioBuffer };

function Slider({ label, value, max, onChange, extra }: { label: string; value: number; max: number; onChange: (v: number) => void; extra?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="flex items-center gap-2 tabular-nums">
          {extra}
          {formatDuration(value)}
        </span>
      </span>
      <input
        type="range"
        className="au-range w-full"
        min={0}
        max={Math.max(0.1, max)}
        step={0.1}
        value={Math.min(value, max)}
        style={{ ["--pct" as string]: `${(Math.min(value, max) / Math.max(0.1, max)) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/**
 * "Merge two songs": renders deck A → crossfade → deck B into one WAV file,
 * offline and sample-accurate, then lets the user preview, download or
 * publish it as a new track (rights permitting).
 */
export function MergeModal({ open, onClose, mixer, tracks }: { open: boolean; onClose: () => void; mixer: Mixer; tracks: { a: Track | null; b: Track | null } }) {
  const t = useT();
  const toast = useToast();
  const { user } = useSession();
  const a = mixer.a.state;
  const b = mixer.b.state;
  const ready = Boolean(mixer.a.buffer && mixer.b.buffer && tracks.a && tracks.b);
  const [opts, setOpts] = useState<MergeOptions>({ aOut: 0, bIn: 0, overlap: 8, syncTempo: false, bassSwap: true });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // Fresh defaults each time the dialog opens: A to its end, B from its cue point.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpts((o) => ({ ...o, aOut: mixer.a.state.duration, bIn: mixer.b.state.cue }));
    setTitle(tracks.a && tracks.b ? `${tracks.a.title} × ${tracks.b.title}` : "");
    setRights(false);
    setProgress(null);
  }, [open, mixer, tracks.a, tracks.b]);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const allowed = Boolean(user && tracks.a && tracks.b && exportable(tracks.a, user) && exportable(tracks.b, user));
  const plan = useMemo(
    () => planMerge({ duration: a.duration, bpm: a.bpm }, { duration: b.duration, bpm: b.bpm }, opts),
    [a.duration, a.bpm, b.duration, b.bpm, opts],
  );
  const set = (p: Partial<MergeOptions>) => {
    setOpts((o) => ({ ...o, ...p }));
    setResult(null);
  };

  const render = async () => {
    if (!mixer.a.buffer || !mixer.b.buffer) return;
    setBusy(true);
    setResult(null);
    try {
      const buffer = await renderMerge(mixer.a.buffer, mixer.b.buffer, { duration: a.duration, bpm: a.bpm }, { duration: b.duration, bpm: b.bpm }, opts);
      const blob = new Blob([encodeWav(buffer)], { type: "audio/wav" });
      setResult({ url: URL.createObjectURL(blob), blob, duration: buffer.duration, buffer });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!result || !rights) return;
    setProgress(0);
    try {
      const ch = Array.from({ length: Math.min(2, result.buffer.numberOfChannels) }, (_, i) => result.buffer.getChannelData(i));
      const analysis = analyzeChannels(ch, result.buffer.sampleRate);
      const form = new FormData();
      form.append(
        "meta",
        JSON.stringify({
          title: title.trim() || "Merge",
          artistName: user?.displayName,
          visibility,
          ownership: "ORIGINAL",
          licenseNote: `Merged in AURALIS Mixing Studio from "${tracks.a?.title}" and "${tracks.b?.title}".`,
          rightsConfirmed: true,
          analysis,
        }),
      );
      form.append("audio", new File([result.blob], `${(title.trim() || "merge").replace(/[^\w\- ]+/g, "")}.wav`, { type: "audio/wav" }));
      await uploadWithProgress("/uploads", form, setProgress);
      toast(t("studio.published"), "success");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("studio.mergeTitle")} size="lg">
      {!ready ? (
        <p className="text-sm text-muted">{tracks.a && tracks.b ? t("studio.mergeNotReady") : t("studio.mergeNeedsBoth")}</p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted">{t("studio.mergeHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-line p-4">
              <p className="truncate text-sm font-semibold text-[#008CFF]">A · {tracks.a!.title}</p>
              <Slider
                label={t("studio.aOut")}
                value={opts.aOut}
                max={a.duration}
                onChange={(v) => set({ aOut: v })}
                extra={
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => set({ aOut: mixer.a.position })}>
                    {t("studio.usePlayhead")}
                  </button>
                }
              />
            </div>
            <div className="space-y-3 rounded-2xl border border-line p-4">
              <p className="truncate text-sm font-semibold text-[#FF4F8B]">B · {tracks.b!.title}</p>
              <Slider
                label={t("studio.bIn")}
                value={opts.bIn}
                max={b.duration}
                onChange={(v) => set({ bIn: v })}
                extra={
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => set({ bIn: mixer.b.position })}>
                    {t("studio.usePlayhead")}
                  </button>
                }
              />
            </div>
          </div>
          <label className="block">
            <span className="mb-1 flex justify-between text-sm">
              <span className="text-muted">{t("studio.overlap")}</span>
              <span className="tabular-nums">{opts.overlap === 0 ? t("studio.hardCut") : `${opts.overlap} s`}</span>
            </span>
            <input
              type="range"
              className="au-range w-full"
              min={0}
              max={30}
              step={1}
              value={opts.overlap}
              style={{ ["--pct" as string]: `${(opts.overlap / 30) * 100}%` }}
              onChange={(e) => set({ overlap: Number(e.target.value) })}
            />
          </label>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Switch
              checked={opts.syncTempo}
              onChange={(v) => set({ syncTempo: v })}
              label={t("studio.syncTempo")}
              description={a.bpm && b.bpm ? t("studio.syncTempoHint", { a: Math.round(a.bpm), b: Math.round(b.bpm) }) : t("studio.syncFailed")}
              disabled={!a.bpm || !b.bpm}
            />
            <Switch checked={opts.bassSwap} onChange={(v) => set({ bassSwap: v })} label={t("studio.bassSwap")} description={t("studio.bassSwapHint")} disabled={opts.overlap === 0} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-sm text-muted">{t("studio.mergeLength", { time: formatDuration(plan.total) })}</span>
            <Button onClick={render} loading={busy}>
              <Merge size={16} /> {busy ? t("studio.rendering") : t("studio.render")}
            </Button>
          </div>

          {result && (
            <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
              <audio controls src={result.url} className="w-full" />
              {allowed ? (
                <>
                  <a href={result.url} download={`${(title.trim() || "auralis-merge").replace(/[^\w\- ]+/g, "")}.wav`} className="inline-block">
                    <Button variant="secondary" size="sm" type="button">
                      <Download size={15} /> {t("studio.downloadWav")}
                    </Button>
                  </a>
                  <div className="space-y-3 border-t border-line pt-4">
                    <p className="text-sm font-semibold">{t("studio.publishTitle")}</p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                      <Input aria-label={t("studio.mergeName")} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
                      <Select aria-label={t("upload.visibility")} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
                        <option value="PRIVATE">{t("common.private")}</option>
                        <option value="UNLISTED">{t("common.unlisted")}</option>
                        <option value="PUBLIC">{t("common.public")}</option>
                      </Select>
                    </div>
                    <label className="flex items-start gap-2 text-sm text-muted">
                      <input type="checkbox" className="mt-1 accent-[var(--au-primary)]" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                      {t("studio.mergeRights")}
                    </label>
                    <Button onClick={publish} disabled={!rights || progress !== null} loading={progress !== null}>
                      <Upload size={15} /> {progress !== null ? `${Math.round(progress * 100)}%` : t("studio.publish")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted">{t("studio.exportBlocked")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
