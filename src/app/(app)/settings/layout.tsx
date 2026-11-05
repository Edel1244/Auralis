"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { cn } from "@/lib/cn";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const { user } = useSession();
  const tabs = [
    ...(user
      ? [
          { href: "/settings", label: t("settings.account") },
          { href: "/settings/privacy", label: t("settings.privacy") },
        ]
      : []),
    { href: "/settings/appearance", label: t("nav.appearance") },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
      <nav className="flex gap-1 border-b border-line" aria-label={t("settings.title")}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium",
              pathname === tab.href ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
