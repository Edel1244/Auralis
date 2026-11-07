"use client";

import { Lock, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import type { Visibility } from "@/lib/types";

/**
 * Marks private / unlisted items so owners always know what others can see.
 * Renders nothing for public items. `variant="icon"` is for tight spots (sidebar).
 */
export function VisibilityBadge({
  visibility,
  variant = "pill",
  className,
}: {
  visibility: Visibility | undefined;
  variant?: "pill" | "icon";
  className?: string;
}) {
  const t = useT();
  if (!visibility || visibility === "PUBLIC") return null;
  const isPrivate = visibility === "PRIVATE";
  const Icon = isPrivate ? Lock : Link2;
  const label = isPrivate ? t("common.private") : t("common.unlisted");
  const hint = isPrivate ? t("common.privateHint") : t("common.unlistedHint");
  if (variant === "icon") {
    return (
      <span title={hint} aria-label={hint} role="img" className={cn("inline-flex shrink-0 text-subtle", className)}>
        <Icon size={13} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur",
        className,
      )}
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  );
}
