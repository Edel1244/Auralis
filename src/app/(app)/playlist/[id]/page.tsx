"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Shuffle, Pencil, Copy, Trash2, Share2, Users, UserPlus, X, ListMusic } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { formatLength } from "@/lib/format";
import { PageState } from "@/components/ui/PageState";
import { Avatar, Badge, EmptyState, Switch } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { BACKGROUND_PRESETS, backgroundCss, CollectionHeader } from "@/components/music/CollectionHeader";
import { TrackList } from "@/components/music/TrackList";
import { usePlayer } from "@/player/PlayerProvider";
import { useLibrary } from "@/state/library";
import { useSession } from "@/state/session";
import { cn } from "@/lib/cn";
import type { Playlist, Track, UserRef, Visibility } from "@/lib/types";

type Entry = { entryId: string; position: number; addedAt: string; addedBy: UserRef | null; track: Track };
type Data = { playlist: Playlist & { canEdit: boolean }; entries: Entry[]; collaborators: (UserRef & { role: string })[] };
type Sort = "custom" | "title" | "artist" | "added" | "duration";

function EditDialog({ data, open, onClose, onSaved }: { data: Data; open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const toast = useToast();
  const p = data.playlist;
  const [form, setForm] = useState({
    title: p.title,
    description: p.description,
    visibility: p.visibility,
    isCollaborative: p.isCollaborative,
    background: p.background,
  });
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("playlist.editDetails")}
      footer={
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const body: Record<string, unknown> = { title: form.title, description: form.description, background: form.background };
              if (p.isOwner) Object.assign(body, { visibility: form.visibility, isCollaborative: form.isCollaborative });
              await api(`/playlists/${p.id}`, { method: "PATCH", body });
              if (cover) {
                const f = new FormData();
                f.append("file", cover);
                await api(`/playlists/${p.id}/cover`, { form: f });
              }
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
      <div className="space-y-4">
        <Field label={t("track.title")}>{(f) => <Input {...f} maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label={t("upload.description")}>
          {(f) => <Textarea {...f} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <Field label={t("playlist.cover")}>
          {(f) => <Input {...f} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="pt-2" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />}
        </Field>
        <div>
          <div className="mb-2 text-[13px] font-medium text-muted">{t("playlist.background")}</div>
          <div className="flex flex-wrap gap-2">
            {[null, ...BACKGROUND_PRESETS.map((b) => `gradient:${b}`), "#008CFF", "#FF4F8B", "#2FD18A", "#FFB547"].map((b) => (
              <button
                key={b ?? "none"}
                aria-label={b ?? "default"}
                aria-pressed={form.background === b}
                onClick={() => setForm({ ...form, background: b })}
                className={cn("h-9 w-9 rounded-full border-2", form.background === b ? "border-fg" : "border-line")}
                style={{ background: backgroundCss(b) }}
              />
            ))}
          </div>
        </div>
        {p.isOwner && (
          <>
            <Field label={t("upload.visibility")}>
              {(f) => (
                <Select {...f} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}>
                  <option value="PUBLIC">{t("common.public")}</option>
                  <option value="UNLISTED">{t("common.unlisted")}</option>
                  <option value="PRIVATE">{t("common.private")}</option>
                </Select>
              )}
            </Field>
            <Switch checked={form.isCollaborative} onChange={(v) => setForm({ ...form, isCollaborative: v })} label={t("playlist.collaborative")} />
          </>
        )}
      </div>
    </Modal>
  );
}

function CollaboratorsDialog({ data, open, onClose, onChanged }: { data: Data; open: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useT();
  const toast = useToast();
  const [username, setUsername] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={t("playlist.collaborators")}>
      {data.playlist.isOwner && (
        <form
          className="mb-5 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`/playlists/${data.playlist.id}/collaborators`, { body: { username: username.replace(/^@/, "") } });
              setUsername("");
              onChanged();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <Input aria-label={t("playlist.addCollaborator")} placeholder={t("playlist.addCollaborator")} value={username} onChange={(e) => setUsername(e.target.value)} />
          <Button type="submit" disabled={!username.trim()}>
            <UserPlus size={16} />
          </Button>
        </form>
      )}
      <ul className="space-y-2">
        <li className="flex items-center gap-3">
          <Avatar src={data.playlist.owner.avatarUrl} name={data.playlist.owner.displayName} size={32} />
          <span className="flex-1 text-sm">{data.playlist.owner.displayName}</span>
          <Badge tone="primary">Owner</Badge>
        </li>
        {data.collaborators.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <Avatar src={c.avatarUrl} name={c.displayName} size={32} />
            <Link href={`/u/${c.username}`} className="flex-1 text-sm hover:underline">
              {c.displayName}
            </Link>
            <Badge>{c.role}</Badge>
            {data.playlist.isOwner && (
              <IconButton
                label={t("common.delete")}
                size="sm"
                onClick={async () => {
                  await api(`/playlists/${data.playlist.id}/collaborators`, { method: "DELETE", body: { userId: c.id } });
                  onChanged();
                }}
              >
                <X size={15} />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function PlaylistPage({ params }: PageProps<"/playlist/[id]">) {
  const { id } = use(params);
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const player = usePlayer();
  const { user } = useSession();
  const { refreshPlaylists } = useLibrary();
  const { data, error, loading, reload, setData } = useApi<Data>(`/playlists/${id}`);
  const [sort, setSort] = useState<Sort>("custom");
  const [edit, setEdit] = useState(false);
  const [collab, setCollab] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const entries = useMemo(() => {
    if (!data) return [];
    const e = [...data.entries];
    const by: Record<Sort, ((a: Entry, b: Entry) => number) | null> = {
      custom: null,
      title: (a, b) => a.track.title.localeCompare(b.track.title),
      artist: (a, b) => a.track.artistName.localeCompare(b.track.artistName),
      added: (a, b) => b.addedAt.localeCompare(a.addedAt),
      duration: (a, b) => a.track.durationMs - b.track.durationMs,
    };
    return by[sort] ? e.sort(by[sort]!) : e;
  }, [data, sort]);

  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  const p = data.playlist;
  const tracks = entries.map((e) => e.track);

  const reorder = async (from: number, to: number) => {
    const next = [...data.entries];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setData({ ...data, entries: next });
    try {
      await api(`/playlists/${p.id}/tracks`, { method: "PUT", body: { entryIds: next.map((e) => e.entryId) } });
    } catch (e) {
      toast((e as Error).message, "error");
      void reload();
    }
  };

  return (
    <div className="space-y-6">
      <CollectionHeader
        kind={`${t("nav.playlists")}${p.isCollaborative ? " · " + t("playlist.collaborative") : ""}`}
        title={p.title}
        cover={p.coverUrl}
        mosaic={p.coverMosaic}
        seed={p.id}
        background={p.background}
      >
        <Avatar src={p.owner.avatarUrl} name={p.owner.displayName} size={22} />
        <Link href={`/u/${p.owner.username}`} className="font-semibold text-fg hover:underline">
          {p.owner.displayName}
        </Link>
        <span>· {t("common.tracks", { count: p.trackCount })}</span>
        {p.durationMs > 0 && <span>· {formatLength(p.durationMs)}</span>}
        {p.followerCount > 0 && <span>· {t("common.followersCount", { count: p.followerCount })}</span>}
        {p.visibility !== "PUBLIC" && <Badge>{p.visibility === "PRIVATE" ? t("common.private") : t("common.unlisted")}</Badge>}
      </CollectionHeader>
      {p.description && <p className="max-w-3xl whitespace-pre-line text-sm text-muted">{p.description}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={!tracks.length}
          onClick={() => player.playTracks(tracks, 0, p.title)}
          aria-label={t("player.play")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_32px_-10px_var(--au-primary)] transition-transform hover:scale-105 disabled:opacity-40"
        >
          <Play size={24} fill="currentColor" className="translate-x-[1px]" />
        </button>
        <IconButton
          label={t("player.shuffle")}
          size="lg"
          disabled={!tracks.length}
          onClick={() => {
            if (!player.queue.shuffle) player.toggleShuffle();
            player.playTracks(tracks, Math.floor(Math.random() * tracks.length), p.title);
          }}
        >
          <Shuffle size={22} />
        </IconButton>
        {user && !p.isOwner && p.visibility !== "PRIVATE" && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await api(`/playlists/${p.id}/follow`, { method: p.following ? "DELETE" : "POST" });
              setData({ ...data, playlist: { ...p, following: !p.following, followerCount: p.followerCount + (p.following ? -1 : 1) } });
              void refreshPlaylists();
            }}
          >
            {p.following ? t("playlist.unfollow") : t("playlist.follow")}
          </Button>
        )}
        {p.canEdit && (
          <IconButton label={t("playlist.editDetails")} onClick={() => setEdit(true)}>
            <Pencil size={19} />
          </IconButton>
        )}
        {(p.isOwner || p.isCollaborative) && user && (
          <IconButton label={t("playlist.collaborators")} onClick={() => setCollab(true)}>
            <Users size={19} />
          </IconButton>
        )}
        {user && (
          <IconButton
            label={t("playlist.duplicate")}
            onClick={async () => {
              const r = await api<{ playlist: Playlist }>(`/playlists/${p.id}/duplicate`, { method: "POST" });
              void refreshPlaylists();
              router.push(`/playlist/${r.playlist.id}`);
            }}
          >
            <Copy size={19} />
          </IconButton>
        )}
        <IconButton
          label={t("common.share")}
          onClick={async () => {
            await navigator.clipboard?.writeText(`${location.origin}/playlist/${p.id}`);
            toast(t("common.linkCopied"), "success");
          }}
        >
          <Share2 size={19} />
        </IconButton>
        {p.isOwner && (
          <IconButton label={t("playlist.delete")} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={19} />
          </IconButton>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Sort</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 w-auto rounded-full">
            <option value="custom">{t("playlist.sortCustom")}</option>
            <option value="title">{t("playlist.sortTitle")}</option>
            <option value="artist">{t("playlist.sortArtist")}</option>
            <option value="added">{t("playlist.sortAdded")}</option>
            <option value="duration">{t("playlist.sortDuration")}</option>
          </Select>
        </label>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={<ListMusic size={28} />}
          title={t("playlist.empty")}
          body={t("playlist.emptyHint")}
          action={
            <Link href="/search">
              <Button>{t("nav.search")}</Button>
            </Link>
          }
        />
      ) : (
        <TrackList
          tracks={tracks}
          source={p.title}
          showAlbum={false}
          extras={entries.map((e) => ({ addedAt: e.addedAt, key: e.entryId }))}
          onRemove={
            p.canEdit
              ? async (i) => {
                  const entry = entries[i];
                  setData({ ...data, entries: data.entries.filter((e) => e.entryId !== entry.entryId), playlist: { ...p, trackCount: p.trackCount - 1 } });
                  await api(`/playlists/${p.id}/tracks`, { method: "DELETE", body: { entryIds: [entry.entryId] } }).catch(() => reload());
                  void refreshPlaylists();
                }
              : undefined
          }
          onReorder={p.canEdit && sort === "custom" ? (a, b) => void reorder(a, b) : undefined}
        />
      )}

      {edit && <EditDialog data={data} open={edit} onClose={() => setEdit(false)} onSaved={() => (reload(), refreshPlaylists())} />}
      <CollaboratorsDialog data={data} open={collab} onClose={() => setCollab(false)} onChanged={() => void reload()} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("playlist.delete")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api(`/playlists/${p.id}`, { method: "DELETE" });
                await refreshPlaylists();
                router.replace("/library");
              }}
            >
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t("playlist.deleteConfirm", { title: p.title })}</p>
      </Modal>
    </div>
  );
}
