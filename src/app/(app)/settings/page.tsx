"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Smartphone } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useSession } from "@/state/session";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { Panel } from "@/components/settings/Panel";
import { LanguageSelect } from "@/components/settings/LanguageSelect";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useForm } from "@/components/auth/useForm";
import type { Me } from "@/lib/types";

type Sess = { id: string; userAgent: string | null; ip: string | null; createdAt: string; lastUsedAt: string; current: boolean };

function describeAgent(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: `${browser}${os ? ` · ${os}` : ""}`, mobile: /Mobile|Android|iPhone/.test(ua) };
}

function AccountInner() {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user, setUser, logout } = useSession();
  const sessions = useApi<{ items: Sess[] }>("/me/sessions");
  const pw = useForm({ currentPassword: "", newPassword: "", confirm: "" });
  const em = useForm({ currentPassword: "", email: "" });
  const [del, setDel] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;

  return (
    <div className="space-y-5">
      <Panel title={t("settings.general")}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-subtle">{t("auth.username")}</dt>
            <dd>@{user.username}</dd>
          </div>
          <div>
            <dt className="text-subtle">{t("auth.email")}</dt>
            <dd className="flex items-center gap-2">
              {user.email} <Badge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? t("settings.verified") : t("settings.notVerified")}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-subtle">{t("settings.accountRole")}</dt>
            <dd>{user.role}</dd>
          </div>
          <div>
            <dt className="text-subtle">{t("settings.storage")}</dt>
            <dd>
              {formatBytes(user.storageUsedBytes)} / {formatBytes(user.storageQuotaBytes)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted">
          {t("settings.editProfileHint")}{" "}
          <Link href={`/u/${user.username}`} className="font-semibold text-primary hover:underline">
            {t("nav.profile")} →
          </Link>
        </p>
        <div className="mt-5">
          <div className="mb-1 text-sm font-medium">{t("settings.language")}</div>
          <p className="mb-2 text-xs text-muted">{t("settings.languageHint")}</p>
          <LanguageSelect />
        </div>
      </Panel>

      <Panel title={t("settings.changePassword")}>
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.values.newPassword !== pw.values.confirm) return pw.setErrors({ confirm: t("auth.passwordMismatch") });
            void pw.submit(async (v) => {
              await api("/me/account", { method: "PATCH", body: { action: "password", currentPassword: v.currentPassword, newPassword: v.newPassword } });
              pw.set("currentPassword", "");
              pw.set("newPassword", "");
              pw.set("confirm", "");
              toast(t("settings.passwordChanged"), "success");
              void sessions.reload();
            });
          }}
        >
          <Field label={t("auth.currentPassword")} error={pw.errors.currentPassword}>
            {(f) => <Input {...f} type="password" autoComplete="current-password" value={pw.values.currentPassword} onChange={(e) => pw.set("currentPassword", e.target.value)} />}
          </Field>
          <Field label={t("auth.newPassword")} error={pw.errors.newPassword} hint={t("auth.passwordHint")}>
            {(f) => <Input {...f} type="password" autoComplete="new-password" value={pw.values.newPassword} onChange={(e) => pw.set("newPassword", e.target.value)} />}
          </Field>
          <Field label={t("auth.confirmPassword")} error={pw.errors.confirm}>
            {(f) => <Input {...f} type="password" autoComplete="new-password" value={pw.values.confirm} onChange={(e) => pw.set("confirm", e.target.value)} />}
          </Field>
          {pw.formError && <p className="text-sm text-danger sm:col-span-3">{pw.formError}</p>}
          <div className="sm:col-span-3">
            <Button type="submit" loading={pw.pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title={t("settings.changeEmail")}>
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void em.submit(async (v) => {
              const r = await api<{ user: Me }>("/me/account", { method: "PATCH", body: { action: "email", ...v } });
              setUser(r.user);
              em.set("currentPassword", "");
              em.set("email", "");
              toast(t("settings.emailChanged"), "success");
            });
          }}
        >
          <Field label={t("settings.newEmail")} error={em.errors.email}>
            {(f) => <Input {...f} type="email" autoComplete="email" value={em.values.email} onChange={(e) => em.set("email", e.target.value)} />}
          </Field>
          <Field label={t("auth.currentPassword")} error={em.errors.currentPassword}>
            {(f) => <Input {...f} type="password" autoComplete="current-password" value={em.values.currentPassword} onChange={(e) => em.set("currentPassword", e.target.value)} />}
          </Field>
          {em.formError && <p className="text-sm text-danger sm:col-span-2">{em.formError}</p>}
          <div>
            <Button type="submit" loading={em.pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title={t("settings.sessions")}>
        <ul className="divide-y divide-line">
          {sessions.data?.items.map((s) => {
            const d = describeAgent(s.userAgent);
            return (
              <li key={s.id} className="flex items-center gap-3 py-3">
                {d?.mobile ? <Smartphone size={20} className="text-muted" /> : <Monitor size={20} className="text-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {d?.label ?? t("settings.unknownDevice")}
                    {s.current && <Badge tone="primary">{t("settings.thisDevice")}</Badge>}
                  </div>
                  <div className="text-xs text-subtle">
                    {t("settings.lastActive", { date: formatDate(s.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }) })}
                    {s.ip && s.ip !== "local" ? ` · ${s.ip}` : ""}
                  </div>
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await api("/me/sessions", { method: "DELETE", body: { id: s.id } });
                      void sessions.reload();
                    }}
                  >
                    {t("settings.revoke")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {(sessions.data?.items.length ?? 0) > 1 && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={async () => {
              await api("/me/sessions", { method: "DELETE", body: { all: true } });
              void sessions.reload();
            }}
          >
            {t("settings.signOutOthers")}
          </Button>
        )}
      </Panel>

      <Panel title={t("settings.deleteAccount")} description={t("settings.deleteAccountHint")} danger>
        <Button variant="danger" onClick={() => setDel(true)}>
          {t("settings.deleteAccount")}
        </Button>
      </Panel>

      <Modal
        open={del}
        onClose={() => setDel(false)}
        title={t("settings.deleteAccount")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={delConfirm !== user.username || !delPassword}
              onClick={async () => {
                setDeleting(true);
                try {
                  await api("/me/account", { method: "DELETE", body: { password: delPassword } });
                  await logout();
                  router.replace("/");
                } catch (e) {
                  toast((e as Error).message, "error");
                  setDeleting(false);
                }
              }}
            >
              {t("settings.deleteForever")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("settings.deleteAccountHint")}</p>
          <Field label={t("auth.password")}>
            {(f) => <Input {...f} type="password" autoComplete="current-password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />}
          </Field>
          <Field label={t("settings.deleteConfirmType", { username: user.username })}>
            {(f) => <Input {...f} value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} autoComplete="off" />}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <RequireAuth>
      <AccountInner />
    </RequireAuth>
  );
}
