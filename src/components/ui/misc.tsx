import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/brand/Logo";

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("animate-spin", className)}
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("au-skeleton rounded-lg", className)} aria-hidden="true" />;
}

export function Avatar({
  src,
  name,
  size = 36,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials || "?"}</span>
      )}
    </span>
  );
}

/** Square artwork with a generated gradient fallback derived from the seed text. */
export function Cover({
  src,
  seed,
  className,
  rounded = "rounded-[calc(var(--radius-card)*.7)]",
  mosaic,
}: {
  src?: string | null;
  seed: string;
  className?: string;
  rounded?: string;
  mosaic?: string[];
}) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const fallback = `linear-gradient(135deg, hsl(${hue} 85% 52%), hsl(${(hue + 50) % 360} 90% 28%))`;
  if (!src && mosaic && mosaic.length >= 4) {
    return (
      <div className={cn("grid aspect-square grid-cols-2 overflow-hidden bg-surface-2", rounded, className)}>
        {mosaic.slice(0, 4).map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={m} alt="" className="h-full w-full object-cover" loading="lazy" />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn("relative aspect-square overflow-hidden bg-surface-2", rounded, className)}
      style={src ? undefined : { background: fallback }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
          <LogoMark size={40} />
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface text-primary">
        {icon ?? <LogoMark size={34} />}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4 py-3", disabled && "opacity-50")}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-elevated border border-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "primary" | "danger" | "warning" | "success" }) {
  const tones = {
    default: "bg-surface-2 text-muted border-line",
    primary: "bg-primary/15 text-primary border-primary/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    success: "bg-success/15 text-success border-success/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone])}>
      {children}
    </span>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
