import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * AURALIS mark: an "A" whose crossbar is a sound wave, held inside an open
 * "aura" ring with a single emitted particle. Original artwork; see /docs/BRAND.md.
 */
export function LogoMark({
  size = 32,
  className,
  tile = false,
  animated = false,
}: {
  size?: number;
  className?: string;
  /** Render on the dark rounded tile (app icon style). */
  tile?: boolean;
  /** Subtle pulse on the ring and wave (respects reduced motion via CSS). */
  animated?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={cn(animated && "auralis-mark-animated", className)}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--au-primary, #008CFF)" />
          <stop offset="1" stopColor="var(--au-accent, #3DF2FF)" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill="#080B10" />}
      <path
        className="mark-ring"
        d="M47.6 47.6A22 22 0 1 1 53.9 30"
        stroke={`url(#g${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle className="mark-dot" cx="53.6" cy="37.6" r="2.2" fill="var(--au-accent, #3DF2FF)" />
      <path
        d="M20.5 45 32 19l11.5 26"
        stroke={`url(#g${id})`}
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="mark-wave"
        d="M23.2 36.5q2.2-3.4 4.4 0t4.4 0 4.4 0 4.4 0"
        stroke="var(--au-accent, #3DF2FF)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-semibold tracking-[0.28em] text-[var(--au-text)] select-none",
        className,
      )}
    >
      AURALIS
    </span>
  );
}

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <Wordmark className="text-[15px]" />
    </span>
  );
}
