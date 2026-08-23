import { apiRequest } from "@/lib/http";

export type AssignmentScope = "SITE" | "BUILDING";

export type EmployeeAssignmentBuilding = {
  id: string;
  name: string;
};

export type EmployeeAssignment = {
  id: string;
  scopeLabel: string;
  site?: EmployeeAssignmentSite | null;
  building: EmployeeAssignmentBuilding | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  jobTitle: string;
  hireDate: string | null;
  terminationDate: string | null;
  isActive: boolean;
  assignmentSummary: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt: string | null;
};

export type EmployeeDetail = Employee & {
  assignments: EmployeeAssignment[];
};

export type EmployeeListResponse = {
  items: Employee[];
  page: number;
  perPage: number;
  total: number;
};

export type EmployeePayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  jobTitle: string;
  hireDate?: string;
  isActive?: boolean;
  assignment?: {
    siteId: string;
    scope: AssignmentScope;
    buildingId?: string;
    startDate?: string;
    note?: string;
  };
};

export type EmployeeUpdatePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  jobTitle?: string;
  hireDate?: string | null;
  isActive?: boolean;
};

export type AssignmentPayload = {
  scope: AssignmentScope;
  buildingId?: string;
  startDate?: string;
  note?: string;
  employeeId?: string;
};

export type EmployeeAssignmentSite = {
  id: string;
  name: string;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type EmployeeListParams = {
  search?: string;
  status?: "aktif" | "pasif";
  jobTitle?: string;
  page?: number;
  perPage?: number;
};

export function listEmployees(auth: AuthContext, params: EmployeeListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.jobTitle) query.set("jobTitle", params.jobTitle);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<EmployeeListResponse>(`/api/employees${suffix}`, auth);
}

export function getEmployee(auth: AuthContext, id: string) {
  return apiRequest<{ employee: EmployeeDetail }>(`/api/employees/${id}`, auth);
}

export function createEmployee(auth: AuthContext, payload: EmployeePayload) {
  return apiRequest<{ employee: EmployeeDetail }>("/api/employees", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(auth: AuthContext, id: string, payload: EmployeeUpdatePayload) {
  return apiRequest<{ employee: EmployeeDetail }>(`/api/employees/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteEmployee(auth: AuthContext, id: string) {
  return apiRequest<{ ok: true }>(`/api/employees/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function archiveEmployee(auth: AuthContext, id: string) {
  return deleteEmployee(auth, id);
}

export function terminateEmployee(
  auth: AuthContext,
  id: string,
  payload: { terminationDate: string },
) {
  return apiRequest<{ employee: EmployeeDetail }>(`/api/employees/${id}/terminate`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createEmployeeAssignment(
  auth: AuthContext,
  employeeId: string,
  payload: AssignmentPayload,
) {
  return apiRequest<{ assignment: EmployeeAssignment }>(
    `/api/employees/${employeeId}/assignments`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function endEmployeeAssignment(
  auth: AuthContext,
  assignmentId: string,
  payload: { endDate: string },
) {
  return apiRequest<{ assignment: EmployeeAssignment }>(
    `/api/employees/assignments/${assignmentId}/end`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
