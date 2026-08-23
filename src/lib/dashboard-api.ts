import { apiRequest } from "@/lib/http";
import type { SetupStatus } from "@/lib/site-setup-api";

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export type DashboardActivity = {
  id: string;
  type: "payment" | "expense";
  title: string;
  subtitle: string;
  amount: string;
  occurredAt: string;
  href: string;
};

export type DashboardUpcoming = {
  id: string;
  type: "debt" | "maintenance";
  title: string;
  subtitle: string;
  date: string | null;
  amount: string | null;
  href: string;
};

export type DashboardOverview = {
  site: { id: string; name: string };
  setupStatus: { status: SetupStatus; completed: boolean };
  apartmentSummary: { total: number; active: number };
  residentSummary: { total: number; owners: number; tenants: number };
  financeSummary: {
    year: number;
    month: number;
    accrued: string;
    collected: string;
    expense: string;
    openDebt: string;
    openDebtCount: number;
    indebtedApartmentCount: number;
    collectionRatePercent: number | null;
  };
  recentActivity: DashboardActivity[];
  upcoming: DashboardUpcoming[];
  activeVisitors: {
    count: number;
    items: Array<{
      id: string;
      visitorName: string;
      apartmentLabel: string;
      checkInAt: string;
      href: string;
    }>;
  };
  activeAnnouncements: Array<{
    id: string;
    title: string;
    publishedAt: string;
    audienceLabel: string;
    targetSummary: string;
    href: string;
  }>;
  upcomingMaintenances: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      nextMaintenanceDate: string | null;
      href: string;
    }>;
  };
};

export function getDashboardOverview(auth: AuthContext) {
  return apiRequest<DashboardOverview>("/api/dashboard/overview", auth);
}
