"use client";

import { useCallback, useEffect, useState } from "react";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { ApiError } from "@/lib/http";

type Auth = { token: string; tenantId: string };

/** Seçilen site için bina listesi (X-Site-Id override). */
export function useBuildingsForSite(auth: Auth | null, siteId: string | null | undefined) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !siteId) {
      setBuildings([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await listBuildings(
        { ...auth, siteId },
        { page: 1, perPage: 100, status: "aktif" },
      );
      setBuildings(result.items);
    } catch (err) {
      setBuildings([]);
      setError(err instanceof ApiError ? err.message : "Binalar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth?.token, auth?.tenantId, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { buildings, loading, error, reload: load };
}

/** Seçilen bina için daire listesi. */
export function useApartmentsForBuilding(
  auth: Auth | null,
  siteId: string | null | undefined,
  buildingId: string | null | undefined,
) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth || !siteId || !buildingId) {
      setApartments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void listApartments(
      { ...auth, siteId },
      { buildingId, page: 1, perPage: 500, status: "aktif" },
    )
      .then((result) => {
        if (!cancelled) setApartments(result.items);
      })
      .catch(() => {
        if (!cancelled) setApartments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token, auth?.tenantId, siteId, buildingId]);

  return { apartments, loading };
}
