"use client";

import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import {
  TURKEY_PROVINCES,
  getDistrictsForProvince,
  withLegacyOption,
} from "@/lib/turkey-locations";

type ProvinceDistrictFieldsProps = {
  city: string;
  district: string;
  onCityChange: (city: string) => void;
  onDistrictChange: (district: string) => void;
  cityId?: string;
  districtId?: string;
  cityError?: string;
  districtError?: string;
  cityRequired?: boolean;
  districtRequired?: boolean;
  className?: string;
};

export function ProvinceDistrictFields({
  city,
  district,
  onCityChange,
  onDistrictChange,
  cityId = "location-city",
  districtId = "location-district",
  cityError,
  districtError,
  cityRequired = false,
  districtRequired = false,
  className,
}: ProvinceDistrictFieldsProps) {
  const provinceOptions = withLegacyOption(TURKEY_PROVINCES, city);
  const districtOptions = withLegacyOption(getDistrictsForProvince(city), district);
  const districtDisabled = !city.trim();

  return (
    <>
      <FormField
        label="İl"
        htmlFor={cityId}
        required={cityRequired}
        error={cityError}
        className={className}
      >
        <Select
          id={cityId}
          value={city}
          invalid={Boolean(cityError)}
          onChange={(event) => {
            const nextCity = event.target.value;
            onCityChange(nextCity);
            if (district.trim()) onDistrictChange("");
          }}
        >
          <option value="">İl seçin</option>
          {provinceOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="İlçe"
        htmlFor={districtId}
        required={districtRequired}
        error={districtError}
        className={className}
      >
        <Select
          id={districtId}
          value={district}
          disabled={districtDisabled}
          invalid={Boolean(districtError)}
          onChange={(event) => onDistrictChange(event.target.value)}
        >
          <option value="">
            {districtDisabled ? "Önce il seçin" : "İlçe seçin"}
          </option>
          {districtOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
