"use client";

import { useState } from "react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { PageState } from "@/components/ui/PageState";
import { Button } from "@/components/ui/Button";
import type { Paged, UserRef } from "@/lib/types";

type Audit = { id: string; action: string; targetType: string; targetId: string; reason: string; metadata: Record<string, unknown>; createdAt: string; actor: UserRef };

/** Read-only moderation audit trail (shared by the Moderation and Admin dashboards). */
export function AuditLog() {
  const t = useT();
  const { formatDate } = useI18n();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paged<Audit>>(`/mod/audit?page=${page}`);
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-3 py-2">{t("track.added")}</th>
              <th className="px-3 py-2">{t("mod.actor")}</th>
              <th className="px-3 py-2">{t("mod.action")}</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">{t("admin.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a.id} className="border-t border-line bg-surface">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDate(a.createdAt, { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-3 py-2">@{a.actor.username}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{a.targetType}:{a.targetId.slice(0, 10)}…</td>
                <td className="max-w-xs truncate px-3 py-2 text-muted" title={a.reason}>{a.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center gap-2">
        <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>{t("common.back")}</Button>
        <Button size="sm" variant="secondary" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
      </div>
    </div>
  );
}
