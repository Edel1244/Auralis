"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useSession } from "@/state/session";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { PageState } from "@/components/ui/PageState";
import { Avatar, Badge, SectionHeader, Switch } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { BarChart, StatTile } from "@/components/charts/BarChart";
import { AuditLog } from "@/components/admin/AuditLog";
import type { Paged, PublicUser, Role } from "@/lib/types";

type Stats = {
  users: { total: number; new30d: number; byStatus: Record<string, number>; byRole: Record<string, number> };
  tracks: { total: number; byStatus: Record<string, number> };
  playlists: number;
  plays30d: number;
  storage: { usedBytes: number; allocatedBytes: number };
  moderation: { openReports: number; openClaims: number };
  jobs: { queued: number; running: number };
  daily: { uploads: { day: string; value: number }[]; plays: { day: string; value: number }[]; signups: { day: string; value: number }[] };
  topStorage: { id: string; username: string; displayName: string; storageUsedBytes: number; storageQuotaBytes: number }[];
};
type AdminUser = PublicUser & {
  email: string; status: "ACTIVE" | "SUSPENDED" | "BANNED"; suspendedUntil: string | null; emailVerified: boolean; strikeCount: number;
  storageUsedBytes: number; storageQuotaBytes: number; trackCount: number; followerCount: number;
};
type Genre = { id: string; name: string; slug: string; color: string; active: boolean; trackCount: number };
type Tab = "overview" | "users" | "genres" | "audit";

function Overview() {
  const t = useT();
  const { formatNumber: n } = useI18n();
  const { data, error, loading, reload } = useApi<Stats>("/admin/stats");
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("admin.totalUsers")} value={n(data.users.total)} sub={`+${data.users.new30d} · 30d`} />
        <StatTile label={t("admin.tracks")} value={n(data.tracks.total)} sub={Object.entries(data.tracks.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ")} />
        <StatTile label={t("admin.plays30")} value={n(data.plays30d)} />
        <StatTile label={t("admin.playlists")} value={n(data.playlists)} />
        <StatTile label={t("admin.storageUsed")} value={formatBytes(data.storage.usedBytes)} sub={`/ ${formatBytes(data.storage.allocatedBytes)} allocated`} />
        <StatTile label={t("admin.openReports")} value={data.moderation.openReports} />
        <StatTile label={t("admin.openClaims")} value={data.moderation.openClaims} />
        <StatTile label={t("admin.jobs")} value={`${data.jobs.running} / ${data.jobs.queued}`} sub="running / queued" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {(
          [
            ["admin.uploadsDaily", data.daily.uploads],
            ["admin.playsDaily", data.daily.plays],
            ["admin.signupsDaily", data.daily.signups],
          ] as const
        ).map(([k, d]) => (
          <div key={k} className="rounded-3xl border border-line bg-surface p-5">
            <BarChart label={t(k)} data={d} />
          </div>
        ))}
      </div>
      <section>
        <SectionHeader title={t("admin.topStorage")} />
        <ul className="space-y-2">
          {data.topStorage.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-2.5 text-sm">
              <Link href={`/u/${u.username}`} className="flex-1 truncate hover:underline">{u.displayName} <span className="text-subtle">@{u.username}</span></Link>
              <span className="tabular-nums text-muted">{formatBytes(u.storageUsedBytes)} / {formatBytes(u.storageQuotaBytes)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function UserActions({ u, onDone, onClose }: { u: AdminUser; onDone: () => void; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const { user: me } = useSession();
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [role, setRole] = useState<Role>(u.role);
  const [quota, setQuota] = useState(Math.round(u.storageQuotaBytes / 1048576));
  const isAdmin = me?.role === "ADMIN";
  const act = async (body: object) => {
    try {
      await api(`/admin/users/${u.id}`, { body });
      toast(t("common.saved"), "success");
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Modal open onClose={onClose} title={`@${u.username}`} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
          <Badge>{u.role}</Badge>
          <Badge tone={u.strikeCount ? "warning" : "default"}>{t("admin.strikes", { count: u.strikeCount })}</Badge>
          <span className="text-muted">{u.email}</span>
        </div>
        <Field label={t("admin.reason")}>{(f) => <Input {...f} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <div className="flex flex-wrap items-end gap-2">
          {u.status === "ACTIVE" ? (
            <>
              <Field label={t("admin.days")} className="w-24">
                {(f) => <Input {...f} type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} />}
              </Field>
              <Button variant="danger" onClick={() => void act({ action: "suspend", days, reason })}>{t("admin.suspend")}</Button>
            </>
          ) : u.status === "SUSPENDED" ? (
            <Button variant="secondary" onClick={() => void act({ action: "unsuspend", reason })}>{t("admin.unsuspend")}</Button>
          ) : null}
          {isAdmin && (u.status === "BANNED" ? (
            <Button variant="secondary" onClick={() => void act({ action: "unban", reason })}>{t("admin.unban")}</Button>
          ) : (
            <Button variant="danger" onClick={() => void act({ action: "ban", reason })}>{t("admin.ban")}</Button>
          ))}
        </div>
        {isAdmin && (
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <div className="flex items-end gap-2">
              <Field label={t("admin.role")} className="flex-1">
                {(f) => (
                  <Select {...f} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <option value="USER">USER</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </Select>
                )}
              </Field>
              <Button variant="secondary" disabled={role === u.role} onClick={() => void act({ action: "setRole", role })}>{t("common.save")}</Button>
            </div>
            <div className="flex items-end gap-2">
              <Field label={t("admin.quota")} className="flex-1">
                {(f) => <Input {...f} type="number" min={0} value={quota} onChange={(e) => setQuota(Number(e.target.value))} />}
              </Field>
              <Button variant="secondary" onClick={() => void act({ action: "setQuota", quotaMb: quota })}>{t("common.save")}</Button>
            </div>
            <div className="flex items-end">
              <Button variant="secondary" disabled={!u.strikeCount} onClick={() => void act({ action: "clearStrikes" })}>{t("admin.clearStrikes")}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Users() {
  const t = useT();
  const { formatDate } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(status ? { status } : {}), ...(role ? { role } : {}) });
  const { data, error, loading, reload } = useApi<Paged<AdminUser>>(`/admin/users?${qs}`);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input aria-label={t("common.search")} placeholder={t("common.search")} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="h-10 w-64" />
        <Select aria-label={t("admin.status")} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="h-10 w-44">
          <option value="">{t("admin.status")}: {t("admin.any")}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="BANNED">BANNED</option>
        </Select>
        <Select aria-label={t("admin.role")} value={role} onChange={(e) => (setRole(e.target.value), setPage(1))} className="h-10 w-44">
          <option value="">{t("admin.role")}: {t("admin.any")}</option>
          <option value="USER">USER</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </Select>
      </div>
      {!data ? (
        <PageState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-3 py-2">{t("auth.username")}</th>
                  <th className="px-3 py-2">{t("admin.status")}</th>
                  <th className="px-3 py-2">{t("admin.role")}</th>
                  <th className="px-3 py-2">{t("admin.tracks")}</th>
                  <th className="px-3 py-2">{t("settings.storage")}</th>
                  <th className="px-3 py-2">{t("track.added")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-t border-line bg-surface">
                    <td className="px-3 py-2">
                      <Link href={`/u/${u.username}`} className="flex items-center gap-2 hover:underline">
                        <Avatar src={u.avatarUrl} name={u.displayName} size={26} />
                        <span className="min-w-0">
                          <span className="block truncate">{u.displayName}</span>
                          <span className="block truncate text-xs text-subtle">@{u.username} · {u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
                      {u.strikeCount > 0 && <span className="ml-1 text-xs text-warning">⚑{u.strikeCount}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">{u.role}</td>
                    <td className="px-3 py-2 tabular-nums">{u.trackCount}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-muted">{formatBytes(u.storageUsedBytes)} / {formatBytes(u.storageQuotaBytes)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>{t("nav.manage")}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>{t("common.back")}</Button>
            <Button size="sm" variant="secondary" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
          </div>
        </>
      )}
      {editing && (
        <UserActions
          u={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function Genres() {
  const t = useT();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ items: Genre[] }>("/admin/genres");
  const [form, setForm] = useState({ name: "", slug: "", color: "#008CFF" });
  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const patch = async (g: Genre, body: Partial<Genre>) => {
    setData({ items: data.items.map((x) => (x.id === g.id ? { ...x, ...body } : x)) });
    try {
      await api(`/admin/genres/${g.id}`, { method: "PATCH", body });
    } catch (e) {
      toast((e as Error).message, "error");
      void reload();
    }
  };
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/admin/genres", { body: { ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } });
            setForm({ name: "", slug: "", color: "#008CFF" });
            void reload();
          } catch (err) {
            toast((err as Error).message, "error");
          }
        }}
      >
        <Field label={t("admin.newGenre")}>{(f) => <Input {...f} value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label={t("admin.slug")}>{(f) => <Input {...f} value={form.slug} placeholder="auto" onChange={(e) => setForm({ ...form, slug: e.target.value })} />}</Field>
        <label className="text-[13px] text-muted">
          {t("admin.color")}
          <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1.5 block h-11 w-14 rounded-lg border border-line bg-transparent" />
        </label>
        <Button type="submit" disabled={!form.name.trim()}>
          <Plus size={16} /> {t("common.create")}
        </Button>
      </form>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((g) => (
          <li key={g.id} className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2", !g.active && "opacity-60")}>
            <input type="color" aria-label={`${g.name} ${t("admin.color")}`} value={g.color} onChange={(e) => void patch(g, { color: e.target.value.toUpperCase() })} className="h-8 w-8 rounded-md border border-line bg-transparent" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{g.name}</div>
              <div className="text-xs text-subtle">/{g.slug} · {t("common.tracks", { count: g.trackCount })}</div>
            </div>
            <div className="w-28">
              <Switch checked={g.active} onChange={(v) => void patch(g, { active: v })} label={t("admin.active")} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminInner() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("overview");
  const tabs: [Tab, string][] = [
    ["overview", t("admin.overview")],
    ["users", t("admin.users")],
    ["genres", t("admin.genres")],
    ["audit", t("mod.audit")],
  ];
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight">
        <ShieldCheck size={26} className="text-primary" /> {t("admin.title")}
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
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users />}
      {tab === "genres" && <Genres />}
      {tab === "audit" && <AuditLog />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth role="ADMIN">
      <AdminInner />
    </RequireAuth>
  );
}
