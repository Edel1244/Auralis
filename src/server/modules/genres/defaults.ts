import "server-only";
import { db } from "../../db";

/** Starter genre taxonomy, created on first boot. Admins can edit it afterwards. */
export const DEFAULT_GENRES: { slug: string; name: string; color: string }[] = [
  { slug: "electronic", name: "Electronic", color: "#008CFF" },
  { slug: "house", name: "House", color: "#3DF2FF" },
  { slug: "techno", name: "Techno", color: "#5B6CFF" },
  { slug: "ambient", name: "Ambient", color: "#2EC4B6" },
  { slug: "hip-hop", name: "Hip-Hop", color: "#FFB547" },
  { slug: "rnb", name: "R&B", color: "#FF6FB5" },
  { slug: "pop", name: "Pop", color: "#FF4F8B" },
  { slug: "rock", name: "Rock", color: "#FF5A3C" },
  { slug: "metal", name: "Metal", color: "#9AA6B8" },
  { slug: "indie", name: "Indie", color: "#B8F25C" },
  { slug: "jazz", name: "Jazz", color: "#E6A157" },
  { slug: "classical", name: "Classical", color: "#C9B8FF" },
  { slug: "folk", name: "Folk & Acoustic", color: "#8BC48A" },
  { slug: "lofi", name: "Lo-fi", color: "#A78BFA" },
  { slug: "soundtrack", name: "Soundtrack", color: "#7DD3FC" },
  { slug: "world", name: "World", color: "#F59E0B" },
  { slug: "turkish", name: "Turkish", color: "#E11D48" },
  { slug: "experimental", name: "Experimental", color: "#22D3EE" },
  { slug: "podcast", name: "Spoken Word", color: "#94A3B8" },
];

export async function ensureDefaultGenres() {
  if ((await db.genre.count()) > 0) return;
  await db.genre.createMany({ data: DEFAULT_GENRES, skipDuplicates: true });
}
