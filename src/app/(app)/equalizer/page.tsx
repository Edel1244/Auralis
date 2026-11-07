"use client";

import { useState } from "react";
import { Save, Trash2, RotateCcw } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { usePlayer } from "@/player/PlayerProvider";
import { Visualizer } from "@/player/Visualizer";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB, EQ_PRESETS, eqPeakDb } from "@/audio/eq";
import { EqCurve } from "@/components/eq/EqCurve";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";

type Preset = { id: string; name: string; gains: number[] };

const fmtHz = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f));
const fmtDb = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

/** Horizontal labeled slider used for preamp/bass/treble/balance/crossfade. */
function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className={cn("block", disabled && "opacity-50")}>
      <span className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        className="au-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ ["--pct" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function EqualizerPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useSession();
  const { eq, setEq, settings, setSettings, snapshot, setRate } = usePlayer();
  const presets = useApi<{ items: Preset[] }>(user ? "/me/eq-presets" : null);
  const [name, setName] = useState("");
  const custom = presets.data?.items ?? [];
  const playing = snapshot.status === "playing";
  // Show the built-in preset whose curve matches, even if it was set by hand.
  const shownPreset = eq.presetId ?? EQ_PRESETS.find((p) => p.gains.every((g, i) => g === eq.gains[i]))?.id ?? "";

  const setBand = (i: number, v: number) => {
    const gains = [...eq.gains];
    gains[i] = v;
    setEq({ gains, presetId: null });
  };
  const selectPreset = (id: string) => {
    const p = EQ_PRESETS.find((x) => x.id === id) ?? custom.find((x) => `u:${x.id}` === id);
    if (p) setEq({ gains: [...p.gains], presetId: id });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("eq.title")}</h1>
        <div className="w-56">
          <Switch checked={eq.enabled} onChange={(v) => setEq({ enabled: v })} label={t("eq.enabled")} />
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Select
            aria-label={t("eq.preset")}
            value={shownPreset}
            onChange={(e) => selectPreset(e.target.value)}
            className="h-10 w-56"
            disabled={!eq.enabled}
          >
            <option value="" disabled>
              {t("eq.custom")}
            </option>
            <optgroup label={t("eq.builtIn")}>
              {EQ_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            {custom.length > 0 && (
              <optgroup label={t("eq.yourPresets")}>
                {custom.map((p) => (
                  <option key={p.id} value={`u:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          {eq.presetId?.startsWith("u:") && (
            <IconButton
              label={t("eq.deletePreset")}
              onClick={async () => {
                await api("/me/eq-presets", { method: "DELETE", body: { id: eq.presetId!.slice(2) } });
                setEq({ presetId: null });
                void presets.reload();
              }}
            >
              <Trash2 size={17} />
            </IconButton>
          )}
          <IconButton label={t("eq.reset")} onClick={() => setEq({ gains: Array(10).fill(0), preamp: 0, bass: 0, treble: 0, balance: 0, presetId: "flat" })}>
            <RotateCcw size={17} />
          </IconButton>
          {user ? (
            <form
              className="ml-auto flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const r = await api<{ preset: Preset }>("/me/eq-presets", { body: { name: name.trim(), gains: eq.gains } });
                  setName("");
                  await presets.reload();
                  setEq({ presetId: `u:${r.preset.id}` });
                  toast(t("common.saved"), "success");
                } catch (err) {
                  toast((err as Error).message, "error");
                }
              }}
            >
              <Input aria-label={t("eq.presetName")} placeholder={t("eq.presetName")} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="h-10 w-44" />
              <Button type="submit" variant="secondary" disabled={!name.trim()}>
                <Save size={16} /> {t("eq.savePreset")}
              </Button>
            </form>
          ) : (
            <span className="ml-auto text-xs text-subtle">{t("eq.loginToSave")}</span>
          )}
        </div>

        <div className={cn("mb-5 rounded-2xl bg-black/20 px-2 text-muted", !eq.enabled && "opacity-40")}>
          <EqCurve eq={eq} label={t("eq.response")} />
        </div>

        {/* 10-band graphic EQ */}
        <div className={cn("grid grid-cols-10 gap-1 sm:gap-3", !eq.enabled && "opacity-40")} role="group" aria-label={t("eq.title")}>
          {EQ_BANDS.map((f, i) => (
            <div key={f} className="flex flex-col items-center gap-2">
              <span className="text-[11px] tabular-nums text-muted">{fmtDb(eq.gains[i])}</span>
              <input
                type="range"
                min={EQ_MIN_DB}
                max={EQ_MAX_DB}
                step={0.5}
                value={eq.gains[i]}
                disabled={!eq.enabled}
                aria-label={`${fmtHz(f)} Hz`}
                aria-valuetext={`${fmtDb(eq.gains[i])} dB`}
                onChange={(e) => setBand(i, Number(e.target.value))}
                onDoubleClick={() => setBand(i, 0)}
                className="h-48 w-6 cursor-pointer accent-[var(--au-primary)] [direction:rtl] [writing-mode:vertical-lr]"
              />
              <span className="text-[11px] font-semibold text-subtle">{fmtHz(f)}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Knob label={t("eq.preamp")} value={eq.preamp} min={-12} max={12} step={0.5} format={(v) => `${fmtDb(v)} dB`} onChange={(v) => setEq({ preamp: v })} disabled={!eq.enabled} />
          <Knob label={t("eq.bass")} value={eq.bass} min={0} max={12} step={0.5} format={(v) => `${fmtDb(v)} dB`} onChange={(v) => setEq({ bass: v })} disabled={!eq.enabled} />
          <Knob label={t("eq.treble")} value={eq.treble} min={-12} max={12} step={0.5} format={(v) => `${fmtDb(v)} dB`} onChange={(v) => setEq({ treble: v })} disabled={!eq.enabled} />
          <Knob
            label={t("eq.balance")}
            value={eq.balance}
            min={-1}
            max={1}
            step={0.05}
            format={(v) => (Math.abs(v) < 0.01 ? "C" : v < 0 ? `L ${Math.round(-v * 100)}` : `R ${Math.round(v * 100)}`)}
            onChange={(v) => setEq({ balance: v })}
          />
        </div>
        <div className={cn("mt-5 rounded-2xl border border-line p-4", !eq.enabled && "opacity-50")}>
          <Switch checked={eq.autoGain} onChange={(v) => setEq({ autoGain: v })} label={t("eq.autoGain")} disabled={!eq.enabled} />
          <p className="mt-1 text-xs text-subtle">
            {eq.autoGain ? t("eq.autoGainHint", { db: eqPeakDb(eq).toFixed(1) }) : t("eq.autoGainOff")}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display font-semibold">{t("eq.spectrum")}</h2>
        <div className="relative h-40">
          <Visualizer mode="bars" bars={64} className="h-full w-full" />
          {!playing && <p className="absolute inset-0 flex items-center justify-center text-sm text-subtle">{t("eq.spectrumIdle")}</p>}
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-line bg-surface p-5 md:grid-cols-2">
        <h2 className="font-display font-semibold md:col-span-2">{t("settings.playback")}</h2>
        <Knob
          label={t("settings.crossfade")}
          value={settings.crossfade}
          min={0}
          max={12}
          step={1}
          format={(v) => (v === 0 ? "Off" : t("settings.crossfadeSeconds", { n: v }))}
          onChange={(v) => setSettings({ crossfade: v })}
        />
        <Knob label={t("player.speed")} value={snapshot.rate} min={0.5} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setRate} />
        <Switch checked={settings.normalize} onChange={(v) => setSettings({ normalize: v })} label={t("settings.normalize")} />
        <Switch checked={settings.gapless} onChange={(v) => setSettings({ gapless: v })} label={t("settings.gapless")} />
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t("settings.quality")}</span>
          <Select value={settings.quality} onChange={(e) => setSettings({ quality: e.target.value as typeof settings.quality })}>
            <option value="auto">{t("settings.qualityAuto")}</option>
            <option value="high">{t("settings.qualityHigh")}</option>
            <option value="original">{t("settings.qualityOriginal")}</option>
          </Select>
        </label>
      </section>
    </div>
  );
}
