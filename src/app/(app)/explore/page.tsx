"use client";

import { useT } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { PageState } from "@/components/ui/PageState";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { AlbumCard, CardGrid, PlaylistCard, Shelf, TrackCard } from "@/components/music/Cards";
import { GenreTile } from "@/components/music/GenreTile";
import type { Album, Genre, Paged, Playlist, Track } from "@/lib/types";

export default function ExplorePage() {
  const t = useT();
  const genres = useApi<{ items: (Genre & { trackCount: number })[] }>("/genres");
  const trending = useApi<{ sections: { trending: Track[]; community: Track[] } }>("/feed/home");
  const playlists = useApi<Paged<Playlist>>("/playlists?limit=12");
  const albums = useApi<Paged<Album>>("/albums?limit=12");

  if (!genres.data) return <PageState loading={genres.loading} error={genres.error} onRetry={genres.reload} />;
  const tr = trending.data?.sections.trending ?? [];
  const fresh = trending.data?.sections.community ?? [];

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.explore")}</h1>
      <section>
        <SectionHeader title={t("search.genres")} />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {genres.data.items.map((g) => (
            <GenreTile key={g.id} genre={g} count={g.trackCount} />
          ))}
        </div>
      </section>
      {tr.length > 0 && (
        <section>
          <SectionHeader title={t("home.trending")} />
          <Shelf>
            {tr.map((x, i) => (
              <TrackCard key={x.id} track={x} list={tr} index={i} source={t("home.trending")} />
            ))}
          </Shelf>
        </section>
      )}
      {fresh.length > 0 && (
        <section>
          <SectionHeader title={t("home.community")} />
          <Shelf>
            {fresh.map((x, i) => (
              <TrackCard key={x.id} track={x} list={fresh} index={i} source={t("home.community")} />
            ))}
          </Shelf>
        </section>
      )}
      {(playlists.data?.items.length ?? 0) > 0 && (
        <section>
          <SectionHeader title={t("home.featuredPlaylists")} />
          <CardGrid>
            {playlists.data!.items.map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </CardGrid>
        </section>
      )}
      {(albums.data?.items.length ?? 0) > 0 && (
        <section>
          <SectionHeader title={t("nav.albums")} />
          <CardGrid>
            {albums.data!.items.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </CardGrid>
        </section>
      )}
      {!tr.length && !fresh.length && <EmptyState title={t("home.emptyTitle")} body={t("home.emptyBody")} />}
    </div>
  );
}
