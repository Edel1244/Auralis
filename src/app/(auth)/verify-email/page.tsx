"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/misc";

function Verify() {
  const t = useT();
  const token = useSearchParams().get("token");
  const { refresh, status: auth } = useSession();
  const [status, setStatus] = useState<"pending" | "ok" | "fail">(token ? "pending" : "fail");
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api("/auth/verify-email", { body: { token } })
      .then(async () => {
        setStatus("ok");
        await refresh();
      })
      .catch(() => setStatus("fail"));
  }, [token, refresh]);

  if (status === "pending")
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Spinner /> {t("auth.verifying")}
      </div>
    );
  return (
    <div className="space-y-5">
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${status === "ok" ? "border-success/30 bg-success/10" : "border-danger/30 bg-danger/10"}`}
      >
        {status === "ok" ? <CheckCircle2 className="shrink-0 text-success" size={20} /> : <XCircle className="shrink-0 text-danger" size={20} />}
        {status === "ok" ? t("auth.verified") : t("auth.verifyFailed")}
      </div>
      <Link href={auth === "authenticated" ? "/home" : "/login"} className="block">
        <Button size="lg" className="w-full">
          {auth === "authenticated" ? t("nav.home") : t("nav.login")}
        </Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  const t = useT();
  return (
    <>
      <h1 className="mb-7 font-display text-2xl font-bold">{t("auth.verifyTitle")}</h1>
      <Suspense>
        <Verify />
      </Suspense>
    </>
  );
}
