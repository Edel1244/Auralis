import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-fg placeholder:text-subtle outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputBase, "h-11", invalid && "border-danger focus:border-danger focus:ring-danger/25", className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputBase, "min-h-24 py-2.5", invalid && "border-danger", className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, children, invalid, ...rest }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputBase, "h-11 appearance-none pr-8", invalid && "border-danger", className)}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

/** Label + control + hint/error, wired up with ids for accessibility. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; invalid: boolean }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-muted">
        {label}
      </label>
      {children({ id, "aria-describedby": descId, invalid: Boolean(error) })}
      {(error || hint) && (
        <p id={descId} className={cn("text-xs", error ? "text-danger" : "text-subtle")} role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
