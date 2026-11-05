"use client";

import Link from "next/link";
import { useState } from "react";
import { Flag, ExternalLink, ShieldCheck } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageState } from "@/components/ui/PageState";
import { Badge, Cover, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { DecisionDialog } from "@/components/admin/Decision";
import { AuditLog } from "@/components/admin/AuditLog";
import type { MessageKey } from "@/i18n/translate";
import type { Paged, Track, UserRef } from "@/lib/types";

type Target = { type: string; id: string; title: string; subtitle: string; href: string | null; imageUrl: string | null; state: string } | null;
type Report = {
  id: string; targetType: string; targetId: string; reason: string; details: string; status: string; resolution: string | null;
  createdAt: string; reporter: UserRef | null; handledBy: UserRef | null; target: Target; reportCount: number;
};
type Claim = {
  id: string; status: string; claimantName: string; claimantEmail: string; workDescription: string; evidenceUrl: string | null;
  resolution: string | null; createdAt: string; reviewer: UserRef | null; track: Target;
};
type Tab = "reports" | "claims" | "uploads" | "audit";
const STATUSES = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"] as const;

function TargetCard({ target }: { target: Target }) {
  const t = useT();
  if (!target) return <p className="text-sm text-subtle">{t("mod.targetGone")}</p>;
  return (
    <div className="flex items-center gap-3">
      {target.imageUrl !== null || target.type === "TRACK" ? <Cover src={target.imageUrl} seed={target.id} className="w-12 shrink-0" rounded="rounded-md" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge>{target.type}</Badge>
          <span className="truncate text-sm font-semibold">{target.title}</span>
          <Badge tone={["REMOVED", "SUSPENDED", "BANNED", "DELETED", "PRIVATE"].includes(target.state) ? "danger" : "default"}>{target.state}</Badge>
        </div>
        <div className="truncate text-xs text-muted">{target.subtitle}</div>
      </div>
      {target.href && (
        <Link href={target.href} target="_blank" className="text-muted hover:text-fg" aria-label="Open">
          <ExternalLink size={16} />
        </Link>
      )}
    </div>
  );
}

function StatusFilter({ value, onChange }: { value: string; onChange: (v: (typeof STATUSES)[number]) => void }) {
  const t = useT();
  const label: Record<string, MessageKey> = { OPEN: "mod.open", REVIEWING: "mod.reviewing", RESOLVED: "mod.resolved", DISMISSED: "mod.dismissed" };
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={cn("rounded-full px-3 py-1.5 text-sm", value === s ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:text-fg")}
        >
          {t(label[s])}
        </button>
      ))}
    </div>
  );
}

function Reports() {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("OPEN");
  const { data, error, loading, reload } = useApi<Paged<Report>>(`/mod/reports?status=${status}`);
  const [decide, setDecide] = useState<{ report: Report; action: "dismiss" | "remove" } | null>(null);
  const act = async (id: string, body: object) => {
    try {
      await api(`/mod/reports/${id}`, { body });
      void reload();
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };
  return (
    <div className="space-y-4">
      <StatusFilter value={status} onChange={setStatus} />
      {!data ? (
        <PageState loading={loading} error={error} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={26} />} title={t("mod.queueEmpty")} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <TargetCard target={r.target} />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={r.reason === "COPYRIGHT" ? "warning" : "danger"}>{t(`moderation.reasons.${r.reason}` as MessageKey)}</Badge>
                {r.reporter && <span>{t("mod.reportedBy", { name: `@${r.reporter.username}` })}</span>}
                <span>· {formatDate(r.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                {r.reportCount > 1 && <Badge tone="warning">{t("mod.reportCount", { count: r.reportCount })}</Badge>}
                {r.handledBy && <span>· {t("mod.actor")} @{r.handledBy.username}</span>}
              </div>
              {r.details && <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{r.details}</p>}
              {r.resolution && <p className="text-xs text-subtle">→ {r.resolution}</p>}
              {(r.status === "OPEN" || r.status === "REVIEWING") && (
                <div className="flex flex-wrap gap-2">
                  {r.status === "OPEN" && (
                    <Button size="sm" variant="secondary" onClick={() => void act(r.id, { action: "review" })}>
                      {t("mod.take")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDecide({ report: r, action: "dismiss" })}>
                    {t("mod.dismiss")}
                  </Button>
                  {r.target && (
                    <Button size="sm" variant="danger" onClick={() => setDecide({ report: r, action: "remove" })}>
                      {t("mod.remove")}
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {decide && (
        <DecisionDialog
          open
          title={decide.action === "remove" ? t("mod.remove") : t("mod.dismiss")}
          confirmLabel={decide.action === "remove" ? t("mod.remove") : t("mod.dismiss")}
          danger={decide.action === "remove"}
          allowStrike={decide.action === "remove" && decide.report.targetType === "TRACK"}
          defaultStrike={decide.report.reason === "COPYRIGHT"}
          onClose={() => setDecide(null)}
          onConfirm={(note, strike) => act(decide.report.id, { action: decide.action, note, strike })}
        />
      )}
    </div>
  );
}

function Claims() {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("OPEN");
  const { data, error, loading, reload } = useApi<Paged<Claim>>(`/mod/claims?status=${status}`);
  const [decide, setDecide] = useState<{ claim: Claim; action: "uphold" | "reject" } | null>(null);
  return (
    <div className="space-y-4">
      <StatusFilter value={status} onChange={setStatus} />
      {!data ? (
        <PageState loading={loading} error={error} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={26} />} title={t("mod.queueEmpty")} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((c) => (
            <li key={c.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <TargetCard target={c.track} />
              <dl className="grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
                <dt className="text-subtle">{t("mod.claimant")}</dt>
                <dd>
                  {c.claimantName} · <a href={`mailto:${c.claimantEmail}`} className="text-primary hover:underline">{c.claimantEmail}</a>
                </dd>
                <dt className="text-subtle">{t("mod.work")}</dt>
                <dd className="whitespace-pre-line">{c.workDescription}</dd>
                {c.evidenceUrl && (
                  <>
                    <dt className="text-subtle">{t("mod.evidence")}</dt>
                    <dd>
                      <a href={c.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary hover:underline">
                        {c.evidenceUrl}
                      </a>
                    </dd>
                  </>
                )}
              </dl>
              <div className="text-xs text-subtle">{formatDate(c.createdAt, { dateStyle: "medium", timeStyle: "short" })}{c.resolution ? ` → ${c.resolution}` : ""}</div>
              {(c.status === "OPEN" || c.status === "REVIEWING") && (
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" disabled={!c.track} onClick={() => setDecide({ claim: c, action: "uphold" })}>
                    {t("mod.uphold")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDecide({ claim: c, action: "reject" })}>
                    {t("mod.reject")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {decide && (
        <DecisionDialog
          open
          title={decide.action === "uphold" ? t("mod.uphold") : t("mod.reject")}
          confirmLabel={decide.action === "uphold" ? t("mod.uphold") : t("mod.reject")}
          danger={decide.action === "uphold"}
          onClose={() => setDecide(null)}
          onConfirm={async (note) => {
            try {
              await api(`/mod/claims/${decide.claim.id}`, { body: { action: decide.action, note } });
              void reload();
            } catch (e) {
              toast((e as Error).message, "error");
              throw e;
            }
          }}
        />
      )}
    </div>
  );
}

function Uploads() {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState("recent");
  const { data, error, loading, reload } = useApi<Paged<Track>>(`/mod/uploads?status=${status}`);
  const [decide, setDecide] = useState<{ track: Track; action: "remove" | "restore" } | null>(null);
  return (
    <div className="space-y-4">
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56" aria-label={t("admin.status")}>
        <option value="recent">{t("mod.recent")}</option>
        <option value="PROCESSING">PROCESSING</option>
        <option value="FAILED">FAILED</option>
        <option value="REMOVED">REMOVED</option>
      </Select>
      {!data ? (
        <PageState loading={loading} error={error} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={26} />} title={t("mod.queueEmpty")} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line">
          {data.items.map((tr) => (
            <li key={tr.id} className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-0">
              <Cover src={tr.coverUrl} seed={tr.id} className="w-10 shrink-0" rounded="rounded-md" />
              <div className="min-w-0 flex-1">
                <Link href={`/track/${tr.id}`} className="block truncate text-sm font-medium hover:underline">{tr.title}</Link>
                <div className="truncate text-xs text-muted">
                  @{tr.owner.username} · {tr.ownership} · {formatDate(tr.createdAt)}
                  {tr.statusReason ? ` · ${tr.statusReason}` : ""}
                </div>
              </div>
              <Badge tone={tr.status === "READY" ? "success" : "danger"}>{tr.status}</Badge>
              {tr.status === "REMOVED" ? (
                <Button size="sm" variant="secondary" onClick={() => setDecide({ track: tr, action: "restore" })}>{t("mod.restore")}</Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setDecide({ track: tr, action: "remove" })}>{t("mod.remove")}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {decide && (
        <DecisionDialog
          open
          title={decide.action === "remove" ? t("mod.remove") : t("mod.restore")}
          confirmLabel={decide.action === "remove" ? t("mod.remove") : t("mod.restore")}
          danger={decide.action === "remove"}
          allowStrike={decide.action === "remove"}
          onClose={() => setDecide(null)}
          onConfirm={async (note, strike) => {
            try {
              await api(`/mod/tracks/${decide.track.id}`, { body: { action: decide.action, reason: note, strike } });
              void reload();
            } catch (e) {
              toast((e as Error).message, "error");
              throw e;
            }
          }}
        />
      )}
    </div>
  );
}

function ModerationInner() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("reports");
  const tabs: [Tab, string][] = [
    ["reports", t("mod.reports")],
    ["claims", t("mod.claims")],
    ["uploads", t("mod.uploads")],
    ["audit", t("mod.audit")],
  ];
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight">
        <Flag size={26} className="text-primary" /> {t("mod.title")}
      </h1>
      <div role="tablist" className="flex gap-1 border-b border-line">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-medium", tab === k ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "reports" && <Reports />}
      {tab === "claims" && <Claims />}
      {tab === "uploads" && <Uploads />}
      {tab === "audit" && <AuditLog />}
    </div>
  );
}

export default function ModerationPage() {
  return (
    <RequireAuth role="MODERATOR">
      <ModerationInner />
    </RequireAuth>
  );
}
