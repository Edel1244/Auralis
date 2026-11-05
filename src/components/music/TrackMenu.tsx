"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, ListPlus, ListStart, Plus, Disc, User, Link2, Flag, Pencil, Trash2, Check } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useLibrary } from "@/state/library";
import { useSession } from "@/state/session";
import { usePlayer } from "@/player/PlayerProvider";
import { useToast } from "@/components/ui/Toast";
import { IconButton } from "@/components/ui/Button";
import type { Track } from "@/lib/types";
import { ReportDialog } from "./ReportDialog";

/** Contextual actions for a track. Rendered in a portal so it never gets clipped. */
export function TrackMenu({ track, onRemove, removeLabel }: { track: Track; onRemove?: () => void; removeLabel?: string }) {
  const t = useT();
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const { user } = useSession();
  const player = usePlayer();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(false);
  const [report, setReport] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", () => setOpen(false), { once: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = () => {
    const r = btn.current!.getBoundingClientRect();
    const w = 240;
    setPos({ x: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), y: Math.min(window.innerHeight - 380, r.bottom + 6) });
    setSub(false);
    setOpen((v) => !v);
  };
  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg";
  const editable = playlists.filter((p) => p.isOwner || p.isCollaborative);
  const playable = track.status === "READY";

  return (
    <>
      <IconButton ref={btn} label={t("common.more")} size="sm" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        <MoreHorizontal size={18} />
      </IconButton>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            className="fixed z-[95] w-60 rounded-2xl border border-line bg-elevated p-1.5 shadow-2xl"
            style={{ left: pos.x, top: Math.max(8, pos.y) }}
          >
            {sub ? (
              <div className="max-h-72 overflow-y-auto">
                <button className={item} onClick={() => setSub(false)}>
                  ← {t("common.back")}
                </button>
                <button
                  className={item}
                  onClick={async () => {
                    setOpen(false);
                    const p = await createPlaylist(undefined, false);
                    if (p) await addToPlaylist(p.id, [track.id]);
                  }}
                >
                  <Plus size={16} /> {t("playlist.create")}
                </button>
                {editable.map((p) => (
                  <button
                    key={p.id}
                    className={item}
                    onClick={() => {
                      setOpen(false);
                      void addToPlaylist(p.id, [track.id]);
                    }}
                  >
                    <Check size={16} className="opacity-0" /> <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {playable && (
                  <>
                    <button className={item} onClick={() => (player.enqueueNext([track]), setOpen(false), toast(t("player.playNext")))}>
                      <ListStart size={16} /> {t("player.playNext")}
                    </button>
                    <button className={item} onClick={() => (player.enqueue([track]), setOpen(false), toast(t("player.addToQueue")))}>
                      <ListPlus size={16} /> {t("player.addToQueue")}
                    </button>
                  </>
                )}
                {user && playable && (
                  <button className={item} onClick={() => setSub(true)}>
                    <Plus size={16} /> {t("track.addToPlaylist")} →
                  </button>
                )}
                {onRemove && (
                  <button className={item} onClick={() => (setOpen(false), onRemove())}>
                    <Trash2 size={16} /> {removeLabel ?? t("playlist.removeTrack")}
                  </button>
                )}
                <div className="my-1 h-px bg-line" />
                {track.album && (
                  <Link className={item} href={`/album/${track.album.id}`} onClick={() => setOpen(false)}>
                    <Disc size={16} /> {t("track.goToAlbum")}
                  </Link>
                )}
                <Link className={item} href={`/u/${track.owner.username}`} onClick={() => setOpen(false)}>
                  <User size={16} /> {t("track.goToArtist")}
                </Link>
                <button
                  className={item}
                  onClick={async () => {
                    setOpen(false);
                    await navigator.clipboard?.writeText(`${location.origin}/track/${track.id}`).catch(() => {});
                    toast(t("common.linkCopied"), "success");
                  }}
                >
                  <Link2 size={16} /> {t("common.copyLink")}
                </button>
                {user?.id === track.owner.id ? (
                  <Link className={item} href={`/uploads?edit=${track.id}`} onClick={() => setOpen(false)}>
                    <Pencil size={16} /> {t("common.edit")}
                  </Link>
                ) : (
                  user && (
                    <button className={item} onClick={() => (setOpen(false), setReport(true))}>
                      <Flag size={16} /> {t("common.report")}
                    </button>
                  )
                )}
              </>
            )}
          </div>,
          document.body,
        )}
      <ReportDialog open={report} onClose={() => setReport(false)} targetType="TRACK" targetId={track.id} />
    </>
  );
}
