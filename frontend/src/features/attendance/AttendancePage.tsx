import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { isApiError } from "../../api/errors";
import type {
  AttendanceBagType,
  AttendanceCutLogItemPayload,
  AttendanceCutProductSearchResult,
  AttendanceDayEntryDetail,
  AttendanceDayEntrySavePayload,
  AttendanceEmployee,
  AttendanceEmployeeCreatePayload,
  AttendanceEmployeeUpdatePayload,
  AttendanceExtraCutLogItemPayload,
  AttendanceTeam,
  AttendanceWorkLogItemPayload,
  AttendanceWorkType,
} from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { formatMoney } from "../../domain/money";
import { adminRoutes } from "../../domain/routes";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { AttendanceEmployeeDialog } from "./AttendanceEmployeeDialog";
import { computeBlowPreviewTotal, computeCutPreviewTotal } from "./attendanceMath";
import {
  useAttendanceCutProductSearch,
  useAttendanceCutWorkItemSearch,
  useAttendanceDayEntry,
  useAttendanceDayList,
  useAttendanceEmployees,
  useCreateAttendanceEmployee,
  useDeleteAttendanceEmployee,
  useSaveAttendanceDayEntry,
  useSeedAttendanceDefaultWorkTypes,
  useAttendanceWorkTypes,
  useUpdateAttendanceEmployee,
  useUpsertAttendanceCutWorkItemFromProduct,
} from "./attendanceQueries";
import { AttendanceReportsTab } from "./AttendanceReportsTab";

type AttendanceTabKey = "employees" | "day_entry" | "reports";
type BagRow = { bag_type_id: number; quantity: string };
type PendingProductConfig = {
  product_id: number;
  product_name: string;
  product_code_base: string;
  quota_quantity: string;
  excess_unit_price: string;
};

const attendanceWriteRoles = ["owner", "admin", "attendance_manager"] as const;
const emptyBagTypes: AttendanceBagType[] = [];
const emptyCutProducts: AttendanceCutProductSearchResult[] = [];

function canMutateAttendance(role: string | undefined) {
  return attendanceWriteRoles.some((allowedRole) => allowedRole === role);
}

function teamLabel(team: AttendanceTeam) {
  return team === "blow" ? "Tổ thổi" : "Tổ cắt";
}

function statusLabel(status: AttendanceDayEntryDetail["status"] | "not_started" | "draft" | "done" | "absent") {
  switch (status) {
    case "draft":
      return "Nháp";
    case "done":
      return "Đã lưu";
    case "absent":
      return "Nghỉ";
    case "not_started":
    default:
      return "Chưa chấm";
  }
}

function normalizeQuantityText(value: string) {
  if (!value.includes(".")) {
    return value;
  }
  return value.replace(/\.?0+$/, "");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function matchingGroupWorkTypeIds(workTypes: AttendanceWorkType[], workTypeId: number) {
  const selected = workTypes.find((item) => item.id === workTypeId);
  if (!selected?.exclusive_group) {
    return [];
  }
  return workTypes
    .filter((item) => item.exclusive_group === selected.exclusive_group && item.id !== workTypeId)
    .map((item) => item.id);
}

function mergeBagTypes(current: AttendanceBagType[], nextItem: AttendanceBagType) {
  const otherItems = current.filter((item) => item.id !== nextItem.id);
  return [...otherItems, nextItem].sort((left, right) => left.id - right.id);
}

function addRowIfMissing(rows: BagRow[], bagTypeId: number) {
  if (rows.some((row) => row.bag_type_id === bagTypeId)) {
    return rows;
  }
  return [...rows, { bag_type_id: bagTypeId, quantity: "" }];
}

function bagTypeDisplayName(bagType: AttendanceBagType) {
  if (bagType.product_code_base) {
    return `${bagType.name} (${bagType.product_code_base})`;
  }
  return bagType.name;
}

function AttendanceEmployeeTab({ canMutate }: { canMutate: boolean }) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<AttendanceTeam | "all">("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<AttendanceEmployee | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const employeesQuery = useAttendanceEmployees(deferredSearch, teamFilter, includeInactive);
  const createMutation = useCreateAttendanceEmployee(deferredSearch, teamFilter, includeInactive);
  const updateMutation = useUpdateAttendanceEmployee(deferredSearch, teamFilter, includeInactive, editingEmployee?.id ?? 0);
  const deleteMutation = useDeleteAttendanceEmployee(deferredSearch, teamFilter, includeInactive);
  const employees = employeesQuery.data ?? [];

  async function handleCreateEmployee(payload: AttendanceEmployeeCreatePayload | AttendanceEmployeeUpdatePayload) {
    setMutationError(null);
    await createMutation.mutateAsync(payload as AttendanceEmployeeCreatePayload);
  }

  async function handleUpdateEmployee(payload: AttendanceEmployeeCreatePayload | AttendanceEmployeeUpdatePayload) {
    setMutationError(null);
    await updateMutation.mutateAsync(payload);
  }

  async function handleDeleteEmployee(employee: AttendanceEmployee) {
    if (!window.confirm(`Xóa nhân viên ${employee.display_name}?`)) {
      return;
    }
    setMutationError(null);
    try {
      await deleteMutation.mutateAsync(employee.id);
    } catch (error) {
      setMutationError(isApiError(error) ? error.message : "Không thể xóa nhân viên.");
    }
  }

  return (
    <div className="attendance-tab-content">
      <div className="attendance-control-strip">
        <label className="attendance-field">
          Tìm nhân viên
          <input
            aria-label="Tìm nhân viên"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên nhân viên"
          />
        </label>
        <label className="attendance-field">
          Lọc tổ
          <select aria-label="Lọc tổ" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value as AttendanceTeam | "all")}>
            <option value="all">Tất cả</option>
            <option value="blow">Tổ thổi</option>
            <option value="cut">Tổ cắt</option>
          </select>
        </label>
        <label className="attendance-checkbox">
          <input
            aria-label="Hiện nhân viên ngừng sử dụng"
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          <span>Hiện nhân viên ngừng sử dụng</span>
        </label>
        {canMutate ? (
          <button className="inventory-solid-button" type="button" onClick={() => setShowCreateDialog(true)}>
            Thêm nhân viên
          </button>
        ) : null}
      </div>

      {mutationError ? <p className="state-message error-message">{mutationError}</p> : null}
      {employeesQuery.isLoading ? <p className="state-message">Đang tải danh sách nhân viên...</p> : null}
      {employeesQuery.isError ? (
        <p className="state-message error-message">
          {isApiError(employeesQuery.error) ? employeesQuery.error.message : "Không thể tải danh sách nhân viên."}
        </p>
      ) : null}

      <div className="inventory-table-wrap attendance-table-wrap">
        <table className="data-table inventory-data-table attendance-data-table">
          <thead>
            <tr>
              <th>Tên nhân viên</th>
              <th>Tổ</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className={employee.is_active ? "inventory-row" : "inventory-row attendance-row--inactive"}>
                <td>{employee.display_name}</td>
                <td>{teamLabel(employee.team)}</td>
                <td>{employee.is_active ? "Đang sử dụng" : "Ngừng sử dụng"}</td>
                <td>
                  <div className="attendance-row-actions">
                    {canMutate ? (
                      <>
                        <button className="inventory-ghost-button" type="button" onClick={() => setEditingEmployee(employee)}>
                          Sửa
                        </button>
                        <button className="inventory-ghost-button inventory-ghost-button--danger" type="button" onClick={() => void handleDeleteEmployee(employee)}>
                          Xóa
                        </button>
                      </>
                    ) : (
                      <span className="inventory-subtext">Chỉ xem</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!employeesQuery.isLoading && employees.length === 0 ? (
              <tr>
                <td colSpan={4}>Chưa có nhân viên phù hợp.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCreateDialog ? (
        <AttendanceEmployeeDialog
          isSubmitting={createMutation.isPending}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreateEmployee}
        />
      ) : null}
      {editingEmployee ? (
        <AttendanceEmployeeDialog
          employee={editingEmployee}
          isSubmitting={updateMutation.isPending || deleteMutation.isPending}
          onClose={() => setEditingEmployee(null)}
          onSubmit={handleUpdateEmployee}
        />
      ) : null}
    </div>
  );
}

function AttendanceProductConfigCard({
  pendingConfig,
  disabled,
  title,
  onChange,
  onSubmit,
  onCancel,
}: {
  pendingConfig: PendingProductConfig;
  disabled: boolean;
  title: string;
  onChange: (next: PendingProductConfig) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="attendance-card">
      <div className="attendance-card__header">
        <h4>{title}</h4>
        <span>{pendingConfig.product_code_base}</span>
      </div>
      <p className="inventory-subtext">
        {pendingConfig.product_name} chưa được cấu hình chấm công cắt. Nhập định mức và đơn giá vượt để tạo liên kết.
      </p>
      <div className="attendance-add-row">
        <label className="attendance-field">
          Định mức
          <input
            aria-label={`${title} định mức`}
            type="number"
            min="0"
            step="0.5"
            value={pendingConfig.quota_quantity}
            disabled={disabled}
            onChange={(event) => onChange({ ...pendingConfig, quota_quantity: event.target.value })}
          />
        </label>
        <label className="attendance-field">
          Đơn giá vượt
          <input
            aria-label={`${title} đơn giá vượt`}
            type="number"
            min="0"
            step="100"
            value={pendingConfig.excess_unit_price}
            disabled={disabled}
            onChange={(event) => onChange({ ...pendingConfig, excess_unit_price: event.target.value })}
          />
        </label>
        <div className="attendance-row-actions">
          <button className="inventory-ghost-button" type="button" disabled={disabled} onClick={onSubmit}>
            Lưu cấu hình
          </button>
          <button className="inventory-ghost-button inventory-ghost-button--danger" type="button" disabled={disabled} onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceDayEntryEditor({ detail, canMutate }: { detail: AttendanceDayEntryDetail; canMutate: boolean }) {
  const [absent, setAbsent] = useState(detail.is_absent);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [cutSearch, setCutSearch] = useState("");
  const [extraCutSearch, setExtraCutSearch] = useState("");
  const [pendingCutConfig, setPendingCutConfig] = useState<PendingProductConfig | null>(null);
  const [extraCutEnabled, setExtraCutEnabled] = useState(detail.extra_cut_logs.length > 0);
  const [availableBagTypes, setAvailableBagTypes] = useState<AttendanceBagType[]>(detail.bag_types);
  const [tickValues, setTickValues] = useState<Record<number, boolean>>(() => {
    const nextValues: Record<number, boolean> = {};
    for (const workType of detail.work_types) {
      nextValues[workType.id] = workType.input_type === "tick"
        ? detail.work_logs.some((log) => log.work_type_id === workType.id)
        : false;
    }
    return nextValues;
  });
  const [quantityValues, setQuantityValues] = useState<Record<number, string>>(() => {
    const nextValues: Record<number, string> = {};
    for (const workType of detail.work_types) {
      const existingLog = detail.work_logs.find((log) => log.work_type_id === workType.id);
      nextValues[workType.id] = existingLog && workType.input_type !== "tick" ? normalizeQuantityText(existingLog.quantity) : "";
    }
    return nextValues;
  });
  const [cutRows, setCutRows] = useState<BagRow[]>(
    detail.cut_logs.map((log) => ({ bag_type_id: log.bag_type_id, quantity: normalizeQuantityText(log.quantity) })),
  );
  const [extraCutRows, setExtraCutRows] = useState<BagRow[]>(
    detail.extra_cut_logs.map((log) => ({ bag_type_id: log.bag_type_id, quantity: normalizeQuantityText(log.quantity) })),
  );
  const deferredCutSearch = useDeferredValue(cutSearch.trim());
  const deferredExtraCutSearch = useDeferredValue(extraCutSearch.trim());
  const configuredCutSearchQuery = useAttendanceCutWorkItemSearch(deferredCutSearch);
  const cutProductSearchQuery = useAttendanceCutProductSearch(deferredCutSearch);
  const upsertCutWorkItemMutation = useUpsertAttendanceCutWorkItemFromProduct();
  const saveMutation = useSaveAttendanceDayEntry(detail.selected_date, detail.employee_id);

  const filteredExtraCutOptions = useMemo(() => {
    const selectedIds = new Set(extraCutRows.map((row) => row.bag_type_id));
    return availableBagTypes.filter((bagType) => {
      if (selectedIds.has(bagType.id)) {
        return false;
      }
      if (!bagType.is_active || bagType.is_excluded_from_attendance || bagType.is_legacy) {
        return false;
      }
      if (!deferredExtraCutSearch) {
        return true;
      }
      const haystacks = [bagType.name, bagType.product_name ?? "", bagType.product_code_base ?? ""].join(" ").toLowerCase();
      return haystacks.includes(deferredExtraCutSearch.toLowerCase());
    });
  }, [availableBagTypes, deferredExtraCutSearch, extraCutRows]);

  const configuredCutSearchResults = useMemo(
    () => (configuredCutSearchQuery.data ?? emptyBagTypes).filter(
      (item) => item.is_active && item.is_product_linked && !item.is_excluded_from_attendance && !item.is_legacy,
    ),
    [configuredCutSearchQuery.data],
  );
  const productSearchResults = useMemo(() => {
    return (cutProductSearchQuery.data ?? emptyCutProducts).filter((product) => product.linked_bag_type_id === null);
  }, [cutProductSearchQuery.data]);

  const previewTotal = useMemo(() => {
    if (absent) {
      return 0;
    }
    if (detail.team === "blow") {
      return computeBlowPreviewTotal(detail.work_types, quantityValues, tickValues, extraCutEnabled ? extraCutRows : [], availableBagTypes);
    }
    return computeCutPreviewTotal(cutRows, availableBagTypes);
  }, [absent, availableBagTypes, cutRows, detail.team, extraCutEnabled, extraCutRows, quantityValues, tickValues, detail.work_types]);

  function setTickValue(workTypeId: number, checked: boolean) {
    const nextTicks = { ...tickValues, [workTypeId]: checked };
    if (checked) {
      for (const conflictingId of matchingGroupWorkTypeIds(detail.work_types, workTypeId)) {
        nextTicks[conflictingId] = false;
      }
    }
    setTickValues(nextTicks);
  }

  function setQuantityValue(workTypeId: number, value: string) {
    const nextValues = { ...quantityValues, [workTypeId]: value };
    if (Number(value) > 0) {
      const nextTicks = { ...tickValues };
      for (const conflictingId of matchingGroupWorkTypeIds(detail.work_types, workTypeId)) {
        nextTicks[conflictingId] = false;
        nextValues[conflictingId] = "";
      }
      setTickValues(nextTicks);
    }
    setQuantityValues(nextValues);
  }

  function buildSavePayload(): AttendanceDayEntrySavePayload {
    if (absent) {
      return { is_absent: true, blow_work: [], cut_work: [], extra_cut_work: [] };
    }

    const blowWork = detail.work_types.reduce<AttendanceWorkLogItemPayload[]>((items, workType) => {
      if (workType.input_type === "tick") {
        if (tickValues[workType.id]) {
          items.push({ work_type_id: workType.id, quantity: null });
        }
        return items;
      }
      const quantity = quantityValues[workType.id]?.trim();
      if (quantity) {
        items.push({ work_type_id: workType.id, quantity });
      }
      return items;
    }, []);

    const cutWork: AttendanceCutLogItemPayload[] = cutRows
      .map((row) => ({ bag_type_id: row.bag_type_id, quantity: row.quantity.trim() }))
      .filter((row) => row.quantity !== "");

    const extraCutWork: AttendanceExtraCutLogItemPayload[] = extraCutEnabled
      ? extraCutRows
        .map((row) => ({ bag_type_id: row.bag_type_id, quantity: row.quantity.trim() }))
        .filter((row) => row.quantity !== "")
      : [];

    return {
      is_absent: false,
      blow_work: blowWork,
      cut_work: cutWork,
      extra_cut_work: extraCutWork,
    };
  }

  async function handleSave(finalize: boolean) {
    setFormError(null);
    setSaveMessage(null);
    try {
      const result = await saveMutation.mutateAsync({ finalize, payload: buildSavePayload() });
      setSaveMessage(
        absent
          ? (finalize ? "Đã lưu chính thức." : "Đã lưu nháp.")
          : `${finalize ? "Đã lưu chính thức" : "Đã lưu nháp"} · Tổng: ${formatMoney(result.total_amount_snapshot)}`,
      );
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Không thể lưu chấm công.");
    }
  }

  function handleAddConfiguredBagType(bagType: AttendanceBagType, target: "cut" | "extra_cut") {
    setAvailableBagTypes((current) => mergeBagTypes(current, bagType));
    if (target === "cut") {
      setCutRows((current) => addRowIfMissing(current, bagType.id));
      setCutSearch("");
    } else {
      setExtraCutEnabled(true);
      setExtraCutRows((current) => addRowIfMissing(current, bagType.id));
      setExtraCutSearch("");
    }
    setFormError(null);
  }

  async function handleSelectCutProduct(result: AttendanceCutProductSearchResult) {
    setFormError(null);
    if (result.is_configured_for_attendance && result.linked_bag_type_id !== null) {
      const existing = configuredCutSearchResults.find((item) => item.id === result.linked_bag_type_id)
        ?? availableBagTypes.find((item) => item.id === result.linked_bag_type_id);
      if (existing) {
        handleAddConfiguredBagType(existing, "cut");
        return;
      }

      try {
        const bagType = await upsertCutWorkItemMutation.mutateAsync({
          product_id: result.product_id,
          quota_quantity: result.quota_quantity,
          excess_unit_price: result.excess_unit_price,
        });
        handleAddConfiguredBagType(bagType, "cut");
      } catch (error) {
        setFormError(isApiError(error) ? error.message : "Không thể dùng sản phẩm cắt đã chọn.");
      }
      return;
    }

    setPendingCutConfig({
      product_id: result.product_id,
      product_name: result.product_name,
      product_code_base: result.product_code_base,
      quota_quantity: result.quota_quantity ?? "",
      excess_unit_price: result.excess_unit_price ?? "",
    });
  }

  async function handleSaveCutProductConfig() {
    if (!pendingCutConfig) {
      return;
    }
    setFormError(null);
    try {
      const bagType = await upsertCutWorkItemMutation.mutateAsync({
        product_id: pendingCutConfig.product_id,
        quota_quantity: pendingCutConfig.quota_quantity,
        excess_unit_price: pendingCutConfig.excess_unit_price,
      });
      handleAddConfiguredBagType(bagType, "cut");
      setPendingCutConfig(null);
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Không thể cấu hình sản phẩm cắt.");
    }
  }

  const isReadOnly = !canMutate;
  const formDisabled = absent || isReadOnly || saveMutation.isPending;

  return (
    <div className="attendance-form-stack">
      <div className="attendance-summary-grid">
        <div className="attendance-summary-card">
          <span>Trạng thái</span>
          <strong>{statusLabel(detail.status)}</strong>
        </div>
        <div className="attendance-summary-card">
          <span>Tổng đã lưu</span>
          <strong>{formatMoney(detail.total_amount_snapshot)}</strong>
        </div>
        <div className="attendance-summary-card">
          <span>Tổng tạm tính</span>
          <strong>{formatMoney(previewTotal.toFixed(0))}</strong>
        </div>
      </div>

      <label className="attendance-checkbox">
        <input
          aria-label="Nghỉ"
          type="checkbox"
          checked={absent}
          disabled={isReadOnly}
          onChange={(event) => setAbsent(event.target.checked)}
        />
        <span>Nghỉ</span>
      </label>

      {detail.team === "blow" ? (
        <>
          <section className="attendance-card">
            <div className="attendance-card__header">
              <h4>Việc tổ thổi</h4>
            </div>
            {detail.work_types.length === 0 ? (
              <p className="state-message">Chưa có công việc tổ thổi mặc định.</p>
            ) : (
              <div className="attendance-work-list">
                {detail.work_types.map((workType) => (
                  <div key={workType.id} className="attendance-work-row">
                    <div>
                      <strong>{workType.name}</strong>
                      <span>{formatMoney(workType.unit_price)} · {workType.input_type === "tick" ? "tick" : "số lượng"}</span>
                    </div>
                    {workType.input_type === "tick" ? (
                      <label className="attendance-checkbox">
                        <input
                          aria-label={workType.name}
                          type="checkbox"
                          checked={Boolean(tickValues[workType.id])}
                          disabled={formDisabled}
                          onChange={(event) => setTickValue(workType.id, event.target.checked)}
                        />
                        <span>Chọn</span>
                      </label>
                    ) : (
                      <input
                        aria-label={workType.name}
                        type="number"
                        min="0"
                        step="0.5"
                        value={quantityValues[workType.id] ?? ""}
                        disabled={formDisabled}
                        onChange={(event) => setQuantityValue(workType.id, event.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="attendance-card">
            <div className="attendance-card__header">
              <h4>Làm thêm cắt / VK</h4>
            </div>
            <label className="attendance-checkbox">
              <input
                aria-label="Có làm thêm cắt"
                type="checkbox"
                checked={extraCutEnabled}
                disabled={isReadOnly || saveMutation.isPending}
                onChange={(event) => setExtraCutEnabled(event.target.checked)}
              />
              <span>Có làm thêm cắt</span>
            </label>
            {extraCutEnabled ? (
              <>
                <div className="attendance-add-row">
                  <input
                    aria-label="Tìm loại VK"
                    value={extraCutSearch}
                    onChange={(event) => setExtraCutSearch(event.target.value)}
                    disabled={formDisabled}
                    placeholder="Tìm mặt hàng cắt hoặc mã sản phẩm"
                  />
                </div>
                {filteredExtraCutOptions.length > 0 ? (
                  <div className="attendance-search-results">
                    {filteredExtraCutOptions.map((bagType) => (
                      <button
                        key={bagType.id}
                        className="inventory-ghost-button"
                        type="button"
                        disabled={formDisabled}
                        onClick={() => handleAddConfiguredBagType(bagType, "extra_cut")}
                      >
                        {bagTypeDisplayName(bagType)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="inventory-subtext">Chưa có mặt hàng cắt hoạt động phù hợp để thêm vào VK.</p>
                )}
                <div className="inventory-table-wrap attendance-table-wrap">
                  <table className="data-table inventory-data-table attendance-data-table">
                    <thead>
                      <tr>
                        <th>Loại bao</th>
                        <th>Số lượng</th>
                        <th>Đơn giá vượt</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraCutRows.map((row) => {
                        const bagType = availableBagTypes.find((item) => item.id === row.bag_type_id);
                        return (
                          <tr key={row.bag_type_id}>
                            <td>{bagType ? bagTypeDisplayName(bagType) : row.bag_type_id}</td>
                            <td>
                              <input
                                aria-label={`Số lượng VK ${bagType?.name ?? row.bag_type_id}`}
                                type="number"
                                min="0"
                                step="0.5"
                                value={row.quantity}
                                disabled={formDisabled}
                                onChange={(event) =>
                                  setExtraCutRows((current) =>
                                    current.map((item) => item.bag_type_id === row.bag_type_id ? { ...item, quantity: event.target.value } : item),
                                  )
                                }
                              />
                            </td>
                            <td>{bagType ? formatMoney(bagType.excess_unit_price) : "-"}</td>
                            <td>
                              <button
                                className="inventory-ghost-button inventory-ghost-button--danger"
                                type="button"
                                disabled={formDisabled}
                                onClick={() => setExtraCutRows((current) => current.filter((item) => item.bag_type_id !== row.bag_type_id))}
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {extraCutRows.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Chưa chọn loại VK.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <section className="attendance-card">
            <div className="attendance-card__header">
              <h4>Sản lượng tổ cắt</h4>
            </div>
            <div className="attendance-add-row">
              <input
                aria-label="Tìm mặt hàng cắt"
                value={cutSearch}
                onChange={(event) => setCutSearch(event.target.value)}
                disabled={formDisabled}
                placeholder="Tìm mặt hàng cắt hoặc mã sản phẩm"
              />
            </div>
            {deferredCutSearch ? (
              <>
                {configuredCutSearchResults.length > 0 ? (
                  <div className="attendance-search-results">
                    {configuredCutSearchResults.map((bagType) => (
                      <button
                        key={bagType.id}
                        className="inventory-ghost-button"
                        type="button"
                        disabled={formDisabled}
                        onClick={() => handleAddConfiguredBagType(bagType, "cut")}
                      >
                        {bagTypeDisplayName(bagType)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {productSearchResults.length > 0 ? (
                  <div className="attendance-search-results">
                    {productSearchResults.map((result) => (
                      <button
                        key={result.product_id}
                        className="inventory-ghost-button"
                        type="button"
                        disabled={formDisabled}
                        onClick={() => void handleSelectCutProduct(result)}
                      >
                        {result.product_name} ({result.product_code_base}) {result.is_configured_for_attendance ? "· Đã cấu hình" : "· Cần cấu hình"}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!configuredCutSearchResults.length && !productSearchResults.length && !configuredCutSearchQuery.isLoading && !cutProductSearchQuery.isLoading ? (
                  <p className="inventory-subtext">Không tìm thấy mặt hàng cắt phù hợp.</p>
                ) : null}
              </>
            ) : (
              <p className="inventory-subtext">Nhập tên hoặc mã sản phẩm để tìm mặt hàng cắt.</p>
            )}
          </section>

          {pendingCutConfig ? (
            <AttendanceProductConfigCard
              pendingConfig={pendingCutConfig}
              disabled={formDisabled || upsertCutWorkItemMutation.isPending}
              title="Cấu hình mặt hàng cắt"
              onChange={setPendingCutConfig}
              onSubmit={() => void handleSaveCutProductConfig()}
              onCancel={() => setPendingCutConfig(null)}
            />
          ) : null}

          <section className="attendance-card">
            <div className="attendance-card__header">
              <h4>Mặt hàng đã chọn</h4>
            </div>
            <div className="inventory-table-wrap attendance-table-wrap">
              <table className="data-table inventory-data-table attendance-data-table">
                <thead>
                  <tr>
                    <th>Loại bao</th>
                    <th>Số lượng</th>
                    <th>Định mức</th>
                    <th>Đơn giá vượt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cutRows.map((row) => {
                    const bagType = availableBagTypes.find((item) => item.id === row.bag_type_id);
                    return (
                      <tr key={row.bag_type_id}>
                        <td>{bagType ? bagTypeDisplayName(bagType) : row.bag_type_id}</td>
                        <td>
                          <input
                            aria-label={`Số lượng ${bagType?.name ?? row.bag_type_id}`}
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.quantity}
                            disabled={formDisabled}
                            onChange={(event) =>
                              setCutRows((current) =>
                                current.map((item) => item.bag_type_id === row.bag_type_id ? { ...item, quantity: event.target.value } : item),
                              )
                            }
                          />
                        </td>
                        <td>{bagType?.quota_quantity ?? "-"}</td>
                        <td>{bagType ? formatMoney(bagType.excess_unit_price) : "-"}</td>
                        <td>
                          <button
                            className="inventory-ghost-button inventory-ghost-button--danger"
                            type="button"
                            disabled={formDisabled}
                            onClick={() => setCutRows((current) => current.filter((item) => item.bag_type_id !== row.bag_type_id))}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cutRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Chưa chọn mặt hàng cắt.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {formError ? <p className="state-message error-message">{formError}</p> : null}
      {saveMessage ? <p className="state-message">{saveMessage}</p> : null}

      {canMutate ? (
        <div className="form-actions attendance-form-actions">
          <button type="button" className="secondary-link" disabled={saveMutation.isPending} onClick={() => void handleSave(false)}>
            Lưu nháp
          </button>
          <button type="button" disabled={saveMutation.isPending} onClick={() => void handleSave(true)}>
            Lưu chính thức
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AttendanceDayEntryTab({ canMutate }: { canMutate: boolean }) {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [preferredEmployeeId, setPreferredEmployeeId] = useState<number | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const autoSeedAttemptedRef = useRef(false);
  const dayListQuery = useAttendanceDayList(selectedDate);
  const workTypesQuery = useAttendanceWorkTypes();
  const seedDefaultsMutation = useSeedAttendanceDefaultWorkTypes();
  const rows = dayListQuery.data ?? [];
  const selectedEmployeeId = rows.some((row) => row.id === preferredEmployeeId) ? preferredEmployeeId : (rows[0]?.id ?? null);
  const detailQuery = useAttendanceDayEntry(selectedEmployeeId, selectedDate);
  const detail = detailQuery.data;
  const hasNoBlowWorkTypes = !workTypesQuery.isLoading && (workTypesQuery.data?.length ?? 0) === 0;

  useEffect(() => {
    if (!canMutate || !hasNoBlowWorkTypes || autoSeedAttemptedRef.current) {
      return;
    }
    autoSeedAttemptedRef.current = true;
    void seedDefaultsMutation.mutateAsync()
      .then((result) => {
        if (result.created_count > 0) {
          setSeedMessage(`Đã tạo ${result.created_count} công việc tổ thổi mặc định.`);
        }
        setSeedError(null);
      })
      .catch((error) => {
        setSeedError(isApiError(error) ? error.message : "Không thể tạo công việc tổ thổi mặc định.");
        autoSeedAttemptedRef.current = false;
      });
  }, [canMutate, hasNoBlowWorkTypes, seedDefaultsMutation]);

  async function handleSeedDefaults() {
    setSeedError(null);
    setSeedMessage(null);
    try {
      const result = await seedDefaultsMutation.mutateAsync();
      setSeedMessage(
        result.created_count > 0
          ? `Đã tạo ${result.created_count} công việc tổ thổi mặc định.`
          : "Công việc tổ thổi mặc định đã tồn tại.",
      );
    } catch (error) {
      setSeedError(isApiError(error) ? error.message : "Không thể tạo công việc tổ thổi mặc định.");
    }
  }

  return (
    <div className="attendance-tab-content">
      <div className="attendance-control-strip">
        <label className="attendance-field">
          Ngày chấm công
          <input aria-label="Ngày chấm công" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        {canMutate ? (
          <button
            className="inventory-ghost-button"
            type="button"
            onClick={() => void handleSeedDefaults()}
            disabled={seedDefaultsMutation.isPending}
          >
            Tạo công việc tổ thổi mặc định
          </button>
        ) : null}
        {!canMutate ? <p className="inventory-subtext">Chế độ chỉ xem. Không thể chỉnh sửa hoặc lưu chấm công.</p> : null}
      </div>
      {seedError ? <p className="state-message error-message">{seedError}</p> : null}
      {seedMessage ? <p className="state-message">{seedMessage}</p> : null}

      <div className="attendance-layout-grid">
        <section className="attendance-panel attendance-panel--list">
          <div className="attendance-panel__header">
            <h3>Danh sách trạng thái</h3>
            <span>{selectedDate}</span>
          </div>
          {dayListQuery.isLoading ? <p className="state-message">Đang tải trạng thái chấm công...</p> : null}
          {dayListQuery.isError ? (
            <p className="state-message error-message">
              {isApiError(dayListQuery.error) ? dayListQuery.error.message : "Không thể tải trạng thái chấm công."}
            </p>
          ) : null}
          <div className="inventory-table-wrap attendance-table-wrap">
            <table className="data-table inventory-data-table attendance-data-table">
              <thead>
                <tr>
                  <th>Tên nhân viên</th>
                  <th>Tổ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={selectedEmployeeId === row.id ? "inventory-row selected" : "inventory-row"} onClick={() => setPreferredEmployeeId(row.id)}>
                    <td>{row.display_name}</td>
                    <td>{teamLabel(row.team)}</td>
                    <td>{statusLabel(row.status)}</td>
                  </tr>
                ))}
                {!dayListQuery.isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Không có nhân viên hoạt động cho ngày đã chọn.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="attendance-panel attendance-panel--form">
          <div className="attendance-panel__header">
            <h3>Chi tiết chấm công</h3>
            <span>{detail ? `${detail.display_name} · ${teamLabel(detail.team)}` : "Chọn một nhân viên"}</span>
          </div>
          {detailQuery.isLoading ? <p className="state-message">Đang tải chi tiết chấm công...</p> : null}
          {detailQuery.isError ? (
            <p className="state-message error-message">
              {isApiError(detailQuery.error) ? detailQuery.error.message : "Không thể tải chi tiết chấm công."}
            </p>
          ) : null}
          {detail ? (
            <AttendanceDayEntryEditor
              key={`${detail.employee_id}:${detail.selected_date}:${detail.total_amount_snapshot}:${detail.status}`}
              detail={detail}
              canMutate={canMutate}
            />
          ) : (
            <p className="state-message">Chọn một nhân viên để nhập chấm công.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function AttendancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AttendanceTabKey>("employees");
  const canMutate = canMutateAttendance(user?.role);

  return (
    <InventoryModuleShell
      title="Chấm công"
      description="Quản lý nhân viên, nhập chấm công theo ngày và xem báo cáo."
      activeNavPath={adminRoutes.attendance}
      contentClassName="attendance-page-layout"
      compactHero
    >
      <div className="inventory-mode-tabs attendance-page-tabs" role="tablist" aria-label="Điều hướng chấm công">
        <button
          className={activeTab === "employees" ? "inventory-mode-tab active" : "inventory-mode-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "employees"}
          onClick={() => setActiveTab("employees")}
        >
          Nhân viên
        </button>
        <button
          className={activeTab === "day_entry" ? "inventory-mode-tab active" : "inventory-mode-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "day_entry"}
          onClick={() => setActiveTab("day_entry")}
        >
          Chấm công
        </button>
        <button
          className={activeTab === "reports" ? "inventory-mode-tab active" : "inventory-mode-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "reports"}
          onClick={() => setActiveTab("reports")}
        >
          Báo cáo
        </button>
      </div>

      {activeTab === "employees" ? <AttendanceEmployeeTab canMutate={canMutate} /> : null}
      {activeTab === "day_entry" ? <AttendanceDayEntryTab canMutate={canMutate} /> : null}
      {activeTab === "reports" ? <AttendanceReportsTab canMutate={canMutate} /> : null}
    </InventoryModuleShell>
  );
}
