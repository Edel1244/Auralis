import "server-only";
import type { ReportTarget } from "@prisma/client";
import { db } from "../../db";
import { mediaUrl } from "../users/dto";

export type TargetPreview = { type: ReportTarget; id: string; title: string; subtitle: string; href: string | null; imageUrl: string | null; state: string } | null;

/** Batch-loads short previews of reported content for the moderation queue. */
export async function previewTargets(items: { targetType: ReportTarget; targetId: string }[]) {
  const ids = (t: ReportTarget) => [...new Set(items.filter((i) => i.targetType === t).map((i) => i.targetId))];
  const [tracks, albums, playlists, users, comments, themes] = await Promise.all([
    db.track.findMany({ where: { id: { in: ids("TRACK") } }, include: { owner: { select: { username: true } } } }),
    db.album.findMany({ where: { id: { in: ids("ALBUM") } }, include: { owner: { select: { username: true } } } }),
    db.playlist.findMany({ where: { id: { in: ids("PLAYLIST") } }, include: { owner: { select: { username: true } } } }),
    db.user.findMany({ where: { id: { in: ids("USER") } } }),
    db.comment.findMany({ where: { id: { in: ids("COMMENT") } }, include: { user: { select: { username: true } } } }),
    db.theme.findMany({ where: { id: { in: ids("THEME") } }, include: { author: { select: { username: true } } } }),
  ]);
  const map = new Map<string, TargetPreview>();
  tracks.forEach((t) => map.set(`TRACK:${t.id}`, { type: "TRACK", id: t.id, title: t.title, subtitle: `${t.artistName} · @${t.owner.username}`, href: `/track/${t.id}`, imageUrl: mediaUrl(t.coverKey), state: t.status }));
  albums.forEach((a) => map.set(`ALBUM:${a.id}`, { type: "ALBUM", id: a.id, title: a.title, subtitle: `@${a.owner.username}`, href: `/album/${a.id}`, imageUrl: mediaUrl(a.coverKey), state: a.visibility }));
  playlists.forEach((p) => map.set(`PLAYLIST:${p.id}`, { type: "PLAYLIST", id: p.id, title: p.title, subtitle: `@${p.owner.username}`, href: `/playlist/${p.id}`, imageUrl: mediaUrl(p.coverKey), state: p.visibility }));
  users.forEach((u) => map.set(`USER:${u.id}`, { type: "USER", id: u.id, title: u.displayName, subtitle: `@${u.username} · ${u.role}`, href: `/u/${u.username}`, imageUrl: mediaUrl(u.avatarKey), state: u.status }));
  comments.forEach((c) => map.set(`COMMENT:${c.id}`, { type: "COMMENT", id: c.id, title: c.body.slice(0, 160), subtitle: `@${c.user.username}`, href: `/track/${c.trackId}`, imageUrl: null, state: c.deletedAt ? "DELETED" : "VISIBLE" }));
  themes.forEach((t) => map.set(`THEME:${t.id}`, { type: "THEME", id: t.id, title: t.name, subtitle: `@${t.author.username}`, href: "/themes", imageUrl: null, state: t.isPublic ? "PUBLIC" : "PRIVATE" }));
  return (type: ReportTarget, id: string) => map.get(`${type}:${id}`) ?? null;
}
