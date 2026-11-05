"use client";

import Link from "next/link";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useApi } from "@/lib/useApi";
import { formatBytes } from "@/lib/format";
import { PageState } from "@/components/ui/PageState";
import { Button } from "@/components/ui/Button";
import { Cover, EmptyState, SectionHeader } from "@/components/ui/misc";
import { BarChart, StatTile } from "@/components/charts/BarChart";
import type { Track } from "@/lib/types";

type Stats = {
  totals: { tracks: number; plays: number; likes: number; followers: number; playlistAdds: number; comments: number };
  last30: { plays: number; listeners: number; newFollowers: number; completionRate: number | null };
  daily: { day: string; plays: number; minutes: number }[];
  topTracks: { track: Track; plays30: number }[];
  storage: { used: number; quota: number };
};

function ArtistInner() {
  const t = useT();
  const { formatNumber } = useI18n();
  const { data, error, loading, reload } = useApi<Stats>("/me/artist-stats");
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const n = formatNumber;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("artist.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("artist.subtitle")}</p>
        </div>
        <Link href="/uploads">
          <Button variant="secondary">{t("artist.manage")}</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label={t("artist.totalPlays")} value={n(data.totals.plays)} />
        <StatTile label={t("artist.likes")} value={n(data.totals.likes)} />
        <StatTile label={t("artist.followers")} value={n(data.totals.followers)} />
        <StatTile label={t("artist.playlistAdds")} value={n(data.totals.playlistAdds)} />
        <StatTile label={t("artist.comments")} value={n(data.totals.comments)} />
        <StatTile label={t("upload.manageTitle")} value={n(data.totals.tracks)} sub={`${formatBytes(data.storage.used)} / ${formatBytes(data.storage.quota)}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("artist.plays30")} value={n(data.last30.plays)} />
        <StatTile label={t("artist.listeners30")} value={n(data.last30.listeners)} />
        <StatTile label={t("artist.newFollowers30")} value={n(data.last30.newFollowers)} />
        <StatTile label={t("artist.completion")} value={data.last30.completionRate === null ? "—" : `${Math.round(data.last30.completionRate * 100)}%`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-surface p-5">
          <BarChart label={t("artist.dailyPlays")} data={data.daily.map((d) => ({ day: d.day, value: d.plays }))} />
        </div>
        <div className="rounded-3xl border border-line bg-surface p-5">
          <BarChart label={t("artist.dailyMinutes")} data={data.daily.map((d) => ({ day: d.day, value: d.minutes }))} />
        </div>
      </div>

      <section>
        <SectionHeader title={t("artist.topTracks")} />
        {data.topTracks.length === 0 ? (
          <EmptyState title={t("artist.noData")} />
        ) : (
          <ol className="space-y-2">
            {data.topTracks.map(({ track, plays30 }, i) => (
              <li key={track.id} className="flex items-center gap-3 rounded-xl bg-surface p-2.5">
                <span className="w-6 text-center text-sm tabular-nums text-subtle">{i + 1}</span>
                <Cover src={track.coverUrl} seed={track.id} className="w-10" rounded="rounded-md" />
                <Link href={`/track/${track.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {track.title}
                </Link>
                <span className="text-sm tabular-nums text-muted">{t("common.plays", { count: plays30 })}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function ArtistPage() {
  return (
    <RequireAuth>
      <ArtistInner />
    </RequireAuth>
  );
}
