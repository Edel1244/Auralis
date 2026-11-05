"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { useSession } from "@/state/session";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { Track, UserRef } from "@/lib/types";

type Comment = { id: string; body: string; createdAt: string; user: UserRef; canDelete: boolean };

export function Comments({ track }: { track: Track }) {
  const t = useT();
  const { formatDate } = useI18n();
  const toast = useToast();
  const { user } = useSession();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const { data, setData } = useApi<{ enabled: boolean; items: Comment[]; total: number }>(`/tracks/${track.id}/comments`);
  if (!data) return null;

  return (
    <section aria-label={t("track.comments")}>
      <h2 className="mb-4 font-display text-lg font-semibold">
        {t("track.comments")} <span className="text-subtle">{data.total || ""}</span>
      </h2>
      {!data.enabled ? (
        <p className="text-sm text-subtle">{t("track.commentsDisabled")}</p>
      ) : (
        user && (
          <form
            className="mb-6 flex gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!body.trim()) return;
              setPending(true);
              try {
                const r = await api<{ comment: Comment }>(`/tracks/${track.id}/comments`, { body: { body } });
                setData({ ...data, items: [r.comment, ...data.items], total: data.total + 1 });
                setBody("");
              } catch (err) {
                toast((err as Error).message, "error");
              } finally {
                setPending(false);
              }
            }}
          >
            <Avatar src={user.avatarUrl} name={user.displayName} size={36} />
            <div className="flex-1 space-y-2">
              <Textarea value={body} maxLength={1000} placeholder={t("track.addComment")} onChange={(e) => setBody(e.target.value)} className="min-h-16" />
              <div className="flex justify-end">
                <Button size="sm" type="submit" loading={pending} disabled={!body.trim()}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </form>
        )
      )}
      {data.items.length === 0 && data.enabled ? (
        <p className="text-sm text-subtle">{t("track.noComments")}</p>
      ) : (
        <ul className="space-y-4">
          {data.items.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Avatar src={c.user.avatarUrl} name={c.user.displayName} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Link href={`/u/${c.user.username}`} className="font-semibold hover:underline">
                    {c.user.displayName}
                  </Link>
                  <span className="text-xs text-subtle">{formatDate(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-line break-words text-sm text-muted">{c.body}</p>
              </div>
              {c.canDelete && (
                <IconButton
                  label={t("common.delete")}
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={async () => {
                    await api(`/comments/${c.id}`, { method: "DELETE" });
                    setData({ ...data, items: data.items.filter((x) => x.id !== c.id), total: data.total - 1 });
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
