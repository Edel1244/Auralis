"use client";

import { use, useState } from "react";
import { Play } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { PageState } from "@/components/ui/PageState";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { TrackList } from "@/components/music/TrackList";
import { usePlayer } from "@/player/PlayerProvider";
import { cn } from "@/lib/cn";
import type { Genre, Paged, Track } from "@/lib/types";

export default function GenrePage({ params }: PageProps<"/genre/[slug]">) {
  const { slug } = use(params);
  const t = useT();
  const player = usePlayer();
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const { data, error, loading, reload } = useApi<Paged<Track> & { genre: Genre }>(`/genres/${slug}?sort=${sort}&limit=50`);
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <header
        className="-mx-4 -mt-4 flex min-h-48 flex-col justify-end px-4 pb-6 pt-16 md:-mx-6 md:px-6"
        style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${data.genre.color} 55%, transparent), transparent)` }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("track.genre")}</p>
        <h1 className="font-display text-5xl font-bold tracking-tight">{data.genre.name}</h1>
        <p className="mt-2 text-sm text-muted">{t("common.tracks", { count: data.total })}</p>
      </header>
      <div className="flex items-center gap-3">
        <Button size="lg" disabled={!data.items.length} onClick={() => player.playTracks(data.items, 0, data.genre.name)}>
          <Play size={18} fill="currentColor" /> {t("player.play")}
        </Button>
        <div className="ml-auto flex rounded-full border border-line p-1 text-sm">
          {(["popular", "new"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cn("rounded-full px-3 py-1", sort === s ? "bg-surface-2 text-fg" : "text-muted")}
              aria-pressed={sort === s}
            >
              {s === "popular" ? t("home.trending") : t("home.newReleases")}
            </button>
          ))}
        </div>
      </div>
      {data.items.length ? <TrackList tracks={data.items} source={data.genre.name} /> : <EmptyState title={t("search.noResultsHint")} />}
    </div>
  );
}
