/**
 * Idempotent seed: creates the starter genre taxonomy.
 * (The server also does this automatically on first boot.)
 *
 * AURALIS intentionally ships **no sample music or fake users**: every track on
 * an instance is real, user-uploaded content. The first account registered on a
 * fresh instance becomes its administrator.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const GENRES = [
  ["electronic", "Electronic", "#008CFF"], ["house", "House", "#3DF2FF"], ["techno", "Techno", "#5B6CFF"],
  ["ambient", "Ambient", "#2EC4B6"], ["hip-hop", "Hip-Hop", "#FFB547"], ["rnb", "R&B", "#FF6FB5"],
  ["pop", "Pop", "#FF4F8B"], ["rock", "Rock", "#FF5A3C"], ["metal", "Metal", "#9AA6B8"],
  ["indie", "Indie", "#B8F25C"], ["jazz", "Jazz", "#E6A157"], ["classical", "Classical", "#C9B8FF"],
  ["folk", "Folk & Acoustic", "#8BC48A"], ["lofi", "Lo-fi", "#A78BFA"], ["soundtrack", "Soundtrack", "#7DD3FC"],
  ["world", "World", "#F59E0B"], ["turkish", "Turkish", "#E11D48"], ["experimental", "Experimental", "#22D3EE"],
  ["podcast", "Spoken Word", "#94A3B8"],
] as const;

async function main() {
  const db = new PrismaClient();
  try {
    for (const [slug, name, color] of GENRES) {
      await db.genre.upsert({ where: { slug }, create: { slug, name, color }, update: {} });
    }
    const users = await db.user.count();
    console.log(`Seeded ${GENRES.length} genres. ${users === 0 ? "No users yet: the first account you register becomes the administrator." : `${users} user(s) exist.`}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
