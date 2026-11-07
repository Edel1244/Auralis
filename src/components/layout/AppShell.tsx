"use client";

import { useState } from "react";
import Link from "next/link";
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
  const { user, instance } = useSession();
  const t = useT();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified) return null;
  // Without SMTP no real email goes out: say so instead of pretending, and in
  // development point to the mailbox page where the link can be opened.
  const noRealEmail = instance?.emailDelivery === "outbox";
  return (
    <div className="mx-4 mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm md:mx-6">
      <MailWarning size={18} className="text-warning" />
      <span className="flex-1">
        {t("auth.verifyBanner")}
        {noRealEmail && <span className="mt-0.5 block text-xs text-muted">{t("auth.mailNotConfigured")}</span>}
      </span>
      {instance?.devMailbox ? (
        <Link href="/dev/mailbox" className="font-semibold text-warning hover:underline">
          {t("auth.openDevMailbox")}
        </Link>
      ) : (
        <button
          disabled={sent}
          className="font-semibold text-warning hover:underline disabled:opacity-50"
          onClick={async () => {
            try {
              const r = await api<{ delivery: "smtp" | "outbox" }>("/auth/resend-verification", { method: "POST" });
              setSent(true);
              if (r.delivery === "smtp") toast(t("auth.verificationSent"), "success");
              else toast(t("auth.mailNotConfigured"), "error");
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        >
          {t("auth.resendVerification")}
        </button>
      )}
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
