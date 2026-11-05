"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useForm } from "@/components/auth/useForm";

function ResetForm() {
  const t = useT();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const f = useForm({ password: "", confirm: "" });
  if (done)
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
          <CheckCircle2 className="shrink-0 text-success" size={20} />
          {t("auth.resetDone")}
        </div>
        <Link href="/login" className="block">
          <Button size="lg" className="w-full">
            {t("nav.login")}
          </Button>
        </Link>
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.values.password !== f.values.confirm) return f.setErrors({ confirm: t("auth.passwordMismatch") });
        void f.submit(async (v) => {
          await api("/auth/reset-password", { body: { token, password: v.password } });
          setDone(true);
        });
      }}
    >
      <Field label={t("auth.newPassword")} error={f.errors.password} hint={t("auth.passwordHint")}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={f.values.password} onChange={(e) => f.set("password", e.target.value)} />}
      </Field>
      <Field label={t("auth.confirmPassword")} error={f.errors.confirm}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={f.values.confirm} onChange={(e) => f.set("confirm", e.target.value)} />}
      </Field>
      {f.formError && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{f.formError}</p>}
      <Button type="submit" size="lg" className="w-full" loading={f.pending} disabled={!token}>
        {t("auth.resetSubmit")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useT();
  return (
    <>
      <h1 className="mb-7 font-display text-2xl font-bold">{t("auth.resetTitle")}</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
