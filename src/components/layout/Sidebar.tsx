"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus, ListMusic } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/ThemeProvider";
import { useLibrary } from "@/state/library";
import { Cover } from "@/components/ui/misc";
import { NAV, SECONDARY_NAV, canSee, type NavItem } from "./nav";

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/settings" && pathname.startsWith(href + "/"));
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? t(item.label) : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-[calc(0.5rem*var(--density))] text-sm font-medium transition-colors",
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />}
      <Icon size={19} className={cn("shrink-0", active && "text-primary")} />
      {!collapsed && <span className="truncate">{t(item.label)}</span>}
    </Link>
  );
}

export function Sidebar() {
  const t = useT();
  const { user } = useSession();
  const { theme, setTheme } = useTheme();
  const { playlists, createPlaylist } = useLibrary();
  const collapsed = theme.sidebar === "collapsed";
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-line bg-surface/60 md:flex",
        collapsed ? "w-[76px]" : "w-[var(--sidebar-width)]",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex h-16 items-center px-5", collapsed ? "justify-center px-0" : "justify-between")}>
        <Link href="/home" aria-label="AURALIS home">
          {collapsed ? <LogoMark size={30} /> : <Logo />}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setTheme({ sidebar: "collapsed" })}
            className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"
            aria-label={t("nav.collapse")}
            title={t("nav.collapse")}
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {collapsed && (
          <button
            onClick={() => setTheme({ sidebar: "expanded" })}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
            aria-label={t("nav.expand")}
            title={t("nav.expand")}
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        {NAV.map((group) => {
          const items = group.items.filter((i) => canSee(i, user) && (!i.auth || user || group.label !== "nav.manage"));
          if (!items.length || (group.label === "nav.manage" && !user)) return null;
          return (
            <div key={group.label}>
              {!collapsed && (
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  {t(group.label)}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((i) => (
                  <NavLink key={i.href} item={i} collapsed={collapsed} />
                ))}
              </div>
            </div>
          );
        })}

        {user && (
          <div>
            {!collapsed && (
              <div className="mb-1.5 flex items-center justify-between px-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">{t("nav.playlists")}</span>
                <button
                  onClick={() => void createPlaylist()}
                  className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg"
                  aria-label={t("nav.newPlaylist")}
                  title={t("nav.newPlaylist")}
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
            <div className="space-y-0.5">
              {playlists.map((p) => {
                const href = `/playlist/${p.id}`;
                const active = pathname === href;
                return (
                  <Link
                    key={p.id}
                    href={href}
                    title={p.title}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors",
                      active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {p.coverUrl || p.coverMosaic.length ? (
                      <Cover src={p.coverUrl} mosaic={p.coverMosaic} seed={p.id} className="w-8 shrink-0" rounded="rounded-md" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">
                        <ListMusic size={15} />
                      </span>
                    )}
                    {!collapsed && <span className="truncate">{p.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {SECONDARY_NAV.filter((i) => canSee(i, user) && (!i.auth || user)).map((i) => (
          <NavLink key={i.href} item={i} collapsed={collapsed} />
        ))}
      </div>
    </aside>
  );
}
