"use client";

import { Heart, Play, Shuffle } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useApi } from "@/lib/useApi";
import { PageState } from "@/components/ui/PageState";
import { EmptyState } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { TrackList } from "@/components/music/TrackList";
import { usePlayer } from "@/player/PlayerProvider";
import { useLibrary } from "@/state/library";
import type { Paged, Track } from "@/lib/types";

function FavoritesInner() {
  const t = useT();
  const player = usePlayer();
  const { likedIds } = useLibrary();
  const { data, error, loading, reload } = useApi<Paged<Track & { likedAt: string }>>("/me/likes?limit=50");
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  // Reflect unlikes made on this page immediately.
  const tracks = data.items.filter((x) => likedIds.has(x.id));
  return (
    <div className="space-y-6">
      <header className="-mx-4 -mt-4 flex items-end gap-6 bg-gradient-to-b from-primary/50 to-transparent px-4 pb-6 pt-14 md:-mx-6 md:px-6">
        <div className="flex h-36 w-36 items-center justify-center rounded-[var(--radius-card)] bg-gradient-to-br from-primary to-accent text-white shadow-2xl">
          <Heart size={56} fill="currentColor" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("nav.playlists")}</p>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">{t("library.likedSongs")}</h1>
          <p className="mt-2 text-sm text-muted">{t("common.tracks", { count: tracks.length })}</p>
        </div>
      </header>
      <div className="flex gap-2">
        <Button size="lg" disabled={!tracks.length} onClick={() => player.playTracks(tracks, 0, t("library.likedSongs"))}>
          <Play size={18} fill="currentColor" /> {t("player.play")}
        </Button>
        <IconButton
          label={t("player.shuffle")}
          size="lg"
          disabled={!tracks.length}
          onClick={() => {
            if (!player.queue.shuffle) player.toggleShuffle();
            player.playTracks(tracks, Math.floor(Math.random() * tracks.length), t("library.likedSongs"));
          }}
        >
          <Shuffle size={22} />
        </IconButton>
      </div>
      {tracks.length ? (
        <TrackList tracks={tracks} source={t("library.likedSongs")} extras={tracks.map((x) => ({ addedAt: x.likedAt }))} />
      ) : (
        <EmptyState icon={<Heart size={26} />} title={t("library.emptyTitle")} body={t("library.emptyBody")} />
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesInner />
    </RequireAuth>
  );
}
