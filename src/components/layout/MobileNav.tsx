"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { Modal } from "@/components/ui/Modal";
import { MOBILE_NAV, NAV, SECONDARY_NAV, canSee } from "./nav";

export function MobileNav() {
  const t = useT();
  const pathname = usePathname();
  const { user } = useSession();
  const [more, setMore] = useState(false);
  const items = MOBILE_NAV.filter((i) => !i.auth || user);
  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(60px+env(safe-area-inset-bottom))] items-start justify-around border-t border-line bg-bg/90 pt-1.5 backdrop-blur-xl md:hidden"
        aria-label="Main navigation"
      >
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(i.href + "/");
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={cn("flex w-16 flex-col items-center gap-1 text-[10px] font-medium", active ? "text-fg" : "text-subtle")}
            >
              <Icon size={22} className={active ? "text-primary" : undefined} />
              {t(i.label)}
            </Link>
          );
        })}
        <button onClick={() => setMore(true)} className="flex w-16 flex-col items-center gap-1 text-[10px] font-medium text-subtle">
          <Menu size={22} />
          {t("nav.menu")}
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title={t("nav.menu")}>
        <div className="grid grid-cols-2 gap-2">
          {[...NAV.flatMap((g) => g.items), ...SECONDARY_NAV]
            .filter((i) => canSee(i, user) && (!i.auth || user))
            .map((i) => {
              const Icon = i.icon;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setMore(false)}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-3 text-sm font-medium"
                >
                  <Icon size={18} className="text-primary" /> {t(i.label)}
                </Link>
              );
            })}
        </div>
      </Modal>
    </>
  );
}
