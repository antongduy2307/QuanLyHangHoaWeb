import { apiRequest } from "./client";
import type {
  AttendanceBagType,
  AttendanceBagTypeCreatePayload,
  AttendanceBagTypeFromProductPayload,
  AttendanceBagTypeUpdatePayload,
  AttendanceCutProductSearchResult,
  AttendanceDayEntryDetail,
  AttendanceDayEntrySavePayload,
  AttendanceDayEntrySaveResult,
  AttendanceDayEntryStatusRow,
  AttendanceEmployee,
  AttendanceEmployeeCreatePayload,
  AttendanceEmployeeDeleteResult,
  AttendanceEmployeeUpdatePayload,
  AttendanceInventoryDiagnosticIssue,
  AttendanceMonthlyReport,
  AttendancePeriodReport,
  AttendancePeriod,
  AttendanceReference,
  AttendanceTeam,
  AttendanceWorkType,
  AttendanceWorkTypeCreatePayload,
  AttendanceWorkTypeSeedResult,
  AttendanceWorkTypeUpdatePayload,
} from "./types";

export type ListAttendanceEmployeesParams = {
  includeInactive?: boolean;
  search?: string;
  team?: AttendanceTeam | "all";
};

export function getAttendanceReference() {
  return apiRequest<AttendanceReference>("/attendance/reference");
}

export function listAttendanceEmployees(params: ListAttendanceEmployeesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.includeInactive) {
    searchParams.set("include_inactive", "true");
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.team && params.team !== "all") {
    searchParams.set("team", params.team);
  }
  const queryString = searchParams.toString();
  return apiRequest<AttendanceEmployee[]>(`/attendance/employees${queryString ? `?${queryString}` : ""}`);
}

export function createAttendanceEmployee(payload: AttendanceEmployeeCreatePayload) {
  return apiRequest<AttendanceEmployee>("/attendance/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAttendanceEmployee(employeeId: number) {
  return apiRequest<AttendanceEmployee>(`/attendance/employees/${employeeId}`);
}

export function updateAttendanceEmployee(employeeId: number, payload: AttendanceEmployeeUpdatePayload) {
  return apiRequest<AttendanceEmployee>(`/attendance/employees/${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAttendanceEmployee(employeeId: number) {
  return apiRequest<AttendanceEmployeeDeleteResult>(`/attendance/employees/${employeeId}`, {
    method: "DELETE",
  });
}

export function listAttendancePeriods() {
  return apiRequest<AttendancePeriod[]>("/attendance/periods");
}

export function listAttendanceWorkTypes(includeInactive = false) {
  return apiRequest<AttendanceWorkType[]>(`/attendance/work-types${includeInactive ? "?include_inactive=true" : ""}`);
}

export function createAttendanceWorkType(payload: AttendanceWorkTypeCreatePayload) {
  return apiRequest<AttendanceWorkType>("/attendance/work-types", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAttendanceWorkType(workTypeId: number, payload: AttendanceWorkTypeUpdatePayload) {
  return apiRequest<AttendanceWorkType>(`/attendance/work-types/${workTypeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function seedAttendanceDefaultWorkTypes() {
  return apiRequest<AttendanceWorkTypeSeedResult>("/attendance/work-types/seed-defaults", {
    method: "POST",
  });
}

export function listAttendanceCutWorkItems(includeInactive = false) {
  return apiRequest<AttendanceBagType[]>(`/attendance/cut-work-items${includeInactive ? "?include_inactive=true" : ""}`);
}

export function createAttendanceCutWorkItem(payload: AttendanceBagTypeCreatePayload) {
  return apiRequest<AttendanceBagType>("/attendance/cut-work-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAttendanceCutWorkItem(bagTypeId: number, payload: AttendanceBagTypeUpdatePayload) {
  return apiRequest<AttendanceBagType>(`/attendance/cut-work-items/${bagTypeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function searchAttendanceCutWorkItems(search: string, includeInactive = false) {
  const searchParams = new URLSearchParams();
  if (search.trim()) {
    searchParams.set("search", search.trim());
  }
  if (includeInactive) {
    searchParams.set("include_inactive", "true");
  }
  const query = searchParams.toString();
  return apiRequest<AttendanceBagType[]>(`/attendance/cut-work-items${query ? `?${query}` : ""}`);
}

export function searchAttendanceCutProducts(search: string) {
  const searchParams = new URLSearchParams({ search: search.trim() });
  return apiRequest<AttendanceCutProductSearchResult[]>(`/attendance/cut-products/search?${searchParams.toString()}`);
}

export function upsertAttendanceCutWorkItemFromProduct(payload: AttendanceBagTypeFromProductPayload) {
  return apiRequest<AttendanceBagType>("/attendance/cut-work-items/from-product", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listAttendanceDayEntryRows(selectedDate: string) {
  const searchParams = new URLSearchParams({ date: selectedDate });
  return apiRequest<AttendanceDayEntryStatusRow[]>(`/attendance/day-entry?${searchParams.toString()}`);
}

export function getAttendanceDayEntry(employeeId: number, selectedDate: string) {
  const searchParams = new URLSearchParams({ date: selectedDate });
  return apiRequest<AttendanceDayEntryDetail>(`/attendance/day-entry/${employeeId}?${searchParams.toString()}`);
}

export function saveAttendanceDayEntry(
  employeeId: number,
  selectedDate: string,
  finalize: boolean,
  payload: AttendanceDayEntrySavePayload,
) {
  const searchParams = new URLSearchParams({ date: selectedDate, finalize: String(finalize) });
  return apiRequest<AttendanceDayEntrySaveResult>(`/attendance/day-entry/${employeeId}?${searchParams.toString()}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getAttendancePeriodReport(team: AttendanceTeam, periodId: number) {
  const searchParams = new URLSearchParams({ team, period_id: String(periodId) });
  return apiRequest<AttendancePeriodReport>(`/attendance/reports/period?${searchParams.toString()}`);
}

export function getAttendanceMonthlyReport(team: AttendanceTeam, month: string) {
  const searchParams = new URLSearchParams({ team, month });
  return apiRequest<AttendanceMonthlyReport>(`/attendance/reports/monthly?${searchParams.toString()}`);
}

export function listAttendanceInventoryDiagnostics() {
  return apiRequest<AttendanceInventoryDiagnosticIssue[]>("/attendance/inventory-diagnostics");
}
