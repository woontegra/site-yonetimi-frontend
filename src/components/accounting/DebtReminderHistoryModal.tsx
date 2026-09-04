"use client";

import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useApiAuth } from "@/lib/active-site-context";
import {
  listCommunicationBatches,
  listCommunicationMessages,
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_STATUS_LABELS,
  type CommunicationBatch,
  type CommunicationMessage,
  type MessageStatus,
} from "@/lib/communications-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

type DebtReminderHistoryModalProps = {
  open: boolean;
  onClose: () => void;
};

function statusTone(status: MessageStatus): "neutral" | "success" | "warning" | "danger" {
  if (status === "SENT" || status === "DELIVERED" || status === "READ") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PENDING") return "warning";
  return "neutral";
}

export function DebtReminderHistoryModal({ open, onClose }: DebtReminderHistoryModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { showToast, toastError } = useToast();
  useCloseFormOnSiteChange(open, onClose);

  const [batches, setBatches] = useState<CommunicationBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const [batchResult, messageResult] = await Promise.all([
        listCommunicationBatches(auth),
        listCommunicationMessages(auth, {
          batchId: batchId || undefined,
          page: 1,
          perPage: 50,
        }),
      ]);
      setBatches(batchResult.items);
      setMessages(messageResult.items);
    } catch (error) {
      toastError(error, "Geçmiş yüklenemedi.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [auth, batchId, showToast]);

  useEffect(() => {
    if (!open) {
      setBatchId("");
      setMessages([]);
      setBatches([]);
      return;
    }
    void load();
  }, [open, load]);

  return (
    <FormModal
      open={open}
      title="Mesaj Geçmişi"
      description="Gönderilen borç hatırlatmalarını ve durumlarını inceleyin."
      icon={History}
      size="lg"
      className="sm:max-w-[860px]"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-[13px] font-medium text-ink">Gönderim grubu</label>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Tüm gönderimler</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {formatDateTr(batch.createdAt)} · {MESSAGE_CHANNEL_LABELS[batch.channel]} ·{" "}
                {batch.sentCount}/{batch.totalCount}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Yenile
        </Button>
      </div>

      {loading ? <p className="mb-2 text-[13px] text-muted">Yükleniyor…</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Tarih</TH>
              <TH>Kanal</TH>
              <TH>Kişi</TH>
              <TH>Daire</TH>
              <TH>Telefon</TH>
              <TH>Durum</TH>
            </TR>
          </THead>
          <TBody>
            {!loading && messages.length === 0 ? (
              <TR>
                <TD colSpan={6} className="text-muted">
                  Henüz mesaj kaydı yok.
                </TD>
              </TR>
            ) : (
              messages.map((msg) => (
                <TR key={msg.id}>
                  <TD>{formatDateTr(msg.sentAt ?? msg.createdAt)}</TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{MESSAGE_CHANNEL_LABELS[msg.channel]}</span>
                      {msg.isMock ? <Badge tone="warning">Test</Badge> : null}
                    </div>
                  </TD>
                  <TD>{msg.person?.fullName ?? "—"}</TD>
                  <TD>
                    {msg.apartment
                      ? `${msg.apartment.building.name} / ${msg.apartment.number}`
                      : "—"}
                  </TD>
                  <TD>{msg.toPhone}</TD>
                  <TD>
                    <Badge tone={statusTone(msg.status)}>
                      {MESSAGE_STATUS_LABELS[msg.status]}
                    </Badge>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
    </FormModal>
  );
}
