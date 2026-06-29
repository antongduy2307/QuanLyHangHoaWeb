import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAttendanceCutWorkItem,
  createAttendanceWorkType,
  createAttendanceEmployee,
  deleteAttendanceEmployee,
  getAttendanceDayEntry,
  getAttendanceMonthlyReport,
  getAttendancePeriodReport,
  getAttendanceReference,
  listAttendanceInventoryDiagnostics,
  listAttendancePeriods,
  listAttendanceCutWorkItems,
  listAttendanceDayEntryRows,
  listAttendanceEmployees,
  listAttendanceWorkTypes,
  saveAttendanceDayEntry,
  searchAttendanceCutProducts,
  searchAttendanceCutWorkItems,
  seedAttendanceDefaultWorkTypes,
  updateAttendanceCutWorkItem,
  upsertAttendanceCutWorkItemFromProduct,
  updateAttendanceWorkType,
  updateAttendanceEmployee,
} from "../../api/attendance";
import type {
  AttendanceBagTypeCreatePayload,
  AttendanceBagTypeFromProductPayload,
  AttendanceBagTypeUpdatePayload,
  AttendanceDayEntrySavePayload,
  AttendanceEmployeeCreatePayload,
  AttendanceEmployeeUpdatePayload,
  AttendanceTeam,
  AttendanceWorkTypeCreatePayload,
  AttendanceWorkTypeUpdatePayload,
} from "../../api/types";

export const attendanceKeys = {
  all: ["attendance"] as const,
  reference: () => [...attendanceKeys.all, "reference"] as const,
  periods: () => [...attendanceKeys.all, "periods"] as const,
  employees: (search: string, team: AttendanceTeam | "all", includeInactive: boolean) =>
    [...attendanceKeys.all, "employees", { search, team, includeInactive }] as const,
  workTypes: () => [...attendanceKeys.all, "work-types"] as const,
  cutWorkItems: () => [...attendanceKeys.all, "cut-work-items"] as const,
  cutWorkItemsSearch: (search: string) => [...attendanceKeys.cutWorkItems(), { search }] as const,
  cutProductsSearch: (search: string) => [...attendanceKeys.all, "cut-products-search", search] as const,
  dayList: (selectedDate: string) => [...attendanceKeys.all, "day-list", selectedDate] as const,
  dayEntry: (employeeId: number, selectedDate: string) => [...attendanceKeys.all, "day-entry", employeeId, selectedDate] as const,
  periodReport: (team: AttendanceTeam, periodId: number) => [...attendanceKeys.all, "report-period", team, periodId] as const,
  monthlyReport: (team: AttendanceTeam, month: string) => [...attendanceKeys.all, "report-monthly", team, month] as const,
};

export function useAttendanceReference() {
  return useQuery({
    queryKey: attendanceKeys.reference(),
    queryFn: () => getAttendanceReference(),
  });
}

export function useAttendancePeriods() {
  return useQuery({
    queryKey: attendanceKeys.periods(),
    queryFn: () => listAttendancePeriods(),
  });
}

export function useAttendanceEmployees(search: string, team: AttendanceTeam | "all", includeInactive: boolean) {
  return useQuery({
    queryKey: attendanceKeys.employees(search, team, includeInactive),
    queryFn: () => listAttendanceEmployees({ search, team, includeInactive }),
  });
}

export function useAttendanceWorkTypes(includeInactive = false) {
  return useQuery({
    queryKey: [...attendanceKeys.workTypes(), { includeInactive }] as const,
    queryFn: () => listAttendanceWorkTypes(includeInactive),
  });
}

export function useSeedAttendanceDefaultWorkTypes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => seedAttendanceDefaultWorkTypes(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useCreateAttendanceWorkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceWorkTypeCreatePayload) => createAttendanceWorkType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useUpdateAttendanceWorkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workTypeId, payload }: { workTypeId: number; payload: AttendanceWorkTypeUpdatePayload }) =>
      updateAttendanceWorkType(workTypeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useAttendanceCutWorkItems(includeInactive = false) {
  return useQuery({
    queryKey: [...attendanceKeys.cutWorkItems(), { includeInactive }] as const,
    queryFn: () => listAttendanceCutWorkItems(includeInactive),
  });
}

export function useAttendanceInventoryDiagnostics() {
  return useQuery({
    queryKey: [...attendanceKeys.all, "inventory-diagnostics"] as const,
    queryFn: () => listAttendanceInventoryDiagnostics(),
  });
}

export function useCreateAttendanceCutWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceBagTypeCreatePayload) => createAttendanceCutWorkItem(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useUpdateAttendanceCutWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bagTypeId, payload }: { bagTypeId: number; payload: AttendanceBagTypeUpdatePayload }) =>
      updateAttendanceCutWorkItem(bagTypeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useAttendanceCutWorkItemSearch(search: string) {
  return useQuery({
    queryKey: attendanceKeys.cutWorkItemsSearch(search),
    queryFn: () => searchAttendanceCutWorkItems(search),
    enabled: search.trim().length > 0,
  });
}

export function useAttendanceCutProductSearch(search: string) {
  return useQuery({
    queryKey: attendanceKeys.cutProductsSearch(search),
    queryFn: () => searchAttendanceCutProducts(search),
    enabled: search.trim().length > 0,
  });
}

export function useUpsertAttendanceCutWorkItemFromProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceBagTypeFromProductPayload) => upsertAttendanceCutWorkItemFromProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useAttendanceDayList(selectedDate: string) {
  return useQuery({
    queryKey: attendanceKeys.dayList(selectedDate),
    queryFn: () => listAttendanceDayEntryRows(selectedDate),
  });
}

export function useAttendanceDayEntry(employeeId: number | null, selectedDate: string) {
  return useQuery({
    queryKey: attendanceKeys.dayEntry(employeeId ?? 0, selectedDate),
    queryFn: () => getAttendanceDayEntry(employeeId ?? 0, selectedDate),
    enabled: employeeId !== null,
  });
}

export function useCreateAttendanceEmployee(search: string, team: AttendanceTeam | "all", includeInactive: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceEmployeeCreatePayload) => createAttendanceEmployee(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.employees(search, team, includeInactive) });
    },
  });
}

export function useUpdateAttendanceEmployee(search: string, team: AttendanceTeam | "all", includeInactive: boolean, employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceEmployeeUpdatePayload) => updateAttendanceEmployee(employeeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.employees(search, team, includeInactive) });
    },
  });
}

export function useDeleteAttendanceEmployee(search: string, team: AttendanceTeam | "all", includeInactive: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: number) => deleteAttendanceEmployee(employeeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.employees(search, team, includeInactive) });
    },
  });
}

export function useSaveAttendanceDayEntry(selectedDate: string, employeeId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ finalize, payload }: { finalize: boolean; payload: AttendanceDayEntrySavePayload }) =>
      saveAttendanceDayEntry(employeeId ?? 0, selectedDate, finalize, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.dayList(selectedDate) });
      if (employeeId !== null) {
        await queryClient.invalidateQueries({ queryKey: attendanceKeys.dayEntry(employeeId, selectedDate) });
      }
    },
  });
}

export function useAttendancePeriodReport(team: AttendanceTeam, periodId: number | null) {
  return useQuery({
    queryKey: attendanceKeys.periodReport(team, periodId ?? 0),
    queryFn: () => getAttendancePeriodReport(team, periodId ?? 0),
    enabled: periodId !== null,
  });
}

export function useAttendanceMonthlyReport(team: AttendanceTeam, month: string) {
  return useQuery({
    queryKey: attendanceKeys.monthlyReport(team, month),
    queryFn: () => getAttendanceMonthlyReport(team, month),
  });
}
