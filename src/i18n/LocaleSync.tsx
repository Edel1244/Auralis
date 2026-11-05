"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/state/session";
import { useI18n } from "./I18nProvider";
import { isLocale } from "./config";

/** After login, adopt the language saved on the account. */
export function LocaleSync() {
  const { user } = useSession();
  const { locale, setLocale } = useI18n();
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!user || applied.current === user.id) return;
    applied.current = user.id;
    if (isLocale(user.locale) && user.locale !== locale) setLocale(user.locale);
  }, [user, locale, setLocale]);
  return null;
}
