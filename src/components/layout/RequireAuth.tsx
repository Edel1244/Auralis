"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/state/session";
import type { Role } from "@/lib/types";
import { useT } from "@/i18n/I18nProvider";
import { EmptyState } from "@/components/ui/misc";
import { ShieldAlert } from "lucide-react";
import { Splash } from "./Splash";

const RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

/**
 * Client-side gate for pages that need an account. This is UX only — every
 * API endpoint enforces authentication and roles on the server.
 */
export function RequireAuth({ children, role }: { children: React.ReactNode; role?: Role }) {
  const { status, user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);
  if (status !== "authenticated" || !user) return <Splash inline />;
  if (role && RANK[user.role] < RANK[role]) {
    return <EmptyState icon={<ShieldAlert size={28} />} title={t("errors.forbidden")} />;
  }
  return <>{children}</>;
}
