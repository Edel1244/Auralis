import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <header className="relative flex h-20 items-center px-6 md:px-10">
        <Link href="/" aria-label="AURALIS home">
          <Logo size={34} />
        </Link>
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center">
        <div className="w-full max-w-[420px] rounded-3xl border border-line bg-surface/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
          {children}
        </div>
      </main>
    </div>
  );
}
