"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useT } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

const REASONS = ["COPYRIGHT", "SPAM", "ABUSE", "EXPLICIT_UNLABELED", "IMPERSONATION", "OTHER"] as const;

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "TRACK" | "ALBUM" | "PLAYLIST" | "USER" | "COMMENT" | "THEME";
  targetId: string;
}) {
  const t = useT();
  const toast = useToast();
  const [reason, setReason] = useState<(typeof REASONS)[number]>("COPYRIGHT");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("moderation.reportTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={pending}
            onClick={async () => {
              setPending(true);
              try {
                await api("/reports", { body: { targetType, targetId, reason, details } });
                toast(t("moderation.submitted"), "success");
                setDetails("");
                onClose();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setPending(false);
              }
            }}
          >
            {t("common.report")}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-muted">{t("moderation.reason")}</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-primary">
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--au-primary)]" />
            {t(`moderation.reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block text-sm font-medium text-muted">
        {t("moderation.details")}
        <Textarea className="mt-1.5" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
    </Modal>
  );
}
