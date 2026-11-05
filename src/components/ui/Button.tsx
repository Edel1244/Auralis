import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./misc";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-[0_8px_24px_-12px_var(--au-primary)]",
  secondary: "bg-surface-2 text-fg hover:bg-elevated border border-line",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  outline: "border border-line text-fg hover:border-primary hover:text-primary",
  danger: "bg-danger text-white hover:brightness-110",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  pill?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, pill = true, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[.98]",
        pill ? "rounded-full" : "rounded-lg",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: "sm" | "md" | "lg" }
>(function IconButton({ label, active, size = "md", className, children, ...rest }, ref) {
  const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
        "disabled:opacity-40 disabled:pointer-events-none",
        active ? "text-primary" : "text-muted hover:text-fg hover:bg-surface-2",
        dim,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
