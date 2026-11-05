"use client";

import { cn } from "@/lib/cn";
import { Cover } from "@/components/ui/misc";

const GRADIENTS: Record<string, string> = {
  "gradient-aurora": "linear-gradient(180deg,#7C5CFF99,transparent)",
  "gradient-ocean": "linear-gradient(180deg,#008CFF99,transparent)",
  "gradient-sunset": "linear-gradient(180deg,#FF6A2B99,transparent)",
  "gradient-forest": "linear-gradient(180deg,#2FD18A88,transparent)",
  "gradient-rose": "linear-gradient(180deg,#FF4F8B88,transparent)",
};
export const BACKGROUND_PRESETS = ["gradient-ocean", "gradient-aurora", "gradient-sunset", "gradient-forest", "gradient-rose"];

export function backgroundCss(bg: string | null | undefined, fallback = "#008CFF") {
  if (bg?.startsWith("gradient:")) return GRADIENTS[bg.slice(9)] ?? GRADIENTS["gradient-ocean"];
  const c = bg ?? fallback;
  return `linear-gradient(180deg, color-mix(in oklab, ${c} 55%, transparent), transparent)`;
}

/** Hero header for tracks, playlists and albums. */
export function CollectionHeader({
  kind,
  title,
  cover,
  seed,
  mosaic,
  background,
  children,
  round = false,
}: {
  kind: string;
  title: string;
  cover: string | null;
  seed: string;
  mosaic?: string[];
  background?: string | null;
  children?: React.ReactNode;
  round?: boolean;
}) {
  return (
    <header
      className="-mx-4 -mt-4 flex flex-col gap-6 px-4 pb-6 pt-10 sm:flex-row sm:items-end md:-mx-6 md:px-6"
      style={{ background: backgroundCss(background) }}
    >
      <Cover
        src={cover}
        mosaic={mosaic}
        seed={seed}
        className={cn("w-44 shrink-0 shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)] sm:w-56", round && "rounded-full")}
        rounded={round ? "rounded-full" : undefined}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{kind}</p>
        <h1 className="mt-1 break-words font-display text-4xl font-bold tracking-tight md:text-6xl">{title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">{children}</div>
      </div>
    </header>
  );
}
