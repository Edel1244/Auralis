"use client";

import { Globe } from "lucide-react";
import { LOCALES, LOCALE_NAMES, isLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { cn } from "@/lib/cn";

/** Language switcher. Persists to a cookie and, when signed in, to the account. */
export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const { user, savePreferences } = useSession();
  return (
    <label className={cn("relative inline-flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
      <Globe size={compact ? 15 : 17} className="text-muted" />
      <span className="sr-only">{t("settings.language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          const v = e.target.value;
          if (!isLocale(v)) return;
          setLocale(v);
          if (user) void savePreferences({ locale: v }).catch(() => {});
        }}
        className={cn(
          "rounded-full border border-line bg-surface text-fg outline-none focus:border-primary",
          compact ? "px-2 py-1" : "h-10 px-3",
        )}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
