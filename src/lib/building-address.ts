export type AddressParts = {
  city: string | null;
  district: string | null;
  address: string | null;
};

/** Bina kaydında özel (site dışı) adres alanı dolu mu? */
export function hasCustomBuildingAddress(building: AddressParts): boolean {
  return Boolean(
    building.city?.trim() || building.district?.trim() || building.address?.trim(),
  );
}

/**
 * UI gösterimi için efektif bina adresi.
 * Özel bina adresi varsa onu, yoksa bağlı site adresini kullanır.
 */
export function effectiveBuildingAddress(
  building: AddressParts,
  site: AddressParts | null | undefined,
): AddressParts {
  if (hasCustomBuildingAddress(building)) {
    return {
      city: building.city?.trim() || null,
      district: building.district?.trim() || null,
      address: building.address?.trim() || null,
    };
  }

  return {
    city: site?.city?.trim() || null,
    district: site?.district?.trim() || null,
    address: site?.address?.trim() || null,
  };
}

export function formatAddressDisplay(parts: AddressParts): {
  primary: string;
  secondary?: string;
} {
  const location = [parts.district, parts.city].filter(Boolean).join(" / ");
  if (location && parts.address) {
    return { primary: location, secondary: parts.address };
  }
  if (location) return { primary: location };
  if (parts.address) return { primary: parts.address };
  return { primary: "—" };
}
