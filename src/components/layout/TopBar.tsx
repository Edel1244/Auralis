"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, User, Settings, LogOut, Palette, Bell } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { Avatar } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";
import { api } from "@/lib/api";

function UserMenu() {
  const { user, logout } = useSession();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!user) return null;
  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-surface p-0.5 pr-3 hover:bg-surface-2"
      >
        <Avatar src={user.avatarUrl} name={user.displayName} size={30} />
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user.displayName}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-line bg-elevated p-1.5 shadow-2xl">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.displayName}</div>
            <div className="truncate text-xs text-subtle">@{user.username}</div>
          </div>
          <Link role="menuitem" href={`/u/${user.username}`} className={item} onClick={() => setOpen(false)}>
            <User size={16} /> {t("nav.profile")}
          </Link>
          <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}>
            <Settings size={16} /> {t("nav.settings")}
          </Link>
          <Link role="menuitem" href="/settings/appearance" className={item} onClick={() => setOpen(false)}>
            <Palette size={16} /> {t("nav.appearance")}
          </Link>
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            className={item}
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push("/login");
            }}
          >
            <LogOut size={16} /> {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { user } = useSession();
  const t = useT();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      api<{ unread: number }>("/notifications/unread-count")
        .then((r) => alive && setUnread(r.unread))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user]);
  if (!user) return null;
  return (
    <Link
      href="/notifications"
      aria-label={t("nav.notifications")}
      title={t("nav.notifications")}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
    >
      <Bell size={19} />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function TopBar() {
  const t = useT();
  const router = useRouter();
  const { status } = useSession();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-bg/70 px-4 backdrop-blur-xl md:px-6">
      <Link href="/home" className="md:hidden" aria-label="AURALIS home">
        <LogoMark size={30} />
      </Link>
      <div className="hidden gap-1 md:flex">
        <IconButton label={t("common.back")} size="sm" onClick={() => router.back()} className="bg-surface">
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label={t("common.next")} size="sm" onClick={() => router.forward()} className="bg-surface">
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <button
        onClick={() => router.push("/search")}
        className="flex h-10 max-w-md flex-1 items-center gap-2.5 rounded-full border border-line bg-surface px-4 text-left text-sm text-subtle transition-colors hover:border-primary/50"
      >
        <Search size={17} />
        <span className="truncate">{t("search.placeholder")}</span>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {status === "authenticated" && <NotificationBell />}
        {status === "authenticated" && <UserMenu />}
        {status === "anonymous" && (
          <>
            <Link href="/register" className="hidden text-sm font-semibold text-muted hover:text-fg sm:block">
              {t("nav.register")}
            </Link>
            <Button size="sm" onClick={() => router.push("/login")}>
              {t("nav.login")}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
