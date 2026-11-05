"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Cover, Spinner } from "@/components/ui/misc";
import type { Paged, Track } from "@/lib/types";

type Source = "uploads" | "liked" | "search";

export function TrackPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: Track) => void }) {
  const t = useT();
  const [source, setSource] = useState<Source>("uploads");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        if (source === "search" || q.trim()) {
          const r = await api<{ items: Track[] }>(`/search?type=tracks&q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
          setItems(r.items);
        } else if (source === "uploads") {
          const r = await api<Paged<Track>>("/me/tracks?limit=50", { signal: ctrl.signal });
          setItems(r.items.filter((x) => x.status === "READY"));
        } else {
          const r = await api<Paged<Track>>("/me/likes?limit=50", { signal: ctrl.signal });
          setItems(r.items);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [open, source, q]);

  return (
    <Modal open={open} onClose={onClose} title={t("studio.pickTrack")} size="lg">
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["uploads", t("studio.yourUploads")],
            ["liked", t("studio.liked")],
            ["search", t("common.search")],
          ] as [Source, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSource(k)}
            aria-pressed={source === k}
            className={cn("rounded-full px-3 py-1.5 text-sm", source === k ? "bg-fg text-bg" : "bg-surface-2 text-muted")}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input aria-label={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} className="h-10 pl-9" />
        </div>
      </div>
      {loading && !items.length ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t("search.noResultsHint")}</p>
      ) : (
        <ul className="max-h-[55vh] space-y-1 overflow-y-auto">
          {items.map((tr) => (
            <li key={tr.id}>
              <button
                onClick={() => {
                  onPick(tr);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2"
              >
                <Cover src={tr.coverUrl} seed={tr.id} className="w-10" rounded="rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{tr.title}</span>
                  <span className="block truncate text-xs text-muted">{tr.artistName}</span>
                </span>
                {tr.bpm && <span className="text-xs tabular-nums text-subtle">{tr.bpm} BPM</span>}
                <span className="text-xs tabular-nums text-subtle">{formatMs(tr.durationMs)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
