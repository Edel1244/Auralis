"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageState } from "@/components/ui/PageState";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import type { MessageKey } from "@/i18n/translate";
import type { Paged } from "@/lib/types";

type N = { id: string; type: string; data: Record<string, string | number>; readAt: string | null; createdAt: string };

function linkFor(n: N) {
  const d = n.data;
  if (n.type === "follow" && d.username) return `/u/${d.username}`;
  if ((n.type === "playlist_follow" || n.type === "playlist_invite") && d.playlistId) return `/playlist/${d.playlistId}`;
  if (d.trackId && n.type !== "content_removed") return n.type === "upload_failed" ? "/uploads" : `/track/${d.trackId}`;
  return null;
}

function NotificationsInner() {
  const t = useT();
  const { formatDate } = useI18n();
  const { data, error, loading, reload } = useApi<Paged<N>>("/notifications?limit=50");
  const marked = useRef(false);

  // Opening the page marks everything as read (the list still shows what was new).
  useEffect(() => {
    if (!data || marked.current || !data.items.some((n) => !n.readAt)) return;
    marked.current = true;
    void api("/notifications", { method: "PATCH" });
  }, [data]);

  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("notifications.title")}</h1>
        {data.items.some((n) => !n.readAt) && (
          <Button variant="secondary" size="sm" onClick={async () => (await api("/notifications", { method: "PATCH" }), reload())}>
            <CheckCheck size={15} /> {t("notifications.markAllRead")}
          </Button>
        )}
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={<Bell size={26} />} title={t("notifications.empty")} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line">
          {data.items.map((n) => {
            const key = `notifications.types.${n.type}` as MessageKey;
            const text = t(key, { name: String(n.data.displayName ?? n.data.username ?? ""), title: String(n.data.title ?? "") });
            const href = linkFor(n);
            const body = (
              <div className={cn("flex items-start gap-3 border-b border-line px-4 py-3 last:border-0", !n.readAt ? "bg-primary/10" : "bg-surface")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{text}</p>
                  <p className="text-xs text-subtle">{formatDate(n.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{href ? <Link href={href} className="block hover:brightness-110">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsInner />
    </RequireAuth>
  );
}
