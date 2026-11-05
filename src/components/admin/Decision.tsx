"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useT } from "@/i18n/I18nProvider";

/** Confirmation dialog for moderation decisions: optional note + optional strike checkbox. */
export function DecisionDialog({
  open,
  title,
  confirmLabel,
  danger,
  allowStrike,
  defaultStrike = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  danger?: boolean;
  allowStrike?: boolean;
  defaultStrike?: boolean;
  onClose: () => void;
  onConfirm: (note: string, strike: boolean) => Promise<void>;
}) {
  const t = useT();
  const [note, setNote] = useState("");
  const [strike, setStrike] = useState(defaultStrike);
  const [pending, setPending] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm(note, strike);
                setNote("");
                onClose();
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <label className="block text-sm text-muted">
        {t("mod.note")}
        <Textarea className="mt-1.5" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {allowStrike && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="accent-[var(--au-primary)]" />
          {t("mod.strike")}
        </label>
      )}
    </Modal>
  );
}
