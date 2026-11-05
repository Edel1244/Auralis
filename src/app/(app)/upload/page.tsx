"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, Music2, X, CheckCircle2, AlertTriangle, Loader2, ImagePlus, Disc3 } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Switch, Badge } from "@/components/ui/misc";
import { api, ApiClientError, uploadWithProgress } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatBytes, formatDuration } from "@/lib/format";
import { analyzeFile } from "@/audio/analyzeFile";
import { cn } from "@/lib/cn";
import type { Album, Genre, Track, Visibility } from "@/lib/types";

const ACCEPT = ".mp3,.wav,.flac,.ogg,.oga,.m4a,.aac,audio/*";
const EXT = /\.(mp3|wav|flac|ogg|oga|m4a|aac)$/i;
const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 200);

type Status = "queued" | "analyzing" | "uploading" | "processing" | "done" | "failed";
type Item = {
  key: string;
  file: File;
  title: string;
  artistName: string;
  tags: string;
  explicit: boolean;
  status: Status;
  progress: number;
  error?: string;
  track?: Track;
  duration?: number;
  bpm?: number | null;
};

const stripExt = (n: string) => n.replace(/\.[^.]+$/, "").replace(/_/g, " ").replace(/^\d{1,3}[\s.-]+/, "").trim();

function UploadInner() {
  const t = useT();
  const { user } = useSession();
  const genres = useApi<{ items: Genre[] }>("/genres");
  const quota = useApi<{ storage: { used: number; quota: number } }>("/me/tracks?limit=1");
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [asAlbum, setAsAlbum] = useState(false);
  const [album, setAlbum] = useState({ title: "", artistName: user?.displayName ?? "", releaseDate: "", description: "" });
  const [artwork, setArtwork] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [shared, setShared] = useState({
    genreId: "",
    visibility: "PUBLIC" as Visibility,
    ownership: "ORIGINAL",
    licenseNote: "",
    description: "",
    commentsEnabled: true,
    releaseDate: "",
  });
  const [rights, setRights] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Revoke the preview object URL when it changes or the page unmounts.
  useEffect(() => () => void (artPreview && URL.revokeObjectURL(artPreview)), [artPreview]);
  const chooseArtwork = (file: File | null) => {
    setArtwork(file);
    setArtPreview(file ? URL.createObjectURL(file) : null);
  };

  const update = useCallback((key: string, patch: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const rejected: string[] = [];
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      if (!EXT.test(f.name)) rejected.push(`${f.name}: ${t("upload.unsupported")}`);
      else if (f.size > MAX_MB * 1024 * 1024) rejected.push(`${f.name}: ${t("upload.tooLarge", { size: MAX_MB })}`);
      else
        next.push({
          key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
          file: f,
          title: stripExt(f.name),
          artistName: "",
          tags: "",
          explicit: false,
          status: "queued",
          progress: 0,
        });
    }
    setItems((l) => [...l, ...next].slice(0, 50));
    setNotice(rejected.length ? rejected.join(" · ") : null);
  };

  // Poll processing tracks until they are READY/FAILED.
  useEffect(() => {
    const pending = items.filter((i) => i.status === "processing" && i.track);
    if (!pending.length) return;
    const id = setTimeout(async () => {
      for (const i of pending) {
        try {
          const r = await api<{ track: Track }>(`/tracks/${i.track!.id}`);
          if (r.track.status === "READY") update(i.key, { status: "done", track: r.track });
          else if (r.track.status === "FAILED") update(i.key, { status: "failed", error: r.track.statusReason ?? t("upload.failed") });
        } catch {}
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [items, update, t]);

  async function start() {
    setRunning(true);
    setNotice(null);
    let albumId: string | null = null;
    try {
      if (asAlbum) {
        const form = new FormData();
        form.append(
          "meta",
          JSON.stringify({
            title: album.title,
            artistName: album.artistName || user?.displayName,
            description: album.description,
            genreId: shared.genreId || null,
            releaseDate: album.releaseDate || null,
            visibility: shared.visibility,
          }),
        );
        if (artwork) form.append("cover", artwork);
        const r = await api<{ album: Album }>("/albums", { form });
        albumId = r.album.id;
      }
    } catch (e) {
      setNotice((e as Error).message);
      setRunning(false);
      return;
    }

    const queue = items.filter((i) => i.status === "queued" || i.status === "failed");
    for (const [n, item] of queue.entries()) {
      update(item.key, { status: "analyzing", error: undefined, progress: 0 });
      const analysis = await analyzeFile(item.file);
      update(item.key, { status: "uploading", duration: analysis?.duration, bpm: analysis?.bpm });
      const form = new FormData();
      form.append(
        "meta",
        JSON.stringify({
          title: item.title.trim() || undefined,
          artistName: item.artistName.trim() || (asAlbum ? album.artistName : undefined) || undefined,
          description: shared.description,
          genreId: shared.genreId || null,
          tags: item.tags.split(",").map((s) => s.trim()).filter(Boolean),
          releaseDate: (asAlbum ? album.releaseDate : shared.releaseDate) || null,
          visibility: shared.visibility,
          explicit: item.explicit,
          commentsEnabled: shared.commentsEnabled,
          ownership: shared.ownership,
          licenseNote: shared.licenseNote,
          albumId,
          trackNumber: asAlbum ? n + 1 : null,
          rightsConfirmed: true,
          analysis: analysis ? { waveform: analysis.waveform, loudnessDb: analysis.loudnessDb, bpm: analysis.bpm } : undefined,
        }),
      );
      form.append("audio", item.file);
      if (!asAlbum && artwork) form.append("artwork", artwork);
      try {
        const r = await uploadWithProgress<{ track: Track }>("/uploads", form, (p) => update(item.key, { progress: p }));
        update(item.key, { status: r.track.status === "READY" ? "done" : "processing", track: r.track, progress: 1 });
      } catch (e) {
        const msg = e instanceof ApiClientError && e.code === "CONFLICT" && (e.details as { field?: string })?.field === "duplicate" ? t("upload.duplicate") : (e as Error).message;
        update(item.key, { status: "failed", error: msg });
      }
    }
    setRunning(false);
    void quota.reload();
  }

  const statusIcon = (s: Status) =>
    s === "done" ? (
      <CheckCircle2 size={18} className="text-success" />
    ) : s === "failed" ? (
      <AlertTriangle size={18} className="text-danger" />
    ) : s === "queued" ? (
      <Music2 size={18} className="text-subtle" />
    ) : (
      <Loader2 size={18} className="animate-spin text-primary" />
    );

  const pending = items.filter((i) => i.status === "queued" || i.status === "failed");
  const canStart = pending.length > 0 && rights && !running && (!asAlbum || album.title.trim().length > 0);
  const used = quota.data?.storage.used ?? 0;
  const total = quota.data?.storage.quota ?? 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("upload.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("upload.subtitle")}</p>
        </div>
        {quota.data && (
          <div className="w-64">
            <div className="mb-1 text-xs text-muted">{t("upload.quota", { used: formatBytes(used), total: formatBytes(total) })}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (used / total) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {user && !user.emailVerified && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm">{t("auth.verifyBanner")}</p>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={t("upload.browse")}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          drag ? "border-primary bg-primary/10" : "border-line bg-surface/60 hover:border-primary/60",
        )}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <UploadCloud size={30} />
        </div>
        <p className="font-display text-lg font-semibold">{t("upload.dropTitle")}</p>
        <p className="mt-1 text-sm text-muted">{t("upload.dropSubtitle", { size: MAX_MB })}</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {notice && <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{notice}</p>}

      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-2" aria-label="Files">
            {items.map((i, n) => (
              <div key={i.key} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-2">{statusIcon(i.status)}</div>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input
                      aria-label={t("track.title")}
                      placeholder={t("track.title")}
                      value={i.title}
                      disabled={i.status !== "queued" && i.status !== "failed"}
                      onChange={(e) => update(i.key, { title: e.target.value })}
                    />
                    <Input
                      aria-label={t("track.artist")}
                      placeholder={asAlbum ? album.artistName || t("track.artist") : user?.displayName}
                      value={i.artistName}
                      disabled={i.status !== "queued" && i.status !== "failed"}
                      onChange={(e) => update(i.key, { artistName: e.target.value })}
                    />
                    <Input
                      aria-label={t("upload.tags")}
                      placeholder={`${t("upload.tags")} (${t("upload.tagsHint")})`}
                      value={i.tags}
                      disabled={i.status !== "queued" && i.status !== "failed"}
                      onChange={(e) => update(i.key, { tags: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={i.explicit}
                        disabled={i.status !== "queued" && i.status !== "failed"}
                        onChange={(e) => update(i.key, { explicit: e.target.checked })}
                        className="accent-[var(--au-primary)]"
                      />
                      {t("upload.explicit")}
                    </label>
                  </div>
                  {(i.status === "queued" || i.status === "failed") && !running && (
                    <button
                      onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}
                      aria-label={t("upload.removeFile")}
                      className="rounded-full p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
                  {asAlbum && <Badge>#{n + 1}</Badge>}
                  <span className="truncate">{i.file.name}</span>
                  <span>· {formatBytes(i.file.size)}</span>
                  {i.duration ? <span>· {formatDuration(i.duration)}</span> : null}
                  {i.bpm ? <span>· {i.bpm} BPM</span> : null}
                  <span className="ml-auto font-medium">
                    {i.status === "uploading"
                      ? `${t("upload.uploading")} ${Math.round(i.progress * 100)}%`
                      : i.status === "analyzing" || i.status === "processing"
                        ? t("upload.processing")
                        : i.status === "done"
                          ? t("upload.done")
                          : i.status === "failed"
                            ? t("upload.failed")
                            : ""}
                  </span>
                </div>
                {i.status === "uploading" && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${i.progress * 100}%` }} />
                  </div>
                )}
                {i.error && <p className="mt-2 text-xs text-danger">{i.error}</p>}
                {i.status === "done" && i.track && (
                  <Link href={`/track/${i.track.id}`} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
                    {i.track.title} →
                  </Link>
                )}
              </div>
            ))}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <Switch checked={asAlbum} onChange={setAsAlbum} label={t("upload.asAlbum")} disabled={running} />
              {asAlbum && (
                <div className="mt-2 space-y-3">
                  <Field label={t("upload.albumTitle")}>
                    {(p) => <Input {...p} value={album.title} onChange={(e) => setAlbum({ ...album, title: e.target.value })} />}
                  </Field>
                  <Field label={t("upload.albumArtist")}>
                    {(p) => <Input {...p} value={album.artistName} onChange={(e) => setAlbum({ ...album, artistName: e.target.value })} />}
                  </Field>
                  <Field label={t("upload.releaseDate")}>
                    {(p) => <Input {...p} type="date" value={album.releaseDate} onChange={(e) => setAlbum({ ...album, releaseDate: e.target.value })} />}
                  </Field>
                  <Field label={t("upload.description")}>
                    {(p) => <Textarea {...p} value={album.description} onChange={(e) => setAlbum({ ...album, description: e.target.value })} />}
                  </Field>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <div className="text-sm font-medium text-muted">{t("upload.artwork")}</div>
              <label className="flex cursor-pointer items-center gap-3">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
                  {artPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artPreview} alt="" className="h-full w-full object-cover" />
                  ) : asAlbum ? (
                    <Disc3 size={24} className="text-subtle" />
                  ) : (
                    <ImagePlus size={24} className="text-subtle" />
                  )}
                </span>
                <span className="text-sm font-semibold text-primary">{t("upload.chooseArtwork")}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => chooseArtwork(e.target.files?.[0] ?? null)} />
              </label>
              <Field label={t("upload.genre")}>
                {(p) => (
                  <Select {...p} value={shared.genreId} onChange={(e) => setShared({ ...shared, genreId: e.target.value })}>
                    <option value="">—</option>
                    {genres.data?.items.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {!asAlbum && (
                <Field label={t("upload.releaseDate")}>
                  {(p) => <Input {...p} type="date" value={shared.releaseDate} onChange={(e) => setShared({ ...shared, releaseDate: e.target.value })} />}
                </Field>
              )}
              <Field label={t("upload.visibility")}>
                {(p) => (
                  <Select {...p} value={shared.visibility} onChange={(e) => setShared({ ...shared, visibility: e.target.value as Visibility })}>
                    <option value="PUBLIC">{t("common.public")}</option>
                    <option value="UNLISTED">{t("common.unlisted")}</option>
                    <option value="PRIVATE">{t("common.private")}</option>
                  </Select>
                )}
              </Field>
              {!asAlbum && (
                <Field label={t("upload.description")}>
                  {(p) => <Textarea {...p} value={shared.description} onChange={(e) => setShared({ ...shared, description: e.target.value })} />}
                </Field>
              )}
              <Switch checked={shared.commentsEnabled} onChange={(v) => setShared({ ...shared, commentsEnabled: v })} label={t("upload.allowComments")} />
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <Field label={t("upload.ownership")}>
                {(p) => (
                  <Select {...p} value={shared.ownership} onChange={(e) => setShared({ ...shared, ownership: e.target.value })}>
                    <option value="ORIGINAL">{t("upload.ownershipOriginal")}</option>
                    <option value="LICENSED">{t("upload.ownershipLicensed")}</option>
                    <option value="PUBLIC_DOMAIN">{t("upload.ownershipPublicDomain")}</option>
                    <option value="CREATIVE_COMMONS">{t("upload.ownershipCC")}</option>
                  </Select>
                )}
              </Field>
              {shared.ownership !== "ORIGINAL" && (
                <Field label={t("upload.licenseNote")}>
                  {(p) => <Input {...p} value={shared.licenseNote} maxLength={500} onChange={(e) => setShared({ ...shared, licenseNote: e.target.value })} />}
                </Field>
              )}
              <label className="flex items-start gap-3 text-xs text-muted">
                <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-[var(--au-primary)]" />
                {t("upload.rightsConfirm")}
              </label>
            </div>

            <Button size="lg" className="w-full" disabled={!canStart} loading={running} onClick={() => void start()}>
              {t("upload.start", { count: pending.length })}
            </Button>
            <Link href="/uploads" className="block text-center text-sm text-muted hover:text-fg">
              {t("upload.manageTitle")} →
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadInner />
    </RequireAuth>
  );
}
