"use client";

import { useT } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { Panel } from "@/components/settings/Panel";
import { Switch } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Privacy } from "@/lib/types";

function PrivacyInner() {
  const t = useT();
  const toast = useToast();
  const { user, setUser } = useSession();
  if (!user) return null;

  const update = async (patch: Partial<Privacy> & { isPrivate?: boolean }) => {
    const prev = user;
    const { isPrivate, ...flags } = patch;
    // Optimistic update; the server is the source of truth.
    setUser({ ...user, isPrivate: isPrivate ?? user.isPrivate, privacy: { ...user.privacy, ...flags } });
    try {
      await api("/me/preferences", { method: "PATCH", body: { privacy: patch } });
    } catch (e) {
      setUser(prev);
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={t("settings.privacy")}>
        <div className="divide-y divide-line">
          <Switch checked={user.isPrivate} onChange={(v) => void update({ isPrivate: v })} label={t("settings.privateProfile")} description={t("settings.privateProfileHint")} />
          <Switch checked={user.privacy.showStats} onChange={(v) => void update({ showStats: v })} label={t("settings.showStats")} disabled={user.isPrivate} />
          <Switch checked={user.privacy.showFollowing} onChange={(v) => void update({ showFollowing: v })} label={t("settings.showFollowing")} disabled={user.isPrivate} />
          <Switch checked={user.privacy.showListening} onChange={(v) => void update({ showListening: v })} label={t("settings.showListening")} disabled={user.isPrivate} />
        </div>
      </Panel>
      <Panel title={t("settings.dataControls")}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              await api("/search/history", { method: "DELETE" });
              toast(t("settings.cleared"), "success");
            }}
          >
            {t("settings.clearSearch")}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await api("/me/history", { method: "DELETE" });
              toast(t("settings.cleared"), "success");
            }}
          >
            {t("settings.clearListening")}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

export default function PrivacySettingsPage() {
  return (
    <RequireAuth>
      <PrivacyInner />
    </RequireAuth>
  );
}
