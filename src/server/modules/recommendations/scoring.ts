/**
 * Pure recommendation scoring (no I/O) — see tests/recommendations.test.ts.
 *
 * A listener profile is a set of weighted affinities derived from likes and
 * listens. Candidates are scored by a list of pluggable signals; new
 * strategies (collaborative filtering, embeddings, …) can be added as signals
 * without touching the data layer.
 */
export type Candidate = {
  id: string;
  ownerId: string;
  genreId: string | null;
  tags: string[];
  mood: string | null;
  playCount: number;
  likeCount: number;
  createdAt: Date;
};

export type ListenerProfile = {
  genres: Map<string, number>; // normalized 0..1
  artists: Map<string, number>;
  tags: Map<string, number>;
  heard: Map<string, number>; // trackId → times played
  liked: Set<string>;
};

export type Signal = { name: string; weight: number; score: (c: Candidate, p: ListenerProfile, now: number) => number };

const normalize = (m: Map<string, number>) => {
  const max = Math.max(0, ...m.values());
  if (max > 0) for (const [k, v] of m) m.set(k, v / max);
  return m;
};

export function buildProfile(
  events: { trackId: string; ownerId: string; genreId: string | null; tags: string[]; weight: number }[],
  liked: string[],
): ListenerProfile {
  const genres = new Map<string, number>();
  const artists = new Map<string, number>();
  const tags = new Map<string, number>();
  const heard = new Map<string, number>();
  for (const e of events) {
    if (e.genreId) genres.set(e.genreId, (genres.get(e.genreId) ?? 0) + e.weight);
    artists.set(e.ownerId, (artists.get(e.ownerId) ?? 0) + e.weight);
    for (const t of e.tags) tags.set(t, (tags.get(t) ?? 0) + e.weight * 0.5);
    heard.set(e.trackId, (heard.get(e.trackId) ?? 0) + 1);
  }
  return { genres: normalize(genres), artists: normalize(artists), tags: normalize(tags), heard, liked: new Set(liked) };
}

export const DEFAULT_SIGNALS: Signal[] = [
  { name: "genre", weight: 0.4, score: (c, p) => (c.genreId ? p.genres.get(c.genreId) ?? 0 : 0) },
  { name: "artist", weight: 0.2, score: (c, p) => p.artists.get(c.ownerId) ?? 0 },
  {
    name: "tags",
    weight: 0.12,
    score: (c, p) => (c.tags.length ? Math.min(1, c.tags.reduce((s, t) => s + (p.tags.get(t) ?? 0), 0) / 2) : 0),
  },
  { name: "popularity", weight: 0.18, score: (c) => Math.min(1, Math.log10(1 + c.playCount + c.likeCount * 3) / 4) },
  {
    name: "freshness",
    weight: 0.1,
    score: (c, _p, now) => Math.max(0, 1 - (now - c.createdAt.getTime()) / (60 * 24 * 3600 * 1000)),
  },
];

/** Ranks candidates, demoting what the listener already knows well. */
export function rank(candidates: Candidate[], profile: ListenerProfile, signals = DEFAULT_SIGNALS, now = Date.now()) {
  return candidates
    .map((c) => {
      let s = signals.reduce((acc, sig) => acc + sig.weight * sig.score(c, profile, now), 0);
      const plays = profile.heard.get(c.id) ?? 0;
      if (profile.liked.has(c.id)) s *= 0.35;
      else if (plays > 0) s *= Math.max(0.2, 1 - plays * 0.25);
      return { id: c.id, score: s };
    })
    .sort((a, b) => b.score - a.score);
}

/** Diversifies a ranked list so one artist doesn't dominate (max N per artist). */
export function diversify<T extends { ownerId: string }>(ranked: T[], maxPerArtist = 2) {
  const counts = new Map<string, number>();
  const out: T[] = [];
  const overflow: T[] = [];
  for (const r of ranked) {
    const n = counts.get(r.ownerId) ?? 0;
    if (n < maxPerArtist) {
      out.push(r);
      counts.set(r.ownerId, n + 1);
    } else overflow.push(r);
  }
  return [...out, ...overflow];
}
