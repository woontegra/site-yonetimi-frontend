"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { todayInputValue } from "@/lib/person-constants";

type EndRelationDialogProps = {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (endDate: string) => void;
};

export function EndRelationDialog({
  open,
  pending = false,
  onClose,
  onConfirm,
}: EndRelationDialogProps) {
  const [endDate, setEndDate] = useState(todayInputValue());

  useEffect(() => {
    if (open) setEndDate(todayInputValue());
  }, [open]);

  return (
    <Modal
      open={open}
      title="İlişki sonlandırılsın mı?"
      description="Bu kişi dairenin aktif kişi listesinden çıkarılacak ancak geçmiş kaydı korunacaktır."
      icon={AlertTriangle}
      iconTone="warning"
      variant="confirm"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            disabled={pending || !endDate}
            onClick={() => onConfirm(endDate)}
          >
            {pending ? "Sonlandırılıyor..." : "İlişkiyi Sonlandır"}
          </Button>
        </>
      }
    >
      <FormField label="Bitiş Tarihi" htmlFor="relation-end-date">
        <Input
          id="relation-end-date"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
