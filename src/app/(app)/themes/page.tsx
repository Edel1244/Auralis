"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Check, Flag, X, Paintbrush } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/ThemeProvider";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ThemePreview } from "@/components/settings/ThemePreview";
import { PageState } from "@/components/ui/PageState";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { ReportDialog } from "@/components/music/ReportDialog";
import type { ThemeTokens } from "@/theme/tokens";
import type { Paged, UserRef } from "@/lib/types";

type GalleryTheme = { id: string; name: string; description: string; tokens: ThemeTokens; installs: number; author: UserRef; installed?: boolean };

export default function ThemesGalleryPage() {
  const t = useT();
  const toast = useToast();
  const { user, savePreferences } = useSession();
  const { theme, preview, setTheme } = useTheme();
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [q, setQ] = useState("");
  const [previewing, setPreviewing] = useState<GalleryTheme | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const { data, error, loading, reload, setData } = useApi<Paged<GalleryTheme>>(`/themes?sort=${sort}&limit=48${q ? `&q=${encodeURIComponent(q)}` : ""}`);

  // Leaving the page always ends a preview.
  useEffect(() => () => preview(null), [preview]);

  const install = async (th: GalleryTheme) => {
    preview(null);
    setPreviewing(null);
    setTheme({ ...th.tokens, sidebar: theme.sidebar });
    if (!user) return;
    try {
      const r = await api<{ theme: GalleryTheme }>(`/themes/${th.id}/install`, { method: "POST" });
      void savePreferences({ activeThemeId: th.id }).catch(() => {});
      if (data) setData({ ...data, items: data.items.map((x) => (x.id === th.id ? { ...x, installs: r.theme.installs, installed: true } : x)) });
      toast(t("appearance.installed"), "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.themes")}</h1>
          <p className="mt-1 text-sm text-muted">{t("appearance.subtitle")}</p>
        </div>
        <Link href="/settings/appearance">
          <Button variant="secondary">
            <Paintbrush size={16} /> {t("nav.appearance")}
          </Button>
        </Link>
      </div>

      {previewing && (
        <div className="sticky top-16 z-20 flex items-center gap-3 rounded-2xl border border-primary/40 bg-elevated px-4 py-3 shadow-xl">
          <Eye size={18} className="text-primary" />
          <span className="flex-1 text-sm">
            {t("appearance.previewing")}: <strong>{previewing.name}</strong>
          </span>
          <Button size="sm" onClick={() => void install(previewing)}>
            {t("appearance.install")}
          </Button>
          <IconButton
            size="sm"
            label={t("appearance.stopPreview")}
            onClick={() => {
              preview(null);
              setPreviewing(null);
            }}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["popular", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            aria-pressed={sort === s}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium", sort === s ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}
          >
            {s === "popular" ? t("appearance.sortPopular") : t("appearance.sortNew")}
          </button>
        ))}
        <Input aria-label={t("common.search")} placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto h-10 w-56" />
      </div>

      {!data ? (
        <PageState loading={loading} error={error} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Paintbrush size={26} />} title={t("appearance.galleryEmpty")} action={<Link href="/settings/appearance"><Button>{t("appearance.publishTheme")}</Button></Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((th) => (
            <article key={th.id} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
              <ThemePreview tokens={th.tokens} />
              <div>
                <h2 className="truncate font-semibold">{th.name}</h2>
                {th.description && <p className="line-clamp-2 text-xs text-muted">{th.description}</p>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar src={th.author.avatarUrl} name={th.author.displayName} size={20} />
                <Link href={`/u/${th.author.username}`} className="truncate hover:underline">
                  {th.author.displayName}
                </Link>
                <span className="ml-auto whitespace-nowrap">{t("appearance.installs", { count: th.installs })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => void install(th)}>
                  {th.installed ? <Check size={14} /> : null} {th.installed ? t("appearance.installed") : t("appearance.install")}
                </Button>
                <IconButton
                  size="sm"
                  label={t("appearance.preview")}
                  active={previewing?.id === th.id}
                  onClick={() => {
                    preview({ ...th.tokens, sidebar: theme.sidebar });
                    setPreviewing(th);
                  }}
                >
                  <Eye size={16} />
                </IconButton>
                {user && user.id !== th.author.id && (
                  <IconButton size="sm" label={t("common.report")} onClick={() => setReport(th.id)}>
                    <Flag size={15} />
                  </IconButton>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <ReportDialog open={Boolean(report)} onClose={() => setReport(null)} targetType="THEME" targetId={report ?? ""} />
    </div>
  );
}
