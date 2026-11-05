"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useForm } from "@/components/auth/useForm";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { setUser, refresh } = useSession();
  const f = useForm({ identifier: "", password: "" });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void f.submit(async (v) => {
          const r = await api<{ user: Me }>("/auth/login", { body: v });
          setUser(r.user);
          await refresh();
          router.replace(safeNext(params.get("next")));
        });
      }}
      className="space-y-4"
    >
      <Field label={t("auth.emailOrUsername")} error={f.errors.identifier}>
        {(p) => (
          <Input {...p} autoComplete="username" value={f.values.identifier} onChange={(e) => f.set("identifier", e.target.value)} required />
        )}
      </Field>
      <Field label={t("auth.password")} error={f.errors.password}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="current-password"
            value={f.values.password}
            onChange={(e) => f.set("password", e.target.value)}
            required
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
          {t("auth.forgotPassword")}
        </Link>
      </div>
      {f.formError && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {f.formError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>
        {t("auth.submitLogin")}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const t = useT();
  return (
    <>
      <h1 className="font-display text-2xl font-bold">{t("auth.loginTitle")}</h1>
      <p className="mb-7 mt-1.5 text-sm text-muted">{t("auth.loginSubtitle")}</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t("nav.register")}
        </Link>
      </p>
    </>
  );
}
