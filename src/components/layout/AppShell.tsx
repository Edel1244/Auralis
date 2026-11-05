"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { PlayerBar } from "@/player/PlayerBar";
import { FullPlayer } from "@/player/FullPlayer";
import { QueuePanel } from "@/player/QueuePanel";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { Splash } from "./Splash";

function VerifyBanner() {
  const { user } = useSession();
  const t = useT();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified) return null;
  return (
    <div className="mx-4 mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm md:mx-6">
      <MailWarning size={18} className="text-warning" />
      <span className="flex-1">{t("auth.verifyBanner")}</span>
      <button
        disabled={sent}
        className="font-semibold text-warning hover:underline disabled:opacity-50"
        onClick={async () => {
          try {
            await api("/auth/resend-verification", { method: "POST" });
            setSent(true);
            toast(t("auth.verificationSent"), "success");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
      >
        {t("auth.resendVerification")}
      </button>
    </div>
  );
}

/** Persistent application frame. Mounted once for all (app) routes. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="main" className="relative min-w-0 flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={{ background: "var(--gradient-hero)" }} />
          <div className="relative">
            <TopBar />
            <VerifyBanner />
            <div className="px-4 pb-40 pt-4 md:px-6 md:pb-10">{status === "loading" ? <Splash inline /> : children}</div>
          </div>
        </main>
        <QueuePanel />
      </div>
      <PlayerBar />
      <MobileNav />
      <FullPlayer />
    </div>
  );
}
