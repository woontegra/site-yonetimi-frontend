"use client";

import { AlertTriangle } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  /** Persistent in-modal warning (not a toast). */
  alert?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  danger = false,
  pending = false,
  pendingLabel = "İşleniyor…",
  alert,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      icon={AlertTriangle}
      iconTone={danger ? "danger" : "warning"}
      variant="confirm"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending} data-modal-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {alert ? (
        <AlertBanner tone={danger ? "danger" : "warning"} title="Dikkat">
          {alert}
        </AlertBanner>
      ) : null}
    </Modal>
  );
}
