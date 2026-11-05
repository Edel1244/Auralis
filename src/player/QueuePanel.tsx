"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Cover } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { formatMs } from "@/lib/format";
import { upcoming } from "@/audio/queue";
import { usePlayer } from "./PlayerProvider";

export function QueueList() {
  const p = usePlayer();
  const t = useT();
  const next = upcoming(p.queue);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{t("player.nowPlaying")}</h3>
        {p.current ? (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
            <Cover src={p.current.coverUrl} seed={p.current.id} className="w-11" rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-primary">{p.current.title}</div>
              <div className="truncate text-xs text-muted">{p.current.artistName}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-subtle">{t("player.nothingPlaying")}</p>
        )}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{t("player.upNext")}</h3>
          {next.length > 0 && (
            <button onClick={p.clearUpcoming} className="text-xs font-semibold text-muted hover:text-fg">
              {t("player.clearQueue")}
            </button>
          )}
        </div>
        {next.length === 0 ? (
          <p className="text-sm text-subtle">{t("player.emptyQueue")}</p>
        ) : (
          <ol className="space-y-1">
            {next.map(({ item, position }, i) => (
              <li key={`${item.id}-${position}`} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => p.jumpTo(position)}>
                  <Cover src={item.coverUrl} seed={item.id} className="w-10" rounded="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    <div className="truncate text-xs text-muted">{item.artistName} · {formatMs(item.durationMs)}</div>
                  </div>
                </button>
                <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => p.move(position, position - 1)}>
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton label="Move down" size="sm" disabled={i === next.length - 1} onClick={() => p.move(position, position + 1)}>
                    <ArrowDown size={15} />
                  </IconButton>
                  <IconButton label="Remove" size="sm" onClick={() => p.removeAt(position)}>
                    <X size={15} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function QueuePanel() {
  const p = usePlayer();
  const t = useT();
  return (
    <AnimatePresence>
      {p.queueOpen && (
        <motion.aside
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className="hidden w-[340px] shrink-0 flex-col border-l border-line bg-surface/80 lg:flex"
          aria-label={t("player.queue")}
        >
          <div className="flex h-16 items-center justify-between px-5">
            <h2 className="font-display font-semibold">{t("player.queue")}</h2>
            <IconButton label={t("common.close")} size="sm" onClick={() => p.setQueueOpen(false)}>
              <X size={18} />
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <QueueList />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
