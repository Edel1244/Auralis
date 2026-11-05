"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Upload, SlidersHorizontal, Disc3, Palette, Code2 } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { LanguageSelect } from "@/components/settings/LanguageSelect";

const FEATURES = [
  { icon: Upload, title: "landing.featureUploadTitle", body: "landing.featureUploadBody" },
  { icon: SlidersHorizontal, title: "landing.featurePlayerTitle", body: "landing.featurePlayerBody" },
  { icon: Disc3, title: "landing.featureStudioTitle", body: "landing.featureStudioBody" },
  { icon: Palette, title: "landing.featureThemeTitle", body: "landing.featureThemeBody" },
] as const;

/** Decorative animated equalizer used in the hero. */
function HeroBars() {
  const heights = [30, 55, 80, 45, 95, 65, 40, 85, 60, 35, 75, 50, 90, 42, 68, 30, 58, 82, 46, 70];
  return (
    <div className="flex h-40 items-end gap-1.5" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="au-eq-bar w-2.5 rounded-full bg-gradient-to-t from-primary to-accent"
          style={{ height: `${h}%`, animationDelay: `${(i % 7) * 0.11}s`, animationDuration: `${0.8 + (i % 5) * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function Landing() {
  const t = useT();
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <header className="relative mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Logo size={34} />
        <div className="flex items-center gap-3">
          <LanguageSelect compact />
          <Link href="/login" className="hidden text-sm font-semibold text-muted hover:text-fg sm:block">
            {t("nav.login")}
          </Link>
          <Button size="sm" onClick={() => router.push("/register")}>
            {t("nav.register")}
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6">
        <section className="grid items-center gap-12 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <LogoMark size={16} /> {t("brand.tagline")}
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">{t("landing.heroSubtitle")}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push("/register")}>
                {t("landing.ctaStart")}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => router.push("/home")}>
                {t("nav.explore")}
              </Button>
            </div>
            <Link href="/login" className="mt-5 inline-block text-sm text-muted hover:text-fg">
              {t("landing.ctaLogin")} →
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center"
          >
            <div className="absolute inset-6 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute inset-0 rounded-[40px] border border-line bg-surface/50 backdrop-blur-xl" />
            <div className="relative flex flex-col items-center gap-8">
              <LogoMark size={120} animated />
              <HeroBars />
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="rounded-[var(--radius-card)] border border-line bg-surface/70 p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon size={21} />
              </div>
              <h3 className="font-display font-semibold">{t(title)}</h3>
              <p className="mt-2 text-sm text-muted">{t(body)}</p>
            </motion.div>
          ))}
        </section>

        <section className="mb-20 flex flex-col items-start justify-between gap-6 rounded-3xl border border-line bg-surface/70 p-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold">{t("landing.openSource")}</h2>
            <p className="mt-2 max-w-xl text-muted">{t("landing.openSourceBody")}</p>
          </div>
          <Link href="/about">
            <Button variant="outline" size="lg">
              <Code2 size={18} /> {t("nav.about")}
            </Button>
          </Link>
        </section>
      </main>
      <footer className="relative border-t border-line py-8 text-center text-xs text-subtle">
        AURALIS · AGPL-3.0 · {t("about.copyright").split(".")[0]}.
      </footer>
    </div>
  );
}
