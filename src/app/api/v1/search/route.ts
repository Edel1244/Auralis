import { z } from "zod";
import { route, json, readQuery, clientIp } from "@/server/http";
import { getAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import {
  recordSearch, searchAlbums, searchAll, searchArtists, searchPlaylists, searchTracks, searchUsers,
} from "@/server/modules/search/service";

const schema = z.object({
  q: z.string().trim().max(100).default(""),
  type: z.enum(["all", "tracks", "artists", "albums", "playlists", "users"]).default("all"),
  genre: z.string().max(40).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  duration: z.enum(["short", "medium", "long"]).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  record: z.enum(["0", "1"]).default("0"),
});

export const GET = route(async (req) => {
  const viewer = (await getAuth(req))?.user;
  rateLimit(`search:${viewer?.id ?? clientIp(req)}`, 240, 60 * 1000);
  const s = readQuery(req, schema);
  const filters = { genre: s.genre, year: s.year, duration: s.duration };
  if (s.record === "1" && s.q) await recordSearch(s.q, viewer?.id ?? null);
  if (s.type === "all") return json({ query: s.q, results: await searchAll(s.q, filters, viewer) });
  const take = 30;
  const skip = (s.page - 1) * take;
  const items =
    s.type === "tracks"
      ? await searchTracks(s.q, filters, viewer, skip, take)
      : s.type === "artists"
        ? await searchArtists(s.q, viewer, skip, take)
        : s.type === "albums"
          ? await searchAlbums(s.q, skip, take)
          : s.type === "playlists"
            ? await searchPlaylists(s.q, viewer, skip, take)
            : await searchUsers(s.q, skip, take);
  return json({ query: s.q, type: s.type, page: s.page, items, hasMore: items.length === take });
});
