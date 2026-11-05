"use client";

import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { useT } from "@/i18n/I18nProvider";
import { LanguageSelect } from "@/components/settings/LanguageSelect";
import pkg from "../../../../package.json";

export default function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface/70 p-10 text-center">
        <LogoMark size={96} />
        <Wordmark className="text-2xl" />
        <p className="text-muted">{t("brand.tagline")}</p>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-subtle">{t("about.version", { version: pkg.version })}</span>
      </div>
      <section className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">{t("about.title")}</h1>
        <p className="text-muted">{t("about.body")}</p>
        <p className="text-muted">{t("about.license")}</p>
        <p className="text-sm text-subtle">{t("about.copyright")}</p>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 font-semibold">{t("settings.language")}</h2>
        <p className="mb-4 text-sm text-muted">{t("settings.languageHint")}</p>
        <LanguageSelect />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        <h2 className="mb-2 font-semibold text-fg">{t("player.shortcuts")}</h2>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {[
            ["Space / K", t("player.play") + " / " + t("player.pause")],
            ["← / →", "−5 s / +5 s"],
            ["Shift + ← / →", t("player.previous") + " / " + t("player.next")],
            ["Shift + ↑ / ↓", t("player.volume")],
            ["M", t("player.mute")],
            ["S", t("player.shuffle")],
            ["R", t("player.repeat")],
            ["Q", t("player.queue")],
            ["F", t("player.fullscreen")],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <kbd className="font-mono text-xs text-fg">{k}</kbd>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
