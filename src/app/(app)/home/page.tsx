"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { useApi } from "@/lib/useApi";
import { PageState } from "@/components/ui/PageState";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { AlbumCard, ArtistCard, PlaylistCard, Shelf, TrackCard } from "@/components/music/Cards";
import { GenreTile } from "@/components/music/GenreTile";
import { usePlayer } from "@/player/PlayerProvider";
import { Cover } from "@/components/ui/misc";
import type { Album, Genre, Playlist, PublicUser, Track } from "@/lib/types";

type Feed = {
  totalPublicTracks: number;
  sections: {
    recentlyPlayed: Track[];
    recommended: Track[];
    trending: Track[];
    newReleases: Track[];
    community: Track[];
    recommendedArtists: (PublicUser & { followerCount: number; trackCount: number })[];
    genres: (Genre & { trackCount: number })[];
    featuredPlaylists: Playlist[];
    albums: Album[];
  };
};

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "home.goodMorning" : h < 18 ? "home.goodAfternoon" : "home.goodEvening";
}

function TrackShelf({ title, tracks, source }: { title: string; tracks: Track[]; source: string }) {
  if (!tracks.length) return null;
  return (
    <section>
      <SectionHeader title={title} />
      <Shelf>
        {tracks.map((t, i) => (
          <TrackCard key={t.id} track={t} list={tracks} index={i} source={source} />
        ))}
      </Shelf>
    </section>
  );
}

/** Compact "jump back in" tiles for recently played. */
function QuickTiles({ tracks }: { tracks: Track[] }) {
  const p = usePlayer();
  const t = useT();
  if (!tracks.length) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {tracks.slice(0, 6).map((tr, i) => (
        <button
          key={tr.id}
          onClick={() => p.playTracks(tracks, i, t("home.recentlyPlayed"))}
          className="group flex items-center gap-3 overflow-hidden rounded-xl bg-surface-2/70 pr-3 text-left transition-colors hover:bg-elevated"
        >
          <Cover src={tr.coverUrl} seed={tr.id} className="w-14 shrink-0" rounded="rounded-none" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{tr.title}</span>
            <span className="block truncate text-xs text-muted">{tr.artistName}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function HomePage() {
  const t = useT();
  const router = useRouter();
  const { user } = useSession();
  const { data, error, loading, reload } = useApi<Feed>("/feed/home");

  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const s = data.sections;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t(greetingKey())}
          {user ? `, ${user.displayName}` : ""}
        </h1>
      </div>

      {data.totalPublicTracks === 0 && s.recentlyPlayed.length === 0 ? (
        <EmptyState
          title={t("home.emptyTitle")}
          body={t("home.emptyBody")}
          action={
            <Button onClick={() => router.push(user ? "/upload" : "/register")}>
              <Upload size={17} /> {t("nav.upload")}
            </Button>
          }
        />
      ) : (
        <>
          <QuickTiles tracks={s.recentlyPlayed} />
          <TrackShelf title={t("home.recommended")} tracks={s.recommended} source={t("home.recommended")} />
          <TrackShelf title={t("home.trending")} tracks={s.trending} source={t("home.trending")} />
          <TrackShelf title={t("home.newReleases")} tracks={s.newReleases} source={t("home.newReleases")} />
          {s.featuredPlaylists.length > 0 && (
            <section>
              <SectionHeader title={t("home.featuredPlaylists")} />
              <Shelf>
                {s.featuredPlaylists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </Shelf>
            </section>
          )}
          {s.albums.length > 0 && (
            <section>
              <SectionHeader title={t("nav.albums")} />
              <Shelf>
                {s.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </Shelf>
            </section>
          )}
          <TrackShelf title={t("home.community")} tracks={s.community} source={t("home.community")} />
          {s.recommendedArtists.length > 0 && (
            <section>
              <SectionHeader title={t("home.recommendedArtists")} />
              <Shelf>
                {s.recommendedArtists.map((a) => (
                  <ArtistCard key={a.id} user={a} sub={t("common.followersCount", { count: a.followerCount })} />
                ))}
              </Shelf>
            </section>
          )}
          {s.genres.length > 0 && (
            <section>
              <SectionHeader
                title={t("home.genres")}
                action={
                  <Link href="/explore" className="text-sm font-semibold text-muted hover:text-fg">
                    {t("common.seeAll")}
                  </Link>
                }
              />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {s.genres.slice(0, 12).map((g) => (
                  <GenreTile key={g.id} genre={g} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
