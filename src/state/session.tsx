"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { InstanceInfo, Me, Preferences } from "@/lib/types";

type Status = "loading" | "authenticated" | "anonymous";

type SessionValue = {
  status: Status;
  user: Me | null;
  preferences: Preferences | null;
  /** Server capabilities (e.g. whether real email is sent). */
  instance: InstanceInfo | null;
  refresh: () => Promise<void>;
  setUser: (u: Me) => void;
  logout: () => Promise<void>;
  savePreferences: (patch: Partial<Preferences> & { locale?: string }) => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUserState] = useState<Me | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [instance, setInstance] = useState<InstanceInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: Me | null; preferences: Preferences | null; instance?: InstanceInfo }>("/auth/me");
      setInstance(r.instance ?? null);
      setUserState(r.user);
      setPreferences(r.preferences);
      setStatus(r.user ? "authenticated" : "anonymous");
    } catch {
      setUserState(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    // Initial session load from the server; state updates happen after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const setUser = useCallback((u: Me) => {
    setUserState(u);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUserState(null);
    setPreferences(null);
    setStatus("anonymous");
  }, []);

  const savePreferences = useCallback(
    async (patch: Partial<Preferences> & { locale?: string }) => {
      if (!user) return;
      setPreferences((p) => (p ? { ...p, ...patch } : p));
      await api("/me/preferences", { method: "PATCH", body: patch });
    },
    [user],
  );

  const value = useMemo(
    () => ({ status, user, preferences, instance, refresh, setUser, logout, savePreferences }),
    [status, user, preferences, instance, refresh, setUser, logout, savePreferences],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
