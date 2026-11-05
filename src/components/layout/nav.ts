import {
  Home, Compass, Search, Library, Heart, History, Upload, FolderOpen, SlidersHorizontal, Disc3,
  Settings, Info, Bell, BarChart3, ShieldCheck, Gavel, Palette,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/i18n/translate";
import type { Role } from "@/lib/types";

export type NavItem = {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  auth?: boolean; // requires login
  role?: Role; // minimum role
};

export type NavGroup = { label: MessageKey; items: NavItem[] };

/** Single source of truth for navigation. Every entry points at a working page. */
export const NAV: NavGroup[] = [
  {
    label: "nav.discover",
    items: [
      { href: "/home", label: "nav.home", icon: Home },
      { href: "/explore", label: "nav.explore", icon: Compass },
      { href: "/search", label: "nav.search", icon: Search },
    ],
  },
  {
    label: "nav.yourMusic",
    items: [
      { href: "/library", label: "nav.library", icon: Library, auth: true },
      { href: "/favorites", label: "nav.favorites", icon: Heart, auth: true },
      { href: "/history", label: "nav.history", icon: History, auth: true },
    ],
  },
  {
    label: "nav.create",
    items: [
      { href: "/upload", label: "nav.upload", icon: Upload, auth: true },
      { href: "/uploads", label: "nav.uploads", icon: FolderOpen, auth: true },
      { href: "/studio", label: "nav.studio", icon: Disc3 },
      { href: "/equalizer", label: "nav.equalizer", icon: SlidersHorizontal },
    ],
  },
  {
    label: "nav.manage",
    items: [
      { href: "/artist", label: "nav.artistDashboard", icon: BarChart3, auth: true },
      { href: "/moderation", label: "nav.moderation", icon: Gavel, auth: true, role: "MODERATOR" },
      { href: "/admin", label: "nav.admin", icon: ShieldCheck, auth: true, role: "ADMIN" },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/notifications", label: "nav.notifications", icon: Bell, auth: true },
  { href: "/settings/appearance", label: "nav.appearance", icon: Palette },
  { href: "/settings", label: "nav.settings", icon: Settings, auth: true },
  { href: "/about", label: "nav.about", icon: Info },
];

export const MOBILE_NAV: NavItem[] = [
  { href: "/home", label: "nav.home", icon: Home },
  { href: "/search", label: "nav.search", icon: Search },
  { href: "/library", label: "nav.library", icon: Library, auth: true },
  { href: "/upload", label: "nav.upload", icon: Upload, auth: true },
];

const RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };
export function canSee(item: NavItem, user: { role: Role } | null) {
  if (item.role) return Boolean(user && RANK[user.role] >= RANK[item.role]);
  return true;
}
