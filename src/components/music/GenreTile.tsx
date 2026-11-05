import Link from "next/link";
import type { Genre } from "@/lib/types";

export function GenreTile({ genre, count }: { genre: Genre; count?: number }) {
  return (
    <Link
      href={`/genre/${genre.slug}`}
      className="group relative flex h-24 overflow-hidden rounded-[var(--radius-card)] p-4 font-display text-lg font-bold text-white transition-transform hover:scale-[1.02]"
      style={{ background: `linear-gradient(135deg, ${genre.color}, color-mix(in oklab, ${genre.color} 35%, #080B10))` }}
    >
      <span className="relative z-10 drop-shadow">{genre.name}</span>
      {count !== undefined && <span className="absolute bottom-3 left-4 text-xs font-medium opacity-80">{count}</span>}
      <span className="absolute -bottom-6 -right-6 h-24 w-24 rotate-12 rounded-2xl bg-white/15 transition-transform group-hover:rotate-[20deg]" />
    </Link>
  );
}
