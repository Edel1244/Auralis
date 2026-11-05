"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useForm } from "@/components/auth/useForm";

export default function ForgotPasswordPage() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const f = useForm({ email: "" });
  return (
    <>
      <h1 className="font-display text-2xl font-bold">{t("auth.forgotTitle")}</h1>
      <p className="mb-7 mt-1.5 text-sm text-muted">{t("auth.forgotSubtitle")}</p>
      {sent ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
          <MailCheck className="shrink-0 text-success" size={20} />
          {t("auth.resetSent")}
        </div>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void f.submit(async (v) => {
              await api("/auth/forgot-password", { body: v });
              setSent(true);
            });
          }}
        >
          <Field label={t("auth.email")} error={f.errors.email}>
            {(p) => <Input {...p} type="email" autoComplete="email" value={f.values.email} onChange={(e) => f.set("email", e.target.value)} />}
          </Field>
          {f.formError && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{f.formError}</p>}
          <Button type="submit" size="lg" className="w-full" loading={f.pending}>
            {t("auth.sendResetLink")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("common.back")}
        </Link>
      </p>
    </>
  );
}
