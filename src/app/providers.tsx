"use client";

import type { Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SessionProvider } from "@/state/session";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { PlayerProvider } from "@/player/PlayerProvider";
import { LocaleSync } from "@/i18n/LocaleSync";
import { LibraryProvider } from "@/state/library";

/**
 * Global client providers. They live in the root layout so the audio player
 * survives every client-side navigation: changing pages never interrupts playback.
 */
export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <SessionProvider>
        <LocaleSync />
        <ThemeProvider>
          <ToastProvider>
            <LibraryProvider>
              <PlayerProvider>{children}</PlayerProvider>
            </LibraryProvider>
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
