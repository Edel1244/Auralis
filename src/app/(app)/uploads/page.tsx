"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Trash2, Upload, Play, FolderOpen } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { formatBytes, formatMs } from "@/lib/format";
import { PageState } from "@/components/ui/PageState";
import { Badge, Cover, EmptyState, Switch } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePlayer } from "@/player/PlayerProvider";
import type { Album, Genre, Paged, Track, Visibility } from "@/lib/types";

function EditTrack({ track, onClose, onSaved }: { track: Track; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const toast = useToast();
  const genres = useApi<{ items: Genre[] }>("/genres");
  const albums = useApi<{ own: Album[] }>("/me/albums");
  const [form, setForm] = useState({
    title: track.title,
    artistName: track.artistName,
    description: track.description,
    genreId: track.genre?.id ?? "",
    albumId: track.album?.id ?? "",
    tags: track.tags.join(", "),
    visibility: track.visibility,
    explicit: track.explicit,
    commentsEnabled: track.commentsEnabled,
    releaseDate: track.releaseDate?.slice(0, 10) ?? "",
    licenseNote: track.licenseNote,
  });
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={t("common.edit")}
      size="lg"
      footer={
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api(`/tracks/${track.id}`, {
                method: "PATCH",
                body: {
                  ...form,
                  genreId: form.genreId || null,
                  albumId: form.albumId || null,
                  releaseDate: form.releaseDate || null,
                  tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
                },
              });
              if (cover) {
                const f = new FormData();
                f.append("file", cover);
                await api(`/tracks/${track.id}/cover`, { form: f });
              }
              toast(t("common.saved"), "success");
              onSaved();
              onClose();
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          {t("common.save")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("track.title")}>{(f) => <Input {...f} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label={t("track.artist")}>{(f) => <Input {...f} maxLength={120} value={form.artistName} onChange={(e) => setForm({ ...form, artistName: e.target.value })} />}</Field>
        <Field label={t("upload.genre")}>
          {(f) => (
            <Select {...f} value={form.genreId} onChange={(e) => setForm({ ...form, genreId: e.target.value })}>
              <option value="">—</option>
              {genres.data?.items.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("track.album")}>
          {(f) => (
            <Select {...f} value={form.albumId} onChange={(e) => setForm({ ...form, albumId: e.target.value })}>
              <option value="">—</option>
              {albums.data?.own.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("upload.visibility")}>
          {(f) => (
            <Select {...f} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}>
              <option value="PUBLIC">{t("common.public")}</option>
              <option value="UNLISTED">{t("common.unlisted")}</option>
              <option value="PRIVATE">{t("common.private")}</option>
            </Select>
          )}
        </Field>
        <Field label={t("upload.releaseDate")}>{(f) => <Input {...f} type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />}</Field>
        <Field label={`${t("upload.tags")} (${t("upload.tagsHint")})`} className="sm:col-span-2">
          {(f) => <Input {...f} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />}
        </Field>
        <Field label={t("upload.description")} className="sm:col-span-2">
          {(f) => <Textarea {...f} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <Field label={t("upload.licenseNote")} className="sm:col-span-2">
          {(f) => <Input {...f} maxLength={500} value={form.licenseNote} onChange={(e) => setForm({ ...form, licenseNote: e.target.value })} />}
        </Field>
        <Field label={t("upload.artwork")}>
          {(f) => <Input {...f} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="pt-2" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />}
        </Field>
        <div>
          <Switch checked={form.explicit} onChange={(v) => setForm({ ...form, explicit: v })} label={t("upload.explicit")} />
          <Switch checked={form.commentsEnabled} onChange={(v) => setForm({ ...form, commentsEnabled: v })} label={t("upload.allowComments")} />
        </div>
      </div>
    </Modal>
  );
}

function UploadsInner() {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const player = usePlayer();
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useApi<Paged<Track> & { storage: { used: number; quota: number } }>(
    `/me/tracks?limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}`,
  );
  const [deleting, setDeleting] = useState<Track | null>(null);
  const editId = params.get("edit");
  const editing = data?.items.find((x) => x.id === editId) ?? null;

  // Refresh while anything is still processing.
  useEffect(() => {
    if (!data?.items.some((x) => x.status === "PROCESSING")) return;
    const id = setTimeout(() => void reload(), 2000);
    return () => clearTimeout(id);
  }, [data, reload]);

  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const pct = Math.min(100, (data.storage.used / data.storage.quota) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("upload.manageTitle")}</h1>
          <div className="mt-3 w-72">
            <div className="mb-1 text-xs text-muted">
              {t("upload.quota", { used: formatBytes(data.storage.used), total: formatBytes(data.storage.quota) })}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={pct > 90 ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Input aria-label={t("common.search")} placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-56" />
          <Link href="/upload">
            <Button>
              <Upload size={16} /> {t("nav.upload")}
            </Button>
          </Link>
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={<FolderOpen size={26} />} title={t("upload.manageEmpty")} action={<Link href="/upload"><Button>{t("nav.upload")}</Button></Link>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {data.items.map((tr) => (
            <div key={tr.id} className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-0">
              <IconButton label={t("player.play")} size="sm" disabled={tr.status !== "READY"} onClick={() => player.playTracks([tr], 0, tr.title)}>
                <Play size={15} fill="currentColor" />
              </IconButton>
              <Cover src={tr.coverUrl} seed={tr.id} className="w-11 shrink-0" rounded="rounded-md" />
              <div className="min-w-0 flex-1">
                <Link href={`/track/${tr.id}`} className="block truncate text-sm font-medium hover:underline">
                  {tr.title}
                </Link>
                <div className="truncate text-xs text-muted">
                  {tr.artistName} · {formatMs(tr.durationMs)} · {formatBytes(tr.sizeBytes)} · {formatDate(tr.createdAt)}
                </div>
                {tr.statusReason && <div className="text-xs text-danger">{tr.statusReason}</div>}
              </div>
              <div className="hidden flex-wrap gap-1 sm:flex">
                <Badge tone={tr.status === "READY" ? "success" : tr.status === "PROCESSING" ? "warning" : "danger"}>{tr.status}</Badge>
                <Badge>{tr.visibility}</Badge>
              </div>
              <span className="hidden w-20 text-right text-xs tabular-nums text-subtle md:block">{t("common.plays", { count: tr.playCount })}</span>
              <IconButton label={t("common.edit")} size="sm" onClick={() => router.replace(`/uploads?edit=${tr.id}`, { scroll: false })}>
                <Pencil size={15} />
              </IconButton>
              <IconButton label={t("common.delete")} size="sm" onClick={() => setDeleting(tr)}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      {editing && <EditTrack track={editing} onClose={() => router.replace("/uploads", { scroll: false })} onSaved={() => void reload()} />}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t("common.delete")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api(`/tracks/${deleting!.id}`, { method: "DELETE" });
                  setDeleting(null);
                  void reload();
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            >
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{deleting && t("upload.deleteConfirm", { title: deleting.title })}</p>
      </Modal>
    </div>
  );
}

export default function UploadsPage() {
  return (
    <RequireAuth>
      <Suspense>
        <UploadsInner />
      </Suspense>
    </RequireAuth>
  );
}
