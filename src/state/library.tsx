"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Playlist } from "@/lib/types";
import { useSession } from "./session";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/I18nProvider";

type LibraryValue = {
  playlists: Playlist[];
  likedIds: Set<string>;
  refreshPlaylists: () => Promise<void>;
  createPlaylist: (title?: string, navigate?: boolean) => Promise<Playlist | null>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (trackId: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
};

const LibraryContext = createContext<LibraryValue | null>(null);

/** The signed-in user's playlists and liked-track set, shared app-wide. */
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const refreshPlaylists = useCallback(async () => {
    if (!user) return setPlaylists([]);
    const r = await api<{ items: Playlist[] }>("/me/playlists").catch(() => ({ items: [] }));
    setPlaylists(r.items);
  }, [user]);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaylists([]);
      setLikedIds(new Set());
      return;
    }
    void refreshPlaylists();
    void api<{ ids: string[] }>("/me/likes/ids")
      .then((r) => setLikedIds(new Set(r.ids)))
      .catch(() => {});
  }, [user, refreshPlaylists]);

  const createPlaylist = useCallback(
    async (title?: string, navigate = true) => {
      if (!user) {
        router.push("/login");
        return null;
      }
      const r = await api<{ playlist: Playlist }>("/playlists", {
        body: { title: title ?? t("playlist.newTitle", { n: playlists.length + 1 }) },
      });
      setPlaylists((p) => [r.playlist, ...p]);
      if (navigate) router.push(`/playlist/${r.playlist.id}`);
      return r.playlist;
    },
    [user, router, t, playlists.length],
  );

  const toggleLike = useCallback(
    async (trackId: string) => {
      if (!user) {
        toast(t("auth.loginRequired"));
        return;
      }
      const liked = likedIds.has(trackId);
      setLikedIds((s) => {
        const n = new Set(s);
        if (liked) n.delete(trackId);
        else n.add(trackId);
        return n;
      });
      try {
        await api(`/tracks/${trackId}/like`, { method: liked ? "DELETE" : "POST" });
      } catch {
        setLikedIds((s) => {
          const n = new Set(s);
          if (liked) n.add(trackId);
          else n.delete(trackId);
          return n;
        });
        toast(t("errors.generic"), "error");
      }
    },
    [user, likedIds, toast, t],
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      const p = playlists.find((x) => x.id === playlistId);
      try {
        const r = await api<{ added: number }>(`/playlists/${playlistId}/tracks`, { body: { trackIds } });
        toast(r.added ? t("playlist.added", { title: p?.title ?? "" }) : t("playlist.alreadyAdded", { title: p?.title ?? "" }), "success");
        void refreshPlaylists();
      } catch (e) {
        toast((e as Error).message || t("errors.generic"), "error");
      }
    },
    [playlists, toast, t, refreshPlaylists],
  );

  const value = useMemo(
    () => ({
      playlists,
      likedIds,
      refreshPlaylists,
      createPlaylist,
      isLiked: (id: string) => likedIds.has(id),
      toggleLike,
      addToPlaylist,
    }),
    [playlists, likedIds, refreshPlaylists, createPlaylist, toggleLike, addToPlaylist],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}
