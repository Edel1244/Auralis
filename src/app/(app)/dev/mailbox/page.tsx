"use client";

import { useState } from "react";
import { ExternalLink, Inbox, MailX } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useSession } from "@/state/session";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { PageState } from "@/components/ui/PageState";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type OutboxMail = { id: string; date: string; from: string; to: string; subject: string; body: string; link: string | null };

/**
 * Development-only view of the signed-in user's own emails from the server
 * outbox. Exists so verification/reset links are reachable without SMTP.
 */
function Mailbox() {
  const t = useT();
  const { formatDate } = useI18n();
  const { user, refresh } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useApi<{ items: OutboxMail[] }>("/dev/mailbox");

  if (error?.status === 404)
    return <EmptyState icon={<MailX size={28} />} title={t("dev.mailboxUnavailable")} />;
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;

  const resend = async () => {
    setBusy(true);
    try {
      await api("/auth/resend-verification", { method: "POST" });
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{t("dev.mailboxTitle")}</h1>
        <p className="text-sm text-muted">{t("dev.mailboxSubtitle", { email: user?.email ?? "" })}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {user && !user.emailVerified && (
            <Button onClick={resend} loading={busy}>
              {t("dev.resend")}
            </Button>
          )}
          <Button variant="outline" onClick={() => { reload(); void refresh(); }}>
            {t("common.retry")}
          </Button>
        </div>
      </header>
      {data.items.length === 0 ? (
        <EmptyState icon={<Inbox size={28} />} title={t("dev.mailboxEmpty")} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{m.subject}</h2>
                <time className="text-xs text-subtle" dateTime={m.date}>
                  {formatDate(m.date, { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </div>
              <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-muted">{m.body}</pre>
              {m.link && (
                <a
                  href={m.link}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <ExternalLink size={14} /> {t("dev.openLink")}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DevMailboxPage() {
  return (
    <RequireAuth>
      <Mailbox />
    </RequireAuth>
  );
}
