"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, X, Clock, TrendingUp, SlidersHorizontal } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Field";
import { EmptyState, SectionHeader, Spinner } from "@/components/ui/misc";
import { TrackList } from "@/components/music/TrackList";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard } from "@/components/music/Cards";
import { GenreTile } from "@/components/music/GenreTile";
import type { Album, Genre, Playlist, PublicUser, Track } from "@/lib/types";

type Results = { tracks: Track[]; artists: PublicUser[]; albums: Album[]; playlists: Playlist[]; users: PublicUser[]; genres: Genre[] };
type Suggestion = { kind: "track" | "user" | "playlist"; id: string; label: string; sub: string };
type Type = "all" | "tracks" | "artists" | "albums" | "playlists" | "users";

function SearchInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useSession();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [type, setType] = useState<Type>("all");
  const [filters, setFilters] = useState({ genre: "", year: "", duration: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [rawResults, setResults] = useState<Results | null>(null);
  const [rawItems, setItems] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawSuggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focus, setFocus] = useState(false);
  const history = useApi<{ recent: string[]; trending: { query: string; count: number }[] }>("/search/history");
  const genres = useApi<{ items: Genre[] }>("/genres");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  // Instant search (debounced) — records the query once the user pauses.
  useEffect(() => {
    const query = q.trim();
    const hasFilters = Boolean(filters.genre || filters.year || filters.duration);
    if (!query && !hasFilters) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      const sp = new URLSearchParams({ q: query, type, record: query.length >= 2 ? "1" : "0" });
      Object.entries(filters).forEach(([k, v]) => v && sp.set(k, v));
      try {
        const r = await api<{ results?: Results; items?: unknown[] }>(`/search?${sp}`, { signal: ctrl.signal });
        if (type === "all") setResults(r.results!);
        else setItems(r.items!);
        router.replace(query ? `/search?q=${encodeURIComponent(query)}` : "/search", { scroll: false });
      } catch {
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, type, filters, router]);

  useEffect(() => {
    const query = q.trim();
    if (!query || !focus) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      api<{ suggestions: Suggestion[] }>(`/search/suggest?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => setSuggestions(r.suggestions))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, focus]);

  // Results only show while there's an active query or filter; stale state is simply hidden.
  const active = Boolean(q.trim() || filters.genre || filters.year || filters.duration);
  const results = active ? rawResults : null;
  const items = active ? rawItems : null;
  const suggestions = focus && q.trim() ? rawSuggestions : [];

  const types: [Type, string][] = [
    ["all", t("library.all")],
    ["tracks", t("search.songs")],
    ["artists", t("search.artists")],
    ["albums", t("search.albums")],
    ["playlists", t("search.playlists")],
    ["users", t("search.profiles")],
  ];
  const empty =
    results && !results.tracks.length && !results.artists.length && !results.albums.length && !results.playlists.length && !results.users.length && !results.genres.length;

  return (
    <div className="space-y-6">
      <div className="relative max-w-2xl">
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-label={t("search.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder={t("search.placeholder")}
          className="h-14 w-full rounded-full border border-line bg-surface pl-12 pr-24 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && <Spinner size={16} className="text-subtle" />}
          {q && (
            <button onClick={() => setQ("")} aria-label={t("common.close")} className="rounded-full p-1.5 text-subtle hover:text-fg">
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
            aria-label={t("search.filters")}
            className={cn("rounded-full p-1.5", showFilters ? "text-primary" : "text-subtle hover:text-fg")}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul id="search-suggestions" role="listbox" className="absolute inset-x-0 top-16 z-20 rounded-2xl border border-line bg-elevated p-1.5 shadow-2xl">
            {suggestions.map((s) => (
              <li key={`${s.kind}-${s.id}`} role="option" aria-selected={false}>
                <Link
                  href={s.kind === "track" ? `/track/${s.id}` : s.kind === "user" ? `/u/${s.id}` : `/playlist/${s.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <SearchIcon size={14} className="text-subtle" />
                  <span className="truncate">{s.label}</span>
                  {s.sub && <span className="truncate text-xs text-subtle">{s.sub}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3">
          <Select aria-label={t("search.filterGenre")} value={filters.genre} onChange={(e) => setFilters({ ...filters, genre: e.target.value })} className="w-48">
            <option value="">{t("search.filterGenre")}: {t("search.any")}</option>
            {genres.data?.items.map((g) => (
              <option key={g.id} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select aria-label={t("search.filterYear")} value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="w-40">
            <option value="">{t("search.filterYear")}: {t("search.any")}</option>
            {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Select aria-label={t("search.filterDuration")} value={filters.duration} onChange={(e) => setFilters({ ...filters, duration: e.target.value })} className="w-48">
            <option value="">{t("search.filterDuration")}: {t("search.any")}</option>
            <option value="short">&lt; 3 min</option>
            <option value="medium">3 – 6 min</option>
            <option value="long">&gt; 6 min</option>
          </Select>
        </div>
      )}

      {(results || items) && (
        <div role="tablist" className="flex flex-wrap gap-2">
          {types.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={type === k}
              onClick={() => setType(k)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium", type === k ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!q.trim() && !results && !items && (
        <div className="grid gap-8 md:grid-cols-2">
          {user && (history.data?.recent.length ?? 0) > 0 && (
            <section>
              <SectionHeader
                title={t("search.recent")}
                action={
                  <button
                    className="text-xs font-semibold text-muted hover:text-fg"
                    onClick={async () => {
                      await api("/search/history", { method: "DELETE" });
                      void history.reload();
                    }}
                  >
                    {t("search.clearHistory")}
                  </button>
                }
              />
              <div className="flex flex-wrap gap-2">
                {history.data!.recent.map((r) => (
                  <button key={r} onClick={() => setQ(r)} className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-muted hover:text-fg">
                    <Clock size={14} /> {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          {(history.data?.trending.length ?? 0) > 0 && (
            <section>
              <SectionHeader title={t("search.trending")} />
              <div className="flex flex-wrap gap-2">
                {history.data!.trending.map((r) => (
                  <button key={r.query} onClick={() => setQ(r.query)} className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-muted hover:text-fg">
                    <TrendingUp size={14} /> {r.query}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="md:col-span-2">
            <SectionHeader title={t("home.genres")} />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {genres.data?.items.map((g) => (
                <GenreTile key={g.id} genre={g} />
              ))}
            </div>
          </section>
        </div>
      )}

      {type === "all" && results && (
        empty ? (
          <EmptyState icon={<SearchIcon size={26} />} title={t("search.noResults", { query: q })} body={t("search.noResultsHint")} />
        ) : (
          <div className="space-y-10">
            {results.tracks.length > 0 && (
              <section>
                <SectionHeader title={t("search.songs")} />
                <TrackList tracks={results.tracks} source={`${t("nav.search")}: ${q}`} />
              </section>
            )}
            {results.artists.length > 0 && (
              <section>
                <SectionHeader title={t("search.artists")} />
                <CardGrid>{results.artists.map((a) => <ArtistCard key={a.id} user={a} />)}</CardGrid>
              </section>
            )}
            {results.albums.length > 0 && (
              <section>
                <SectionHeader title={t("search.albums")} />
                <CardGrid>{results.albums.map((a) => <AlbumCard key={a.id} album={a} />)}</CardGrid>
              </section>
            )}
            {results.playlists.length > 0 && (
              <section>
                <SectionHeader title={t("search.playlists")} />
                <CardGrid>{results.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</CardGrid>
              </section>
            )}
            {results.users.length > 0 && (
              <section>
                <SectionHeader title={t("search.profiles")} />
                <CardGrid>{results.users.map((u) => <ArtistCard key={u.id} user={u} />)}</CardGrid>
              </section>
            )}
            {results.genres.length > 0 && (
              <section>
                <SectionHeader title={t("search.genres")} />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">{results.genres.map((g) => <GenreTile key={g.id} genre={g} />)}</div>
              </section>
            )}
          </div>
        )
      )}

      {type !== "all" && items && (
        items.length === 0 ? (
          <EmptyState icon={<SearchIcon size={26} />} title={t("search.noResults", { query: q })} body={t("search.noResultsHint")} />
        ) : type === "tracks" ? (
          <TrackList tracks={items as Track[]} source={`${t("nav.search")}: ${q}`} />
        ) : (
          <CardGrid>
            {type === "albums"
              ? (items as Album[]).map((a) => <AlbumCard key={a.id} album={a} />)
              : type === "playlists"
                ? (items as Playlist[]).map((p) => <PlaylistCard key={p.id} playlist={p} />)
                : (items as PublicUser[]).map((u) => <ArtistCard key={u.id} user={u} />)}
          </CardGrid>
        )
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
