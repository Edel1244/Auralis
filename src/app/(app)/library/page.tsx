"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Heart, Plus, Library as LibraryIcon } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useLibrary } from "@/state/library";
import { useApi } from "@/lib/useApi";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { AlbumCard, CardGrid, PlaylistCard } from "@/components/music/Cards";
import type { Album } from "@/lib/types";

type Filter = "all" | "playlists" | "albums";

function LibraryInner() {
  const t = useT();
  const { playlists, likedIds, createPlaylist } = useLibrary();
  const albums = useApi<{ own: Album[]; saved: Album[] }>("/me/albums");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"recent" | "alpha">("recent");
  const sorted = useMemo(
    () => (sort === "alpha" ? [...playlists].sort((a, b) => a.title.localeCompare(b.title)) : playlists),
    [playlists, sort],
  );
  const allAlbums = [...(albums.data?.own ?? []), ...(albums.data?.saved ?? [])];
  const empty = !playlists.length && !allAlbums.length && likedIds.size === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("library.title")}</h1>
        <Button onClick={() => void createPlaylist()}>
          <Plus size={17} /> {t("playlist.create")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "playlists", "albums"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === f ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}
          >
            {t(`library.${f}`)}
          </button>
        ))}
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "alpha")}
          className="ml-auto rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
        >
          <option value="recent">{t("library.sortRecent")}</option>
          <option value="alpha">{t("library.sortAlpha")}</option>
        </select>
      </div>

      {empty ? (
        <EmptyState icon={<LibraryIcon size={26} />} title={t("library.emptyTitle")} body={t("library.emptyBody")} />
      ) : (
        <>
          {filter !== "albums" && (
            <section>
              <CardGrid>
                <Link
                  href="/favorites"
                  className="group flex aspect-square flex-col justify-end rounded-[var(--radius-card)] bg-gradient-to-br from-primary to-accent p-4 text-white"
                >
                  <Heart size={28} fill="currentColor" className="mb-auto" />
                  <span className="font-display text-xl font-bold">{t("library.likedSongs")}</span>
                  <span className="text-sm opacity-80">{t("common.tracks", { count: likedIds.size })}</span>
                </Link>
                {sorted.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </CardGrid>
            </section>
          )}
          {filter !== "playlists" && allAlbums.length > 0 && (
            <section>
              <SectionHeader title={t("library.albums")} />
              <CardGrid>
                {allAlbums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </CardGrid>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <RequireAuth>
      <LibraryInner />
    </RequireAuth>
  );
}
