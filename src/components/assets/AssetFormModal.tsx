"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Package, Pencil, Plus } from "lucide-react";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useApartmentsForBuilding, useBuildingsForSite } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  ASSET_STATUS_LABELS,
  ASSET_UNIT_OPTIONS,
  createAssetCategory,
  type Asset,
  type AssetCategory,
  type AssetPayload,
  type AssetStatus,
} from "@/lib/assets-api";
import { ApiError } from "@/lib/http";
import { toDateInputValue } from "@/lib/money";

export type AssetFormValues = {
  siteId: string;
  name: string;
  code: string;
  assetCategoryId: string;
  quantity: string;
  unit: string;
  buildingId: string;
  apartmentId: string;
  location: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  currentValue: string;
  supplierName: string;
  warrantyEndDate: string;
  status: AssetStatus;
  description: string;
};

export function emptyAssetForm(defaults?: Partial<AssetFormValues>): AssetFormValues {
  return {
    siteId: "",
    name: "",
    code: "",
    assetCategoryId: "",
    quantity: "1",
    unit: "Adet",
    buildingId: "",
    apartmentId: "",
    location: "",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    purchasePrice: "",
    currentValue: "",
    supplierName: "",
    warrantyEndDate: "",
    status: "ACTIVE",
    description: "",
    ...defaults,
  };
}

export function assetToForm(asset: Asset, siteId = ""): AssetFormValues {
  return {
    siteId,
    name: asset.name,
    code: asset.code ?? "",
    assetCategoryId: asset.assetCategoryId ?? asset.category?.id ?? "",
    quantity: String(asset.quantity),
    unit: asset.unit ?? "Adet",
    buildingId: asset.buildingId ?? asset.building?.id ?? "",
    apartmentId: asset.apartmentId ?? asset.apartment?.id ?? "",
    location: asset.location ?? "",
    brand: asset.brand ?? "",
    model: asset.model ?? "",
    serialNumber: asset.serialNumber ?? "",
    purchaseDate: toDateInputValue(asset.purchaseDate),
    purchasePrice: asset.purchasePrice ?? "",
    currentValue: asset.currentValue ?? "",
    supplierName: asset.supplierName ?? "",
    warrantyEndDate: toDateInputValue(asset.warrantyEndDate),
    status: asset.status,
    description: asset.description ?? "",
  };
}

/** Parse TR (15.000,50) or plain decimal money input. Empty → null. Invalid → NaN. */
export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /[.,]/.test(trimmed) && trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isNaN(num) ? Number.NaN : num;
}

export function validateAssetForm(
  values: AssetFormValues,
  options?: { requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }
  if (!values.name.trim()) errors.name = "Demirbaş adı zorunludur.";

  const quantity = Number(values.quantity);
  if (!values.quantity.trim() || Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = "Adet en az 1 olmalıdır.";
  }

  if (values.purchasePrice.trim()) {
    const price = parseMoneyInput(values.purchasePrice);
    if (price === null || Number.isNaN(price) || price < 0) {
      errors.purchasePrice = "Geçerli bir tutar girin.";
    }
  }

  if (values.currentValue.trim()) {
    const value = parseMoneyInput(values.currentValue);
    if (value === null || Number.isNaN(value) || value < 0) {
      errors.currentValue = "Geçerli bir tutar girin.";
    }
  }

  return errors;
}

export function assetFormToPayload(values: AssetFormValues): AssetPayload {
  const purchasePrice = parseMoneyInput(values.purchasePrice);
  const currentValue = parseMoneyInput(values.currentValue);

  return {
    name: values.name.trim(),
    code: values.code.trim() || null,
    assetCategoryId: values.assetCategoryId || null,
    buildingId: values.buildingId || null,
    apartmentId: values.apartmentId || null,
    quantity: Number(values.quantity),
    unit: values.unit.trim() || null,
    purchaseDate: values.purchaseDate || null,
    purchasePrice: purchasePrice === null || Number.isNaN(purchasePrice) ? null : purchasePrice,
    currentValue: currentValue === null || Number.isNaN(currentValue) ? null : currentValue,
    supplierName: values.supplierName.trim() || null,
    location: values.location.trim() || null,
    brand: values.brand.trim() || null,
    model: values.model.trim() || null,
    serialNumber: values.serialNumber.trim() || null,
    warrantyEndDate: values.warrantyEndDate || null,
    status: values.status,
    description: values.description.trim() || null,
  };
}

/** Create schema rejects null text fields; omit them so JSON drops the keys. */
export function assetPayloadForCreate(payload: AssetPayload): AssetPayload {
  const next: AssetPayload = { name: payload.name };
  if (payload.code != null) next.code = payload.code;
  if (payload.assetCategoryId != null) next.assetCategoryId = payload.assetCategoryId;
  if (payload.buildingId != null) next.buildingId = payload.buildingId;
  if (payload.apartmentId != null) next.apartmentId = payload.apartmentId;
  if (payload.quantity != null) next.quantity = payload.quantity;
  if (payload.unit != null) next.unit = payload.unit;
  if (payload.purchaseDate != null) next.purchaseDate = payload.purchaseDate;
  if (payload.purchasePrice != null) next.purchasePrice = payload.purchasePrice;
  if (payload.currentValue != null) next.currentValue = payload.currentValue;
  if (payload.supplierName != null) next.supplierName = payload.supplierName;
  if (payload.location != null) next.location = payload.location;
  if (payload.brand != null) next.brand = payload.brand;
  if (payload.model != null) next.model = payload.model;
  if (payload.serialNumber != null) next.serialNumber = payload.serialNumber;
  if (payload.warrantyEndDate != null) next.warrantyEndDate = payload.warrantyEndDate;
  if (payload.status != null) next.status = payload.status;
  if (payload.description != null) next.description = payload.description;
  return next;
}

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

type AssetFormModalProps = {
  open: boolean;
  title: string;
  categories: AssetCategory[];
  initialValues: AssetFormValues;
  pending: boolean;
  error?: string;
  auth?: AuthContext | null;
  lockSite?: boolean;
  lockBuilding?: boolean;
  lockApartment?: boolean;
  siteLabel?: string;
  showStatus?: boolean;
  onCategoriesChanged?: () => void;
  onClose: () => void;
  onSubmit: (values: AssetFormValues) => Promise<void>;
};

export function AssetFormModal({
  open,
  title,
  categories,
  initialValues,
  pending,
  error,
  auth: authProp = null,
  lockSite = false,
  lockBuilding = false,
  lockApartment = false,
  siteLabel,
  showStatus = false,
  onCategoriesChanged,
  onClose,
  onSubmit,
}: AssetFormModalProps) {
  const { showToast } = useToast();
  const apiAuth = useApiAuth({ requireSite: false });
  const auth = authProp ?? apiAuth;
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<AssetFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extraCategories, setExtraCategories] = useState<AssetCategory[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryPending, setCategoryPending] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(auth, values.siteId || null);
  const { apartments } = useApartmentsForBuilding(
    auth,
    values.siteId || null,
    values.buildingId || null,
  );

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
    setExtraCategories([]);
    setCategoryOpen(false);
    setCategoryName("");
    setCategoryError("");
  }, [open, initialValues]);

  useEffect(() => {
    if (extraCategories.length === 0) return;
    setExtraCategories((current) =>
      current.filter((item) => !categories.some((category) => category.id === item.id)),
    );
  }, [categories, extraCategories.length]);

  function update<K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") {
        next.buildingId = "";
        next.apartmentId = "";
      }
      if (key === "buildingId") next.apartmentId = "";
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "siteId") {
        delete next.buildingId;
        delete next.apartmentId;
      }
      if (key === "buildingId") delete next.apartmentId;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateAssetForm(values, { requireSite: !isEdit });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  async function handleCreateCategory() {
    if (!auth || categoryPending || !categoryName.trim()) return;
    setCategoryPending(true);
    setCategoryError("");
    try {
      const siteAuth = values.siteId ? { ...auth, siteId: values.siteId } : auth;
      const result = await createAssetCategory(siteAuth, { name: categoryName.trim() });
      setExtraCategories((current) => [...current, result.category]);
      update("assetCategoryId", result.category.id);
      setCategoryOpen(false);
      setCategoryName("");
      showToast("Kategori eklendi.");
      onCategoriesChanged?.();
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Kategori eklenemedi.");
    } finally {
      setCategoryPending(false);
    }
  }

  const mergedCategories = [...categories];
  for (const item of extraCategories) {
    if (!mergedCategories.some((category) => category.id === item.id)) {
      mergedCategories.push(item);
    }
  }
  const activeCategories = mergedCategories.filter((item) => item.isActive);
  const selectedCategory = mergedCategories.find((item) => item.id === values.assetCategoryId);
  const categoryOptions =
    selectedCategory && !selectedCategory.isActive
      ? [selectedCategory, ...activeCategories.filter((item) => item.id !== selectedCategory.id)]
      : activeCategories;

  const lockedSiteName =
    siteLabel ||
    sites.find((item) => item.id === values.siteId)?.name ||
    site?.name ||
    "—";

  return (
    <>
      <FormModal
        open={open}
        title={title}
        description="Siteye ait demirbaş bilgilerini kaydedin."
        icon={isEdit ? Pencil : Package}
        size="lg"
        onClose={pending ? () => undefined : onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              İptal
            </Button>
            <Button type="submit" form="asset-form" disabled={pending}>
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
        <form id="asset-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <FormSection title="Temel Bilgiler">
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <FormField label="Demirbaş Adı" htmlFor="asset-name" required error={errors.name} className="md:col-span-2">
                <Input
                  id="asset-name"
                  data-modal-autofocus={!(isEdit || lockSite) ? undefined : true}
                  value={values.name}
                  invalid={Boolean(errors.name)}
                  onChange={(event) => update("name", event.target.value)}
                />
              </FormField>
              <FormField label="Demirbaş Kodu" htmlFor="asset-code">
                <Input
                  id="asset-code"
                  value={values.code}
                  onChange={(event) => update("code", event.target.value)}
                  placeholder="Örn. DMR-001"
                />
              </FormField>
              <FormField label="Kategori" htmlFor="asset-category">
                <div className="flex gap-2">
                  <Select
                    id="asset-category"
                    className="flex-1"
                    value={values.assetCategoryId}
                    onChange={(event) => update("assetCategoryId", event.target.value)}
                  >
                    <option value="">Kategori seçin</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {!category.isActive ? " (Pasif)" : ""}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setCategoryError("");
                      setCategoryName("");
                      setCategoryOpen(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Yeni Kategori
                  </Button>
                </div>
              </FormField>
              <FormField label="Adet" htmlFor="asset-quantity" required error={errors.quantity}>
                <Input
                  id="asset-quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={values.quantity}
                  invalid={Boolean(errors.quantity)}
                  onChange={(event) => update("quantity", event.target.value)}
                />
              </FormField>
              <FormField label="Birim" htmlFor="asset-unit">
                <Select
                  id="asset-unit"
                  value={values.unit}
                  onChange={(event) => update("unit", event.target.value)}
                >
                  {ASSET_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  {values.unit && !(ASSET_UNIT_OPTIONS as readonly string[]).includes(values.unit) ? (
                    <option value={values.unit}>{values.unit}</option>
                  ) : null}
                </Select>
              </FormField>
              {showStatus ? (
                <FormField label="Durum" htmlFor="asset-status" className="md:col-span-2">
                  <Select
                    id="asset-status"
                    value={values.status}
                    onChange={(event) => update("status", event.target.value as AssetStatus)}
                  >
                    {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {ASSET_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}
            </div>
          </FormSection>

          <FormSection title="Konum">
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              {isEdit || lockSite ? (
                <SiteContextField value={lockedSiteName} hint="Demirbaş bu siteye aittir." />
              ) : (
                <SiteSelect
                  value={values.siteId}
                  onChange={(siteId) => update("siteId", siteId)}
                  error={errors.siteId}
                  autoFocus
                />
              )}
              <FormField label="Bina" htmlFor="asset-building">
                <Select
                  id="asset-building"
                  value={values.buildingId}
                  disabled={lockBuilding || (!isEdit && !values.siteId)}
                  onChange={(event) => update("buildingId", event.target.value)}
                >
                  <option value="">
                    {!isEdit && !values.siteId ? "Önce site seçin" : "Site Geneli"}
                  </option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Daire" htmlFor="asset-apartment">
                <Select
                  id="asset-apartment"
                  value={values.apartmentId}
                  disabled={lockApartment || !values.buildingId}
                  onChange={(event) => update("apartmentId", event.target.value)}
                >
                  <option value="">
                    {values.buildingId ? "Bina Ortak Alanı" : "Önce bina seçin"}
                  </option>
                  {apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      Daire {apartment.number}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Konum" htmlFor="asset-location" className="md:col-span-2">
                <Input
                  id="asset-location"
                  value={values.location}
                  onChange={(event) => update("location", event.target.value)}
                  placeholder="Örn. Teknik oda, depo"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Ürün Bilgileri">
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <FormField label="Marka" htmlFor="asset-brand">
                <Input
                  id="asset-brand"
                  value={values.brand}
                  onChange={(event) => update("brand", event.target.value)}
                />
              </FormField>
              <FormField label="Model" htmlFor="asset-model">
                <Input
                  id="asset-model"
                  value={values.model}
                  onChange={(event) => update("model", event.target.value)}
                />
              </FormField>
              <FormField label="Seri Numarası" htmlFor="asset-serial" className="md:col-span-2">
                <Input
                  id="asset-serial"
                  value={values.serialNumber}
                  onChange={(event) => update("serialNumber", event.target.value)}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Satın Alma">
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <FormField label="Satın Alma Tarihi" htmlFor="asset-purchase-date">
                <Input
                  id="asset-purchase-date"
                  type="date"
                  value={values.purchaseDate}
                  onChange={(event) => update("purchaseDate", event.target.value)}
                />
              </FormField>
              <FormField label="Satın Alma Bedeli" htmlFor="asset-purchase-price" error={errors.purchasePrice}>
                <Input
                  id="asset-purchase-price"
                  inputMode="decimal"
                  value={values.purchasePrice}
                  invalid={Boolean(errors.purchasePrice)}
                  onChange={(event) => update("purchasePrice", event.target.value)}
                  placeholder="0,00"
                />
              </FormField>
              <FormField
                label="Güncel Değer"
                htmlFor="asset-current-value"
                error={errors.currentValue}
              >
                <Input
                  id="asset-current-value"
                  inputMode="decimal"
                  value={values.currentValue}
                  invalid={Boolean(errors.currentValue)}
                  onChange={(event) => update("currentValue", event.target.value)}
                  placeholder="0,00"
                />
              </FormField>
              <FormField label="Tedarikçi" htmlFor="asset-supplier">
                <Input
                  id="asset-supplier"
                  value={values.supplierName}
                  onChange={(event) => update("supplierName", event.target.value)}
                  placeholder="Örn. ABC Teknoloji"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Garanti">
            <FormField label="Garanti Bitiş Tarihi" htmlFor="asset-warranty">
              <Input
                id="asset-warranty"
                type="date"
                value={values.warrantyEndDate}
                onChange={(event) => update("warrantyEndDate", event.target.value)}
              />
            </FormField>
          </FormSection>

          <FormSection title="Ek Bilgi">
            <FormField label="Açıklama" htmlFor="asset-description">
              <Textarea
                id="asset-description"
                rows={3}
                className="min-h-[76px]"
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </FormField>
          </FormSection>

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        </form>
      </FormModal>

      <Modal
        open={categoryOpen}
        title="Yeni Kategori"
        description="Demirbaş kategorisi ekleyin."
        size="sm"
        variant="form"
        onClose={categoryPending ? () => undefined : () => setCategoryOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryOpen(false)} disabled={categoryPending}>
              İptal
            </Button>
            <Button
              disabled={categoryPending || !categoryName.trim()}
              onClick={() => void handleCreateCategory()}
            >
              {categoryPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </>
        }
      >
        <FormField label="Kategori Adı" htmlFor="asset-quick-category" required error={categoryError}>
          <Input
            id="asset-quick-category"
            data-modal-autofocus
            value={categoryName}
            invalid={Boolean(categoryError)}
            onChange={(event) => {
              setCategoryName(event.target.value);
              setCategoryError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreateCategory();
              }
            }}
          />
        </FormField>
      </Modal>
    </>
  );
}
