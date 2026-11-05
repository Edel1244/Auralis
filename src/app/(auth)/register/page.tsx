"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useForm } from "@/components/auth/useForm";

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { setUser, refresh } = useSession();
  const f = useForm<{ email: string; username: string; displayName: string; password: string; confirm: string; acceptTerms: boolean }>({
    email: "",
    username: "",
    displayName: "",
    password: "",
    confirm: "",
    acceptTerms: false,
  });

  return (
    <>
      <h1 className="font-display text-2xl font-bold">{t("auth.registerTitle")}</h1>
      <p className="mb-7 mt-1.5 text-sm text-muted">{t("auth.registerSubtitle")}</p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.values.password !== f.values.confirm) {
            f.setErrors({ confirm: t("auth.passwordMismatch") });
            return;
          }
          void f.submit(async ({ email, username, displayName, password, acceptTerms }) => {
            const r = await api<{ user: Me }>("/auth/register", { body: { email, username, displayName, password, acceptTerms } });
            setUser(r.user);
            await refresh();
            router.replace("/home");
          });
        }}
      >
        <Field label={t("auth.email")} error={f.errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={f.values.email} onChange={(e) => f.set("email", e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.username")} error={f.errors.username} hint={t("auth.usernameHint")}>
            {(p) => (
              <Input
                {...p}
                autoComplete="username"
                value={f.values.username}
                onChange={(e) => f.set("username", e.target.value.toLowerCase())}
              />
            )}
          </Field>
          <Field label={t("auth.displayName")} error={f.errors.displayName}>
            {(p) => <Input {...p} autoComplete="nickname" value={f.values.displayName} onChange={(e) => f.set("displayName", e.target.value)} />}
          </Field>
        </div>
        <Field label={t("auth.password")} error={f.errors.password} hint={t("auth.passwordHint")}>
          {(p) => (
            <Input {...p} type="password" autoComplete="new-password" value={f.values.password} onChange={(e) => f.set("password", e.target.value)} />
          )}
        </Field>
        <Field label={t("auth.confirmPassword")} error={f.errors.confirm}>
          {(p) => (
            <Input {...p} type="password" autoComplete="new-password" value={f.values.confirm} onChange={(e) => f.set("confirm", e.target.value)} />
          )}
        </Field>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--au-primary)]"
            checked={f.values.acceptTerms}
            onChange={(e) => f.set("acceptTerms", e.target.checked)}
          />
          <span>{t("auth.acceptTerms")}</span>
        </label>
        {f.errors.acceptTerms && <p className="text-xs text-danger">{f.errors.acceptTerms}</p>}
        {f.formError && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {f.formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={f.pending}>
          {t("auth.submitRegister")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("nav.login")}
        </Link>
      </p>
    </>
  );
}
