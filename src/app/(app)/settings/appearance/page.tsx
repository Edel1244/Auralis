"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Download, Upload, RotateCcw, Globe, Lock, Trash2 } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { DEFAULT_THEME, THEME_PRESETS, themeTokensSchema, type ThemeTokens } from "@/theme/tokens";
import { useSession } from "@/state/session";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/settings/Panel";
import { ThemePreview } from "@/components/settings/ThemePreview";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Switch, Badge } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

type SavedTheme = { id: string; name: string; description: string; tokens: ThemeTokens; isPublic: boolean; installs: number };

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-muted">{label}</div>
      <div className="inline-flex flex-wrap rounded-full border border-line bg-surface-2 p-1" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn("rounded-full px-3.5 py-1.5 text-sm", value === v ? "bg-primary text-white" : "text-muted hover:text-fg")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, onReset, resetLabel }: { label: string; value: string; onChange: (v: string) => void; onReset?: () => void; resetLabel?: string }) {
  return (
    <label className="flex items-center gap-3">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-transparent" aria-label={label} />
      <span className="flex-1">
        <span className="block text-sm">{label}</span>
        <span className="font-mono text-xs uppercase text-subtle">{value}</span>
      </span>
      {onReset && (
        <button type="button" onClick={onReset} className="text-xs font-semibold text-muted hover:text-fg">
          {resetLabel}
        </button>
      )}
    </label>
  );
}

export default function AppearancePage() {
  const t = useT();
  const toast = useToast();
  const { user, savePreferences } = useSession();
  const { theme, setTheme, resetTheme } = useTheme();
  const mine = useApi<{ own: SavedTheme[]; installed: SavedTheme[] }>(user ? "/me/themes" : null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", isPublic: false });
  const [saving, setSaving] = useState(false);
  const light = theme.mode === "light";

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify({ app: "auralis-theme", version: 1, name: form.name || "My AURALIS theme", tokens: theme }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "auralis-theme.json" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importTheme = async (file: File | undefined) => {
    if (!file || file.size > 50_000) return toast(t("appearance.importError"), "error");
    try {
      const raw = JSON.parse(await file.text());
      const parsed = themeTokensSchema.safeParse(raw?.tokens ?? raw);
      if (!parsed.success) throw new Error();
      setTheme({ ...parsed.data, sidebar: theme.sidebar });
      toast(t("appearance.imported"), "success");
    } catch {
      toast(t("appearance.importError"), "error");
    }
  };

  const applySaved = (s: SavedTheme) => {
    setTheme({ ...s.tokens, sidebar: theme.sidebar });
    if (user) void savePreferences({ activeThemeId: s.id }).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t("appearance.subtitle")}</p>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Panel title={t("appearance.presets")}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {THEME_PRESETS.map((p) => {
                const tokens = { ...DEFAULT_THEME, ...p.tokens };
                return (
                  <button key={p.id} onClick={() => setTheme({ ...tokens, sidebar: theme.sidebar })} className="group text-left">
                    <ThemePreview tokens={tokens} className="transition-transform group-hover:scale-[1.03]" />
                    <span data-preset={p.id} className="mt-1.5 block text-xs font-medium text-muted group-hover:text-fg">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title={t("appearance.colors")}>
            <div className="space-y-5">
              <Segmented
                label={t("appearance.mode")}
                value={theme.mode}
                // Custom background/surface colors belong to one mode; switching mode returns them to that mode's defaults
                // so text never ends up dark-on-dark or light-on-light.
                onChange={(mode) => setTheme({ mode, background: null, surface: null })}
                options={[
                  ["dark", t("appearance.dark")],
                  ["light", t("appearance.light")],
                  ["system", t("appearance.system")],
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label={t("appearance.primary")} value={theme.primary} onChange={(primary) => setTheme({ primary })} />
                <ColorField label={t("appearance.accent")} value={theme.accent} onChange={(accent) => setTheme({ accent })} />
                <ColorField
                  label={t("appearance.background")}
                  value={theme.background ?? (light ? "#F4F7FB" : "#080B10")}
                  onChange={(background) => setTheme({ background })}
                  onReset={theme.background ? () => setTheme({ background: null }) : undefined}
                  resetLabel={t("appearance.auto")}
                />
                <ColorField
                  label={t("appearance.surface")}
                  value={theme.surface ?? (light ? "#FFFFFF" : "#111720")}
                  onChange={(surface) => setTheme({ surface })}
                  onReset={theme.surface ? () => setTheme({ surface: null }) : undefined}
                  resetLabel={t("appearance.auto")}
                />
              </div>
              <Switch checked={theme.gradient} onChange={(gradient) => setTheme({ gradient })} label={t("appearance.gradients")} />
            </div>
          </Panel>

          <Panel title={t("appearance.layout")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Segmented
                label={t("appearance.density")}
                value={theme.density}
                onChange={(density) => setTheme({ density })}
                options={[
                  ["compact", t("appearance.compact")],
                  ["comfortable", t("appearance.comfortable")],
                  ["spacious", t("appearance.spacious")],
                ]}
              />
              <Segmented
                label={t("appearance.motion")}
                value={theme.motion}
                onChange={(motion) => setTheme({ motion })}
                options={[
                  ["system", t("appearance.motionSystem")],
                  ["full", t("appearance.motionFull")],
                  ["reduced", t("appearance.motionReduced")],
                ]}
              />
              <Segmented
                label={t("appearance.font")}
                value={theme.font}
                onChange={(font) => setTheme({ font })}
                options={[
                  ["inter", "Inter"],
                  ["sora", "Sora"],
                  ["system", "System"],
                  ["serif", "Serif"],
                ]}
              />
              <Segmented
                label={t("appearance.playerStyle")}
                value={theme.playerStyle}
                onChange={(playerStyle) => setTheme({ playerStyle })}
                options={[
                  ["glass", t("appearance.glass")],
                  ["solid", t("appearance.solid")],
                  ["minimal", t("appearance.minimal")],
                ]}
              />
              <Segmented
                label={t("appearance.sidebar")}
                value={theme.sidebar}
                onChange={(sidebar) => setTheme({ sidebar })}
                options={[
                  ["expanded", t("appearance.expanded")],
                  ["collapsed", t("appearance.collapsed")],
                ]}
              />
              <label className="block">
                <span className="mb-1.5 flex justify-between text-sm text-muted">
                  {t("appearance.radius")} <span className="tabular-nums text-fg">{theme.radius}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={28}
                  step={1}
                  value={theme.radius}
                  className="au-range w-full"
                  style={{ ["--pct" as string]: `${(theme.radius / 28) * 100}%` }}
                  onChange={(e) => setTheme({ radius: Number(e.target.value) })}
                />
              </label>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div>
            <div className="mb-2 text-sm font-medium text-muted">{t("appearance.preview")}</div>
            <ThemePreview tokens={theme} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={exportTheme}>
              <Download size={15} /> {t("appearance.exportTheme")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload size={15} /> {t("appearance.importTheme")}
            </Button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => (void importTheme(e.target.files?.[0]), (e.target.value = ""))} />
          </div>
          {user && (
            <Button className="w-full" onClick={() => setSaveOpen(true)}>
              {t("appearance.saveTheme")}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={resetTheme}>
            <RotateCcw size={15} /> {t("appearance.reset")}
          </Button>
          <Link href="/themes" className="block text-center text-sm font-semibold text-primary hover:underline">
            {t("appearance.browseGallery")} →
          </Link>
        </aside>
      </div>

      {user && (
        <Panel title={t("appearance.myThemes")}>
          {!mine.data || (mine.data.own.length === 0 && mine.data.installed.length === 0) ? (
            <p className="text-sm text-subtle">{t("appearance.noThemes")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...mine.data.own.map((x) => ({ ...x, own: true })), ...mine.data.installed.filter((i) => !mine.data!.own.some((o) => o.id === i.id)).map((x) => ({ ...x, own: false }))].map((s) => (
                <div key={s.id} className="space-y-2 rounded-2xl border border-line p-3">
                  <ThemePreview tokens={s.tokens} />
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                    {s.own && <Badge tone={s.isPublic ? "primary" : "default"}>{s.isPublic ? t("common.public") : t("common.private")}</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => applySaved(s)}>
                      {t("appearance.apply")}
                    </Button>
                    {s.own && (
                      <>
                        <IconButton
                          size="sm"
                          label={s.isPublic ? t("appearance.makePrivate") : t("appearance.makePublic")}
                          onClick={async () => {
                            await api(`/themes/${s.id}`, { method: "PATCH", body: { isPublic: !s.isPublic } });
                            void mine.reload();
                          }}
                        >
                          {s.isPublic ? <Lock size={15} /> : <Globe size={15} />}
                        </IconButton>
                        <IconButton
                          size="sm"
                          label={t("common.delete")}
                          onClick={async () => {
                            await api(`/themes/${s.id}`, { method: "DELETE" });
                            void mine.reload();
                          }}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={t("appearance.saveTheme")}
        footer={
          <Button
            loading={saving}
            disabled={!form.name.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const { sidebar: _sidebar, ...tokens } = theme;
                await api("/themes", { body: { ...form, tokens: { ...tokens, sidebar: "expanded" } } });
                toast(form.isPublic ? t("appearance.published") : t("appearance.savedTheme"), "success");
                setSaveOpen(false);
                setForm({ name: "", description: "", isPublic: false });
                void mine.reload();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {t("common.save")}
          </Button>
        }
      >
        <div className="space-y-4">
          <ThemePreview tokens={theme} />
          <Field label={t("appearance.themeName")}>{(f) => <Input {...f} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label={t("appearance.description")}>
            {(f) => <Textarea {...f} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </Field>
          <Switch checked={form.isPublic} onChange={(isPublic) => setForm({ ...form, isPublic })} label={t("appearance.publishTheme")} />
        </div>
      </Modal>
    </div>
  );
}
