"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/state/session";
import { applyTheme, DEFAULT_THEME, normalizeTheme, THEME_STORAGE_KEY, type ThemeTokens } from "./tokens";

type ThemeValue = {
  theme: ThemeTokens;
  /** Live-preview without persisting. */
  preview: (t: ThemeTokens | null) => void;
  /** Apply + persist locally and to the account (debounced). */
  setTheme: (patch: Partial<ThemeTokens>) => void;
  resetTheme: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function readLocal(): ThemeTokens {
  try {
    return normalizeTheme(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { status, preferences, savePreferences } = useSession();
  const [theme, setThemeState] = useState<ThemeTokens>(DEFAULT_THEME);
  const [previewTheme, setPreviewTheme] = useState<ThemeTokens | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedFromServer = useRef(false);

  // Load local cache on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readLocal());
  }, []);

  // After login, the account's saved theme wins (restores preferences on any device).
  useEffect(() => {
    if (status !== "authenticated" || !preferences || syncedFromServer.current) return;
    syncedFromServer.current = true;
    const remote = preferences.appearance;
    if (remote && Object.keys(remote).length) {
      const t = normalizeTheme(remote);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(t);
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(t));
    }
  }, [status, preferences]);

  useEffect(() => {
    if (status === "anonymous") syncedFromServer.current = false;
  }, [status]);

  const active = previewTheme ?? theme;
  useEffect(() => {
    applyTheme(active);
    if (active.mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme(active);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [active]);

  const persist = useCallback(
    (t: ThemeTokens) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(t));
      } catch {}
      if (status === "authenticated") {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void savePreferences({ appearance: t }).catch(() => {}), 600);
      }
    },
    [status, savePreferences],
  );

  const setTheme = useCallback(
    (patch: Partial<ThemeTokens>) => {
      setThemeState((prev) => {
        const next = normalizeTheme({ ...prev, ...patch });
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetTheme = useCallback(() => {
    setThemeState(DEFAULT_THEME);
    persist(DEFAULT_THEME);
  }, [persist]);

  const value = useMemo(
    () => ({ theme, preview: setPreviewTheme, setTheme, resetTheme }),
    [theme, setTheme, resetTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
