"use client";

import { useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { PageState } from "@/components/ui/PageState";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TrackList } from "@/components/music/TrackList";
import type { Paged, Track } from "@/lib/types";

type Event = { id: string; playedAt: string; msPlayed: number; completed: boolean; track: Track };

function HistoryInner() {
  const t = useT();
  const { formatDate } = useI18n();
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const { data, error, loading, reload } = useApi<Paged<Event>>(`/me/history?limit=50&page=${page}`);
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;

  // Group by day for readability.
  const groups = new Map<string, Event[]>();
  for (const e of data.items) {
    const day = formatDate(e.playedAt, { dateStyle: "full" });
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.history")}</h1>
        {data.total > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
            <Trash2 size={15} /> {t("search.clearHistory")}
          </Button>
        )}
      </div>
      {data.total === 0 ? (
        <EmptyState icon={<HistoryIcon size={26} />} title={t("library.emptyTitle")} body={t("player.pickSomething")} />
      ) : (
        <>
          {[...groups.entries()].map(([day, events]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{day}</h2>
              <TrackList tracks={events.map((e) => e.track)} source={t("nav.history")} extras={events.map((e) => ({ key: e.id }))} numbered={false} />
            </section>
          ))}
          <div className="flex justify-center gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              {t("common.back")}
            </Button>
            <Button variant="secondary" size="sm" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>
              {t("common.next")}
            </Button>
          </div>
        </>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("search.clearHistory")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api("/me/history", { method: "DELETE" });
                setConfirm(false);
                setPage(1);
                void reload();
              }}
            >
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t("nav.history")}</p>
      </Modal>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <RequireAuth>
      <HistoryInner />
    </RequireAuth>
  );
}
