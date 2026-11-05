import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark size={72} />
      <h1 className="font-display text-3xl font-bold">404</h1>
      <p className="max-w-sm text-muted">This page doesn&apos;t exist, or the content was removed.</p>
      <Link href="/home" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
        AURALIS
      </Link>
    </div>
  );
}
