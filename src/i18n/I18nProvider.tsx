"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LOCALE_COOKIE, type Locale } from "./config";
import { createTranslator, type TFunction } from "./translate";

type I18nContextValue = {
  locale: Locale;
  t: TFunction;
  setLocale: (locale: Locale) => void;
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const tag = locale === "tr" ? "tr-TR" : "en-US";
    return {
      locale,
      setLocale,
      t: createTranslator(locale),
      formatDate: (d, opts) =>
        new Intl.DateTimeFormat(tag, opts ?? { dateStyle: "medium" }).format(new Date(d)),
      formatNumber: (n) => new Intl.NumberFormat(tag, { notation: n >= 10000 ? "compact" : "standard" }).format(n),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
