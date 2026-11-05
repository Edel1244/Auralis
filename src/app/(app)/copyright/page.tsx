"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Scale } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useForm } from "@/components/auth/useForm";

/** Extracts a track id from a pasted AURALIS link or a bare id. */
function trackIdFrom(input: string) {
  const m = input.match(/\/track\/([A-Za-z0-9]+)/);
  return (m ? m[1] : input.trim()).slice(0, 40);
}

function ClaimForm() {
  const t = useT();
  const params = useSearchParams();
  const [sent, setSent] = useState(false);
  const f = useForm<{ track: string; claimantName: string; claimantEmail: string; workDescription: string; evidenceUrl: string; goodFaith: boolean }>({
    track: params.get("track") ?? "",
    claimantName: "",
    claimantEmail: "",
    workDescription: "",
    evidenceUrl: "",
    goodFaith: false,
  });
  if (sent)
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
        <CheckCircle2 className="shrink-0 text-success" size={20} /> {t("copyright.sent")}
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void f.submit(async ({ track, ...v }) => {
          await api("/copyright-claims", { body: { ...v, trackId: trackIdFrom(track) } });
          setSent(true);
        });
      }}
    >
      <Field label={t("copyright.track")} error={f.errors.trackId}>
        {(p) => <Input {...p} value={f.values.track} onChange={(e) => f.set("track", e.target.value)} placeholder="https://…/track/…" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("copyright.name")} error={f.errors.claimantName}>
          {(p) => <Input {...p} autoComplete="name" value={f.values.claimantName} onChange={(e) => f.set("claimantName", e.target.value)} />}
        </Field>
        <Field label={t("copyright.email")} error={f.errors.claimantEmail}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={f.values.claimantEmail} onChange={(e) => f.set("claimantEmail", e.target.value)} />}
        </Field>
      </div>
      <Field label={t("copyright.work")} error={f.errors.workDescription}>
        {(p) => <Textarea {...p} maxLength={4000} value={f.values.workDescription} onChange={(e) => f.set("workDescription", e.target.value)} />}
      </Field>
      <Field label={t("copyright.evidence")} error={f.errors.evidenceUrl}>
        {(p) => <Input {...p} type="url" value={f.values.evidenceUrl} onChange={(e) => f.set("evidenceUrl", e.target.value)} />}
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" checked={f.values.goodFaith} onChange={(e) => f.set("goodFaith", e.target.checked)} className="mt-0.5 accent-[var(--au-primary)]" />
        {t("copyright.goodFaith")}
      </label>
      {f.errors.goodFaith && <p className="text-xs text-danger">{f.errors.goodFaith}</p>}
      {f.formError && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{f.formError}</p>}
      <Button type="submit" size="lg" loading={f.pending} disabled={!f.values.goodFaith}>
        {t("copyright.submit")}
      </Button>
    </form>
  );
}

export default function CopyrightPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight">
          <Scale size={26} className="text-primary" /> {t("copyright.title")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("copyright.subtitle")}</p>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-6">
        <Suspense>
          <ClaimForm />
        </Suspense>
      </div>
    </div>
  );
}
