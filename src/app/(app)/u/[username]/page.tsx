"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Flag, Play, Eye, EyeOff } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { api, ApiClientError } from "@/lib/api";
import { PageState } from "@/components/ui/PageState";
import { Avatar, Badge, EmptyState, SectionHeader, Switch } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TrackList } from "@/components/music/TrackList";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard } from "@/components/music/Cards";
import { ReportDialog } from "@/components/music/ReportDialog";
import { usePlayer } from "@/player/PlayerProvider";
import { useSession } from "@/state/session";
import { cn } from "@/lib/cn";
import type { Album, Me, Playlist, PublicUser, Track } from "@/lib/types";

type Profile = { user: PublicUser; restricted: boolean; isSelf: boolean; isFollowing: boolean; counts: { followers: number; following: number } };
type Content = {
  restricted: boolean;
  tracks: Track[];
  popular: Track[];
  albums: Album[];
  playlists: Playlist[];
  totals: { tracks: number; plays: number; likes: number };
  followers: PublicUser[] | null;
  following: PublicUser[] | null;
  listening: { minutes: number; listens: number } | null;
  recentlyPlayed: Track[] | null;
};
type Tab = "overview" | "uploads" | "playlists" | "albums" | "followers" | "following";

function EditProfile({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (u: Me) => void }) {
  const t = useT();
  const toast = useToast();
  const { user } = useSession();
  const [form, setForm] = useState({ displayName: user!.displayName, bio: user!.bio, username: user!.username, isArtist: user!.isArtist });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const upload = async (kind: "avatar" | "banner", file: File | undefined) => {
    if (!file) return;
    const f = new FormData();
    f.append("file", file);
    try {
      const r = await api<{ user: Me }>(`/me/images/${kind}`, { form: f });
      onSaved(r.user);
      toast(t("common.saved"), "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("profile.editProfile")}
      footer={
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            setErrors({});
            try {
              const r = await api<{ user: Me }>("/me/profile", { method: "PATCH", body: form });
              onSaved(r.user);
              onClose();
            } catch (e) {
              if (e instanceof ApiClientError) setErrors(e.fieldErrors());
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
        <div className="grid grid-cols-2 gap-3">
          <label className="cursor-pointer rounded-xl border border-dashed border-line p-3 text-center text-sm text-muted hover:border-primary">
            {t("profile.avatar")}
            <input type="file" accept="image/*" hidden onChange={(e) => void upload("avatar", e.target.files?.[0])} />
          </label>
          <label className="cursor-pointer rounded-xl border border-dashed border-line p-3 text-center text-sm text-muted hover:border-primary">
            {t("profile.banner")}
            <input type="file" accept="image/*" hidden onChange={(e) => void upload("banner", e.target.files?.[0])} />
          </label>
        </div>
        <Field label={t("auth.displayName")} error={errors.displayName}>
          {(f) => <Input {...f} maxLength={50} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}
        </Field>
        <Field label={t("auth.username")} error={errors.username} hint={t("auth.usernameHint")}>
          {(f) => <Input {...f} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />}
        </Field>
        <Field label={t("profile.bio")} error={errors.bio}>
          {(f) => <Textarea {...f} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />}
        </Field>
        <Switch checked={form.isArtist} onChange={(v) => setForm({ ...form, isArtist: v })} label={t("nav.artistDashboard")} description="Artist mode" />
      </div>
    </Modal>
  );
}

export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = use(params);
  const t = useT();
  const { formatDate, formatNumber } = useI18n();
  const router = useRouter();
  const player = usePlayer();
  const { user: me, setUser } = useSession();
  const profile = useApi<Profile>(`/users/${username}`);
  // Owners can preview their profile exactly as visitors see it (no private/unlisted items).
  const [visitorView, setVisitorView] = useState(false);
  const content = useApi<Content>(`/users/${username}/content${visitorView ? "?view=public" : ""}`);
  const [tab, setTab] = useState<Tab>("overview");
  const [edit, setEdit] = useState(false);
  const [report, setReport] = useState(false);

  if (!profile.data) return <PageState loading={profile.loading} error={profile.error} onRetry={profile.reload} />;
  const { user, isSelf, isFollowing, counts } = profile.data;
  const c = content.data;

  const tabs: [Tab, string, number | null][] = [
    ["overview", t("profile.stats"), null],
    ["uploads", t("profile.uploads"), c?.totals.tracks ?? null],
    ["playlists", t("nav.playlists"), c?.playlists.length ?? null],
    ["albums", t("nav.albums"), c?.albums.length ?? null],
    ...(c?.followers ? ([["followers", t("profile.followers"), counts.followers]] as [Tab, string, number][]) : []),
    ...(c?.following ? ([["following", t("profile.followingList"), counts.following]] as [Tab, string, number][]) : []),
  ];

  return (
    <div className="space-y-6">
      <header className="-mx-4 -mt-4 md:-mx-6">
        <div
          className="h-44 bg-cover bg-center md:h-60"
          style={{ backgroundImage: user.bannerUrl ? `url(${user.bannerUrl})` : "linear-gradient(120deg, var(--au-primary), var(--au-accent))" }}
        />
        <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-end md:px-6">
          <Avatar src={user.avatarUrl} name={user.displayName} size={136} className="-mt-16 border-4 border-bg shadow-xl" />
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-bold tracking-tight">{user.displayName}</h1>
              {user.isArtist && <Badge tone="primary">Artist</Badge>}
              {user.role !== "USER" && <Badge tone="warning">{user.role}</Badge>}
              {user.isPrivate && <Lock size={16} className="text-subtle" aria-label={t("common.private")} />}
            </div>
            <p className="text-sm text-muted">
              @{user.username} · {t("common.followersCount", { count: counts.followers })} · {counts.following} {t("profile.followingList").toLowerCase()} ·{" "}
              {t("profile.joined", { date: formatDate(user.createdAt, { month: "long", year: "numeric" }) })}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-1">
            {isSelf ? (
              <>
                <Button variant="secondary" onClick={() => setEdit(true)}>
                  <Pencil size={15} /> {t("profile.editProfile")}
                </Button>
                <Button variant={visitorView ? "primary" : "outline"} onClick={() => setVisitorView((v) => !v)} aria-pressed={visitorView}>
                  {visitorView ? <EyeOff size={15} /> : <Eye size={15} />} {visitorView ? t("profile.exitVisitorView") : t("profile.viewAsVisitor")}
                </Button>
              </>
            ) : (
              me && (
                <>
                  <Button
                    variant={isFollowing ? "secondary" : "primary"}
                    onClick={async () => {
                      await api(`/users/${user.username}/follow`, { method: isFollowing ? "DELETE" : "POST" });
                      profile.setData({ ...profile.data!, isFollowing: !isFollowing, counts: { ...counts, followers: counts.followers + (isFollowing ? -1 : 1) } });
                    }}
                  >
                    {isFollowing ? t("profile.following") : t("profile.follow")}
                  </Button>
                  <IconButton label={t("common.report")} onClick={() => setReport(true)}>
                    <Flag size={17} />
                  </IconButton>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {user.bio && <p className="max-w-3xl whitespace-pre-line text-muted">{user.bio}</p>}

      {isSelf && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm",
            visitorView ? "border-primary/40 bg-primary/10 text-fg" : "border-line bg-surface text-muted",
          )}
        >
          {visitorView ? <Eye size={16} className="mt-0.5 shrink-0 text-primary" /> : <Lock size={16} className="mt-0.5 shrink-0" />}
          {visitorView ? t("profile.visitorBanner") : t("profile.ownerHint")}
        </p>
      )}

      {profile.data.restricted || c?.restricted ? (
        <EmptyState icon={<Lock size={26} />} title={t("profile.privateProfile")} />
      ) : !c ? (
        <PageState loading={content.loading} error={content.error} onRetry={content.reload} />
      ) : (
        <>
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map(([key, label, n]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
                  tab === key ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
                )}
              >
                {label} {n !== null && <span className="text-subtle">{n}</span>}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t("profile.uploads"), c.totals.tracks],
                  ["Plays", c.totals.plays],
                  ["Likes", c.totals.likes],
                  ...(c.listening ? [[t("profile.minutesListened"), c.listening.minutes] as [string, number]] : []),
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="font-display text-2xl font-bold">{formatNumber(v as number)}</div>
                    <div className="text-xs text-muted">{k}</div>
                  </div>
                ))}
              </div>
              {c.popular.length > 0 && (
                <section>
                  <SectionHeader
                    title={t("profile.topTracks")}
                    action={
                      <Button size="sm" onClick={() => player.playTracks(c.tracks, 0, user.displayName)}>
                        <Play size={14} fill="currentColor" /> {t("player.play")}
                      </Button>
                    }
                  />
                  <TrackList tracks={c.popular} source={user.displayName} />
                </section>
              )}
              {c.recentlyPlayed && c.recentlyPlayed.length > 0 && (
                <section>
                  <SectionHeader title={t("home.recentlyPlayed")} />
                  <TrackList tracks={c.recentlyPlayed} source={`${user.displayName} · ${t("home.recentlyPlayed")}`} />
                </section>
              )}
              {c.playlists.length > 0 && (
                <section>
                  <SectionHeader title={isSelf && !visitorView ? t("nav.playlists") : t("profile.publicPlaylists")} />
                  <CardGrid>
                    {c.playlists.slice(0, 6).map((p) => (
                      <PlaylistCard key={p.id} playlist={p} />
                    ))}
                  </CardGrid>
                </section>
              )}
              {!c.popular.length && !c.playlists.length && <EmptyState title={t("profile.noUploads")} />}
            </div>
          )}
          {tab === "uploads" &&
            (c.tracks.length ? <TrackList tracks={c.tracks} source={user.displayName} /> : <EmptyState title={t("profile.noUploads")} />)}
          {tab === "playlists" &&
            (c.playlists.length ? (
              <CardGrid>
                {c.playlists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </CardGrid>
            ) : (
              <EmptyState title={t("profile.noPlaylists")} />
            ))}
          {tab === "albums" &&
            (c.albums.length ? (
              <CardGrid>
                {c.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </CardGrid>
            ) : (
              <EmptyState title={t("profile.noUploads")} />
            ))}
          {(tab === "followers" || tab === "following") && (
            <CardGrid>
              {(tab === "followers" ? c.followers : c.following)?.map((u) => (
                <ArtistCard key={u.id} user={u} />
              ))}
            </CardGrid>
          )}
        </>
      )}

      {isSelf && edit && (
        <EditProfile
          open={edit}
          onClose={() => setEdit(false)}
          onSaved={(u) => {
            setUser(u);
            if (u.username !== username) router.replace(`/u/${u.username}`);
            else void profile.reload();
          }}
        />
      )}
      <ReportDialog open={report} onClose={() => setReport(false)} targetType="USER" targetId={user.id} />
    </div>
  );
}
