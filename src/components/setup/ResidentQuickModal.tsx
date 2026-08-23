"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { RELATION_TYPE_LABELS, type RelationType } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import { assignResident } from "@/lib/site-setup-api";

type ResidentMode = "new" | "existing";

type ResidentQuickModalProps = {
  open: boolean;
  apartmentId: string;
  relationType: RelationType;
  onClose: () => void;
  onSaved?: () => void;
};

export function ResidentQuickModal({
  open,
  apartmentId,
  relationType,
  onClose,
  onSaved,
}: ResidentQuickModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const [mode, setMode] = useState<ResidentMode>("new");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [persons, setPersons] = useState<PersonListItem[]>([]);
  const [personsLoading, setPersonsLoading] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setMode("new");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setSearch("");
    setSelectedPersonId("");
    setError("");
    setFieldErrors({});
  }, [open, apartmentId, relationType]);

  const loadPersons = useCallback(async () => {
    if (!auth || mode !== "existing") return;
    setPersonsLoading(true);
    try {
      const result = await listPersons(auth, {
        search: debouncedSearch.trim() || undefined,
        perPage: 20,
        status: "aktif",
      });
      setPersons(result.items);
    } catch {
      setPersons([]);
    } finally {
      setPersonsLoading(false);
    }
  }, [auth, mode, debouncedSearch]);

  useEffect(() => {
    if (!open || mode !== "existing") return;
    void loadPersons();
  }, [open, mode, loadPersons]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth || pending) return;

    const nextErrors: Record<string, string> = {};
    if (mode === "new") {
      if (!firstName.trim()) nextErrors.firstName = "Ad zorunludur.";
      if (!lastName.trim()) nextErrors.lastName = "Soyad zorunludur.";
    } else if (!selectedPersonId) {
      nextErrors.personId = "Kişi seçin.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setError("");
    try {
      await assignResident(auth, {
        apartmentId,
        relationType,
        ...(mode === "existing"
          ? { personId: selectedPersonId }
          : {
              person: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                ...(phone.trim() ? { phone: phone.trim() } : {}),
                ...(email.trim() ? { email: email.trim() } : {}),
              },
            }),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  const relationLabel = RELATION_TYPE_LABELS[relationType];

  return (
    <FormModal
      open={open}
      size="md"
      title={`${relationLabel} Ekle`}
      description="Yeni kişi oluşturun veya mevcut kişiyi seçin."
      icon={UserRound}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="resident-quick-form" disabled={pending}>
            {pending ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Kaydet
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="resident-quick-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "new" ? "primary" : "secondary"}
            onClick={() => setMode("new")}
          >
            Yeni
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "existing" ? "primary" : "secondary"}
            onClick={() => setMode("existing")}
          >
            Mevcut seç
          </Button>
        </div>

        {mode === "new" ? (
          <FormSection title="Kişi bilgileri">
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <FormField label="Ad" htmlFor="rq-first-name" required error={fieldErrors.firstName}>
                <Input
                  id="rq-first-name"
                  data-modal-autofocus
                  value={firstName}
                  invalid={Boolean(fieldErrors.firstName)}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </FormField>
              <FormField label="Soyad" htmlFor="rq-last-name" required error={fieldErrors.lastName}>
                <Input
                  id="rq-last-name"
                  value={lastName}
                  invalid={Boolean(fieldErrors.lastName)}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </FormField>
              <FormField label="Telefon" htmlFor="rq-phone">
                <Input
                  id="rq-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="05xx xxx xx xx"
                />
              </FormField>
              <FormField label="E-posta" htmlFor="rq-email">
                <Input
                  id="rq-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>
            </div>
          </FormSection>
        ) : (
          <FormSection title="Mevcut kişi">
            <FormField label="Kişi ara" htmlFor="rq-search" error={fieldErrors.personId}>
              <SearchInput
                id="rq-search"
                placeholder="Ad, soyad veya telefon..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FormField>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-line">
              {personsLoading ? (
                <p className="p-3 text-sm text-muted">Aranıyor…</p>
              ) : persons.length === 0 ? (
                <p className="p-3 text-sm text-muted">Kişi bulunamadı.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {persons.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-canvas ${
                          selectedPersonId === person.id ? "bg-brand-soft text-brand" : ""
                        }`}
                        onClick={() => setSelectedPersonId(person.id)}
                      >
                        <span className="font-medium">{person.fullName}</span>
                        <span className="text-muted">{person.phone || "—"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FormSection>
        )}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
