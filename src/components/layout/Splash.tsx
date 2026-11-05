import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

/** Branded loading screen (full-screen splash or inline section loader). */
export function Splash({ inline = false }: { inline?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        inline ? "min-h-[50vh]" : "fixed inset-0 z-[100] bg-bg",
      )}
      role="status"
      aria-label="Loading AURALIS"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl" />
        <LogoMark size={inline ? 56 : 84} animated className="relative" />
      </div>
      {!inline && <Wordmark className="text-lg" />}
    </div>
  );
}
