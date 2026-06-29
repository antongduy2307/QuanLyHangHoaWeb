import { useDeferredValue, useMemo, useState } from "react";

import { isApiError } from "../../api/errors";
import type {
  AttendanceBagType,
  AttendanceInventoryDiagnosticIssue,
  AttendanceWorkInputType,
  AttendanceWorkPricingRule,
  AttendanceWorkType,
} from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { env, isAuthBypassEnabled } from "../../config/env";
import { formatMoney } from "../../domain/money";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import {
  useAttendanceCutProductSearch,
  useAttendanceCutWorkItems,
  useAttendanceInventoryDiagnostics,
  useAttendanceWorkTypes,
  useCreateAttendanceWorkType,
  useSeedAttendanceDefaultWorkTypes,
  useUpdateAttendanceCutWorkItem,
  useUpdateAttendanceWorkType,
  useUpsertAttendanceCutWorkItemFromProduct,
} from "../attendance/attendanceQueries";

type SettingsSectionKey = "overview" | "attendance" | "backup_import" | "user_roles";

type SettingsSection = {
  key: SettingsSectionKey;
  title: string;
  description: string;
};

type BlowWorkTypeFormState = {
  id: number | null;
  name: string;
  input_type: AttendanceWorkInputType;
  pricing_rule: AttendanceWorkPricingRule;
  quota_quantity: string;
  unit_price: string;
  exclusive_group: string;
  is_active: boolean;
};

type CutItemFormState = {
  id: number | null;
  name: string;
  product_id: number | null;
  source_product_name_snapshot: string;
  quota_quantity: string;
  excess_unit_price: string;
  is_active: boolean;
  is_product_linked: boolean;
  is_excluded_from_attendance: boolean;
  is_legacy: boolean;
};

type ProductLinkDraft = {
  product_id: number;
  product_name: string;
  product_code_base: string;
  quota_quantity: string;
  excess_unit_price: string;
};

const ownerAdminSections: SettingsSection[] = [
  {
    key: "overview",
    title: "Tổng quan hệ thống",
    description: "Thông tin vận hành an toàn cho ứng dụng web, không hiển thị bí mật cấu hình.",
  },
  {
    key: "attendance",
    title: "Chấm công",
    description: "Quản lý công việc tổ thổi, mặt hàng tổ cắt và kiểm tra đồng bộ tồn kho chấm công.",
  },
  {
    key: "backup_import",
    title: "Sao lưu / nhập dữ liệu",
    description: "Khu vực định hướng cho sao lưu, nhập dữ liệu và quy trình rehearsal an toàn.",
  },
  {
    key: "user_roles",
    title: "Người dùng & phân quyền",
    description: "Khu vực định hướng cho quản trị người dùng, vai trò và quyền thao tác.",
  },
];

const readOnlySections: SettingsSection[] = [ownerAdminSections[0]];
const attendanceManagerSections: SettingsSection[] = [ownerAdminSections[1]];

const defaultBlowWorkTypeFormState: BlowWorkTypeFormState = {
  id: null,
  name: "",
  input_type: "quantity",
  pricing_rule: "quantity_full",
  quota_quantity: "",
  unit_price: "",
  exclusive_group: "",
  is_active: true,
};

const defaultCutItemFormState: CutItemFormState = {
  id: null,
  name: "",
  product_id: null,
  source_product_name_snapshot: "",
  quota_quantity: "",
  excess_unit_price: "",
  is_active: true,
  is_product_linked: false,
  is_excluded_from_attendance: false,
  is_legacy: false,
};

function canMutateAttendanceSettings(role: string | undefined) {
  return role === "owner" || role === "admin" || role === "attendance_manager";
}

function buildSystemCards() {
  const environmentLabel = import.meta.env.MODE === "production"
    ? "Production"
    : import.meta.env.MODE === "test"
      ? "Test"
      : "Development";
  const apiHost = (() => {
    try {
      return new URL(env.apiBaseUrl).origin;
    } catch {
      return "Không xác định";
    }
  })();

  return [
    {
      title: "Môi trường",
      value: environmentLabel,
      detail: isAuthBypassEnabled() ? "Có bật bypass đăng nhập cục bộ." : "Chế độ xác thực chuẩn đang hoạt động.",
    },
    {
      title: "Phiên bản",
      value: "Web shell",
      detail: `Frontend hiện dùng API tại ${apiHost}.`,
    },
    {
      title: "Dữ liệu",
      value: "PostgreSQL tập trung",
      detail: "Đường dẫn hoặc chuỗi kết nối không hiển thị trong giao diện này.",
    },
    {
      title: "Trạng thái hệ thống",
      value: "Chỉ đọc",
      detail: "Các thay đổi cấu hình nguy hiểm sẽ chỉ được mở sau khi có thiết kế an toàn.",
    },
  ];
}

function normalizeQuantityText(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return value.replace(/\.?0+$/, "");
}

function issueLabel(issueType: string) {
  switch (issueType) {
    case "finalized_record_missing_inventory_effect":
      return "Thiếu inventory effect";
    case "effect_product_mismatch":
      return "Sai liên kết hàng hóa";
    case "effect_quantity_mismatch":
      return "Sai số lượng effect";
    case "effect_exists_for_non_final_record":
      return "Effect còn tồn tại cho bản ghi nháp/nghỉ";
    default:
      return issueType;
  }
}

function workTypeInputLabel(inputType: AttendanceWorkInputType) {
  return inputType === "tick" ? "Tick" : "Số lượng";
}

function pricingRuleLabel(rule: AttendanceWorkPricingRule) {
  switch (rule) {
    case "flat_tick":
      return "Tick cố định";
    case "quantity_excess_over_quota":
      return "Vượt định mức";
    case "quantity_full":
    default:
      return "Theo số lượng";
  }
}

function SystemOverviewSection() {
  const cards = buildSystemCards();

  return (
    <div className="settings-section-stack">
      <div className="settings-overview-grid">
        {cards.map((card) => (
          <article key={card.title} className="settings-overview-card">
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <section className="inventory-detail-card">
        <div className="inventory-section-heading">
          <h3>Giới hạn hiển thị</h3>
          <span>An toàn hệ thống</span>
        </div>
        <p className="inventory-subtext">
          Màn hình này không hiển thị `DATABASE_URL`, khóa bí mật xác thực, cấu hình token, CORS hoặc các biến triển khai nhạy cảm.
        </p>
      </section>
    </div>
  );
}

function BlowWorkTypesPanel({
  canMutate,
  workTypes,
}: {
  canMutate: boolean;
  workTypes: AttendanceWorkType[];
}) {
  const [formState, setFormState] = useState<BlowWorkTypeFormState>(defaultBlowWorkTypeFormState);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateAttendanceWorkType();
  const updateMutation = useUpdateAttendanceWorkType();
  const seedMutation = useSeedAttendanceDefaultWorkTypes();

  function startEdit(workType: AttendanceWorkType) {
    setFormState({
      id: workType.id,
      name: workType.name,
      input_type: workType.input_type,
      pricing_rule: workType.pricing_rule,
      quota_quantity: normalizeQuantityText(workType.quota_quantity),
      unit_price: normalizeQuantityText(workType.unit_price),
      exclusive_group: workType.exclusive_group ?? "",
      is_active: workType.is_active,
    });
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setFormState(defaultBlowWorkTypeFormState);
  }

  async function handleSubmit() {
    setMessage(null);
    setError(null);
    try {
      if (formState.id === null) {
        await createMutation.mutateAsync({
          name: formState.name,
          input_type: formState.input_type,
          pricing_rule: formState.pricing_rule,
          quota_quantity: formState.quota_quantity || null,
          unit_price: formState.unit_price,
          exclusive_group: formState.exclusive_group || null,
          is_active: formState.is_active,
        });
        setMessage("Đã tạo công việc tổ thổi.");
      } else {
        await updateMutation.mutateAsync({
          workTypeId: formState.id,
          payload: {
            name: formState.name,
            input_type: formState.input_type,
            pricing_rule: formState.pricing_rule,
            quota_quantity: formState.quota_quantity || null,
            unit_price: formState.unit_price,
            exclusive_group: formState.exclusive_group || null,
            is_active: formState.is_active,
          },
        });
        setMessage("Đã cập nhật công việc tổ thổi.");
      }
      resetForm();
    } catch (mutationError) {
      setError(isApiError(mutationError) ? mutationError.message : "Không thể lưu công việc tổ thổi.");
    }
  }

  async function handleToggleActive(workType: AttendanceWorkType) {
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        workTypeId: workType.id,
        payload: {
          name: workType.name,
          input_type: workType.input_type,
          pricing_rule: workType.pricing_rule,
          quota_quantity: workType.quota_quantity,
          unit_price: workType.unit_price,
          exclusive_group: workType.exclusive_group,
          is_active: !workType.is_active,
        },
      });
      setMessage(workType.is_active ? "Đã ngừng sử dụng công việc tổ thổi." : "Đã kích hoạt lại công việc tổ thổi.");
    } catch (mutationError) {
      setError(isApiError(mutationError) ? mutationError.message : "Không thể đổi trạng thái công việc tổ thổi.");
    }
  }

  async function handleSeedDefaults() {
    setMessage(null);
    setError(null);
    try {
      const result = await seedMutation.mutateAsync();
      setMessage(
        result.created_count > 0
          ? `Đã tạo ${result.created_count} công việc tổ thổi mặc định.`
          : "Công việc tổ thổi mặc định đã tồn tại.",
      );
    } catch (mutationError) {
      setError(isApiError(mutationError) ? mutationError.message : "Không thể tạo mặc định tổ thổi.");
    }
  }

  return (
    <section className="inventory-detail-card">
      <div className="inventory-section-heading">
        <h3>Tổ thổi</h3>
        {canMutate ? (
          <button className="inventory-ghost-button" type="button" onClick={() => void handleSeedDefaults()} disabled={seedMutation.isPending}>
            Tạo mặc định
          </button>
        ) : null}
      </div>
      <p className="inventory-subtext">
        Thay đổi chỉ áp dụng cho bản ghi chấm công tương lai. Bản ghi lịch sử vẫn dùng snapshot đã lưu.
      </p>
      {error ? <p className="state-message error-message">{error}</p> : null}
      {message ? <p className="state-message">{message}</p> : null}

      <div className="inventory-table-wrap attendance-table-wrap">
        <table className="data-table inventory-data-table attendance-data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Loại nhập</th>
              <th>Quy tắc giá</th>
              <th>Định mức</th>
              <th>Đơn giá</th>
              <th>Nhóm loại trừ</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workTypes.map((workType) => (
              <tr key={workType.id} className={workType.is_active ? "inventory-row" : "inventory-row attendance-row--inactive"}>
                <td>{workType.name}</td>
                <td>{workTypeInputLabel(workType.input_type)}</td>
                <td>{pricingRuleLabel(workType.pricing_rule)}</td>
                <td>{workType.quota_quantity ?? "-"}</td>
                <td>{formatMoney(workType.unit_price)}</td>
                <td>{workType.exclusive_group ?? "-"}</td>
                <td>{workType.is_active ? "Đang dùng" : "Ngừng dùng"}</td>
                <td>
                  <div className="attendance-row-actions">
                    <button className="inventory-ghost-button" type="button" onClick={() => startEdit(workType)}>
                      Sửa
                    </button>
                    {canMutate ? (
                      <button className="inventory-ghost-button" type="button" onClick={() => void handleToggleActive(workType)}>
                        {workType.is_active ? "Ngừng dùng" : "Kích hoạt"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="settings-form-grid">
        <label className="attendance-field">
          Tên công việc
          <input value={formState.name} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label className="attendance-field">
          Loại nhập
          <select
            value={formState.input_type}
            disabled={!canMutate}
            onChange={(event) => setFormState((current) => ({ ...current, input_type: event.target.value as AttendanceWorkInputType }))}
          >
            <option value="quantity">Số lượng</option>
            <option value="tick">Tick</option>
          </select>
        </label>
        <label className="attendance-field">
          Quy tắc giá
          <select
            value={formState.pricing_rule}
            disabled={!canMutate}
            onChange={(event) => setFormState((current) => ({ ...current, pricing_rule: event.target.value as AttendanceWorkPricingRule }))}
          >
            <option value="quantity_full">Theo số lượng</option>
            <option value="quantity_excess_over_quota">Vượt định mức</option>
            <option value="flat_tick">Tick cố định</option>
          </select>
        </label>
        <label className="attendance-field">
          Định mức
          <input
            type="number"
            min="0"
            step="0.5"
            value={formState.quota_quantity}
            disabled={!canMutate}
            onChange={(event) => setFormState((current) => ({ ...current, quota_quantity: event.target.value }))}
          />
        </label>
        <label className="attendance-field">
          Đơn giá
          <input
            type="number"
            min="0"
            step="100"
            value={formState.unit_price}
            disabled={!canMutate}
            onChange={(event) => setFormState((current) => ({ ...current, unit_price: event.target.value }))}
          />
        </label>
        <label className="attendance-field">
          Nhóm loại trừ
          <input
            value={formState.exclusive_group}
            disabled={!canMutate}
            onChange={(event) => setFormState((current) => ({ ...current, exclusive_group: event.target.value }))}
          />
        </label>
        <label className="attendance-checkbox">
          <input
            type="checkbox"
            checked={formState.is_active}
            disabled={!canMutate}
            onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))}
          />
          <span>Đang sử dụng</span>
        </label>
      </div>
      {canMutate ? (
        <div className="attendance-row-actions">
          <button className="inventory-solid-button" type="button" onClick={() => void handleSubmit()} disabled={createMutation.isPending || updateMutation.isPending}>
            {formState.id === null ? "Tạo công việc" : "Lưu thay đổi"}
          </button>
          {formState.id !== null ? (
            <button className="inventory-ghost-button" type="button" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CutItemsPanel({
  canMutate,
  bagTypes,
}: {
  canMutate: boolean;
  bagTypes: AttendanceBagType[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [linkDraft, setLinkDraft] = useState<ProductLinkDraft | null>(null);
  const [formState, setFormState] = useState<CutItemFormState>(defaultCutItemFormState);
  const deferredSearch = useDeferredValue(search.trim());
  const productSearchQuery = useAttendanceCutProductSearch(deferredSearch);
  const upsertMutation = useUpsertAttendanceCutWorkItemFromProduct();
  const updateMutation = useUpdateAttendanceCutWorkItem();

  function startEdit(item: AttendanceBagType) {
    setFormState({
      id: item.id,
      name: item.name,
      product_id: item.product_id,
      source_product_name_snapshot: item.source_product_name_snapshot ?? "",
      quota_quantity: normalizeQuantityText(item.quota_quantity),
      excess_unit_price: normalizeQuantityText(item.excess_unit_price),
      is_active: item.is_active,
      is_product_linked: item.is_product_linked,
      is_excluded_from_attendance: item.is_excluded_from_attendance,
      is_legacy: item.is_legacy,
    });
    setLinkDraft(null);
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setFormState(defaultCutItemFormState);
    setLinkDraft(null);
  }

  async function handleSaveLinkedProduct() {
    if (!linkDraft) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await upsertMutation.mutateAsync({
        product_id: linkDraft.product_id,
        quota_quantity: linkDraft.quota_quantity,
        excess_unit_price: linkDraft.excess_unit_price,
      });
      setMessage("Đã tạo hoặc cập nhật mặt hàng tổ cắt từ sản phẩm.");
      resetForm();
      setSearch("");
    } catch (mutationError) {
      setError(isApiError(mutationError) ? mutationError.message : "Không thể lưu liên kết hàng hóa.");
    }
  }

  async function handleUpdateCutItem() {
    if (formState.id === null) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        bagTypeId: formState.id,
        payload: {
          name: formState.name,
          product_id: formState.product_id,
          source_product_name_snapshot: formState.source_product_name_snapshot || null,
          quota_quantity: formState.quota_quantity,
          excess_unit_price: formState.excess_unit_price,
          is_active: formState.is_active,
          is_product_linked: formState.is_product_linked,
          is_excluded_from_attendance: formState.is_excluded_from_attendance,
          is_legacy: formState.is_legacy,
        },
      });
      setMessage("Đã cập nhật mặt hàng tổ cắt.");
      resetForm();
    } catch (mutationError) {
      setError(isApiError(mutationError) ? mutationError.message : "Không thể cập nhật mặt hàng tổ cắt.");
    }
  }

  async function handleQuickToggle(item: AttendanceBagType, patch: Partial<CutItemFormState>, successMessage: string) {
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        bagTypeId: item.id,
        payload: {
          name: patch.name ?? item.name,
          product_id: patch.product_id ?? item.product_id,
          source_product_name_snapshot: patch.source_product_name_snapshot ?? item.source_product_name_snapshot,
          quota_quantity: patch.quota_quantity ?? item.quota_quantity,
          excess_unit_price: patch.excess_unit_price ?? item.excess_unit_price,
          is_active: patch.is_active ?? item.is_active,
          is_product_linked: patch.is_product_linked ?? item.is_product_linked,
          is_excluded_from_attendance: patch.is_excluded_from_attendance ?? item.is_excluded_from_attendance,
          is_legacy: patch.is_legacy ?? item.is_legacy,
        },
      });
      setMessage(successMessage);
    } catch (mutationError) {
      setError(isApiError(mutationError) ? mutationError.message : "Không thể cập nhật trạng thái mặt hàng tổ cắt.");
    }
  }

  return (
    <section className="inventory-detail-card">
      <div className="inventory-section-heading">
        <h3>Tổ cắt</h3>
        <span>Liên kết sản phẩm hiện có</span>
      </div>
      <p className="inventory-subtext">
        Thay đổi quota, đơn giá vượt và liên kết hàng hóa chỉ áp dụng cho bản ghi mới. Bản ghi lịch sử vẫn giữ snapshot cũ.
      </p>
      {error ? <p className="state-message error-message">{error}</p> : null}
      {message ? <p className="state-message">{message}</p> : null}

      <label className="attendance-field">
        Tìm sản phẩm để liên kết
        <input value={search} disabled={!canMutate} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã sản phẩm" />
      </label>
      {deferredSearch ? (
        <div className="attendance-search-results">
          {(productSearchQuery.data ?? []).map((product) => (
            <button
              key={product.product_id}
              className="inventory-ghost-button"
              type="button"
              disabled={!canMutate}
              onClick={() => setLinkDraft({
                product_id: product.product_id,
                product_name: product.product_name,
                product_code_base: product.product_code_base,
                quota_quantity: normalizeQuantityText(product.quota_quantity ?? ""),
                excess_unit_price: normalizeQuantityText(product.excess_unit_price ?? ""),
              })}
            >
              {product.product_name} ({product.product_code_base}) {product.is_configured_for_attendance ? "· Đã có liên kết" : "· Cần cấu hình"}
            </button>
          ))}
          {!productSearchQuery.isLoading && (productSearchQuery.data?.length ?? 0) === 0 ? (
            <p className="inventory-subtext">Không tìm thấy sản phẩm phù hợp.</p>
          ) : null}
        </div>
      ) : null}

      {linkDraft ? (
        <div className="settings-form-grid">
          <label className="attendance-field">
            Sản phẩm đã chọn
            <input value={`${linkDraft.product_name} (${linkDraft.product_code_base})`} disabled />
          </label>
          <label className="attendance-field">
            Quota
            <input type="number" min="0" step="0.5" value={linkDraft.quota_quantity} onChange={(event) => setLinkDraft((current) => current ? { ...current, quota_quantity: event.target.value } : current)} />
          </label>
          <label className="attendance-field">
            Đơn giá vượt
            <input type="number" min="0" step="100" value={linkDraft.excess_unit_price} onChange={(event) => setLinkDraft((current) => current ? { ...current, excess_unit_price: event.target.value } : current)} />
          </label>
          <div className="attendance-row-actions">
            <button className="inventory-solid-button" type="button" onClick={() => void handleSaveLinkedProduct()} disabled={upsertMutation.isPending || !canMutate}>
              Lưu liên kết
            </button>
            <button className="inventory-ghost-button" type="button" onClick={() => setLinkDraft(null)}>
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      <div className="inventory-table-wrap attendance-table-wrap">
        <table className="data-table inventory-data-table attendance-data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Hàng hóa</th>
              <th>Quota</th>
              <th>Đơn giá vượt</th>
              <th>Trạng thái</th>
              <th>Loại trừ</th>
              <th>Legacy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bagTypes.map((item) => (
              <tr key={item.id} className={item.is_active ? "inventory-row" : "inventory-row attendance-row--inactive"}>
                <td>{item.name}</td>
                <td>{item.product_name ? `${item.product_name} (${item.product_code_base ?? "-"})` : "Chưa liên kết"}</td>
                <td>{item.quota_quantity}</td>
                <td>{formatMoney(item.excess_unit_price)}</td>
                <td>{item.is_active ? "Đang dùng" : "Ngừng dùng"}</td>
                <td>{item.is_excluded_from_attendance ? "Có" : "Không"}</td>
                <td>{item.is_legacy ? "Có" : "Không"}</td>
                <td>
                  <div className="attendance-row-actions">
                    <button className="inventory-ghost-button" type="button" onClick={() => startEdit(item)}>
                      Sửa
                    </button>
                    {canMutate ? (
                      <>
                        <button className="inventory-ghost-button" type="button" onClick={() => void handleQuickToggle(item, { is_active: !item.is_active }, item.is_active ? "Đã ngừng dùng mặt hàng tổ cắt." : "Đã kích hoạt lại mặt hàng tổ cắt.")}>
                          {item.is_active ? "Ngừng dùng" : "Kích hoạt"}
                        </button>
                        <button className="inventory-ghost-button" type="button" onClick={() => void handleQuickToggle(item, { is_excluded_from_attendance: !item.is_excluded_from_attendance }, item.is_excluded_from_attendance ? "Đã cho phép chọn lại mặt hàng tổ cắt." : "Đã loại khỏi chấm công mới.")}>
                          {item.is_excluded_from_attendance ? "Bỏ loại trừ" : "Loại trừ"}
                        </button>
                        <button className="inventory-ghost-button" type="button" onClick={() => void handleQuickToggle(item, { is_legacy: !item.is_legacy }, item.is_legacy ? "Đã bỏ cờ legacy." : "Đã đánh dấu legacy.")}>
                          {item.is_legacy ? "Bỏ legacy" : "Đánh dấu legacy"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formState.id !== null ? (
        <div className="settings-form-grid">
          <label className="attendance-field">
            Tên mặt hàng tổ cắt
            <input value={formState.name} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="attendance-field">
            Quota
            <input type="number" min="0" step="0.5" value={formState.quota_quantity} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, quota_quantity: event.target.value }))} />
          </label>
          <label className="attendance-field">
            Đơn giá vượt
            <input type="number" min="0" step="100" value={formState.excess_unit_price} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, excess_unit_price: event.target.value }))} />
          </label>
          <label className="attendance-checkbox">
            <input type="checkbox" checked={formState.is_active} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />
            <span>Đang sử dụng</span>
          </label>
          <label className="attendance-checkbox">
            <input type="checkbox" checked={formState.is_excluded_from_attendance} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, is_excluded_from_attendance: event.target.checked }))} />
            <span>Loại khỏi chấm công mới</span>
          </label>
          <label className="attendance-checkbox">
            <input type="checkbox" checked={formState.is_legacy} disabled={!canMutate} onChange={(event) => setFormState((current) => ({ ...current, is_legacy: event.target.checked }))} />
            <span>Đánh dấu legacy</span>
          </label>
          {canMutate ? (
            <div className="attendance-row-actions">
              <button className="inventory-solid-button" type="button" onClick={() => void handleUpdateCutItem()} disabled={updateMutation.isPending}>
                Lưu thay đổi
              </button>
              <button className="inventory-ghost-button" type="button" onClick={resetForm}>
                Hủy sửa
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DiagnosticsPanel({ issues }: { issues: AttendanceInventoryDiagnosticIssue[] }) {
  return (
    <section className="inventory-detail-card">
      <div className="inventory-section-heading">
        <h3>Diagnostics</h3>
        <span>Chỉ đọc</span>
      </div>
      <div className="settings-overview-grid">
        <article className="settings-overview-card">
          <span>Thiếu effect</span>
          <strong>{issues.filter((issue) => issue.issue_type === "finalized_record_missing_inventory_effect").length}</strong>
          <p>Bản ghi đã chốt nhưng chưa có inventory effect tương ứng.</p>
        </article>
        <article className="settings-overview-card">
          <span>Sai hàng hóa</span>
          <strong>{issues.filter((issue) => issue.issue_type === "effect_product_mismatch").length}</strong>
          <p>Inventory effect đang trỏ sai sản phẩm so với cấu hình.</p>
        </article>
        <article className="settings-overview-card">
          <span>Sai số lượng</span>
          <strong>{issues.filter((issue) => issue.issue_type === "effect_quantity_mismatch").length}</strong>
          <p>Số lượng effect khác với dữ liệu chấm công đã chốt.</p>
        </article>
        <article className="settings-overview-card">
          <span>Effect sai trạng thái</span>
          <strong>{issues.filter((issue) => issue.issue_type === "effect_exists_for_non_final_record").length}</strong>
          <p>Effect vẫn tồn tại cho bản ghi nháp hoặc nghỉ.</p>
        </article>
      </div>

      <div className="inventory-table-wrap attendance-table-wrap">
        <table className="data-table inventory-data-table attendance-data-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nhân viên</th>
              <th>Loại lỗi</th>
              <th>Mô tả</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={`${issue.issue_type}:${issue.daily_record_id}`}>
                <td>{issue.work_date}</td>
                <td>{issue.employee_id}</td>
                <td>{issueLabel(issue.issue_type)}</td>
                <td>{issue.message}</td>
              </tr>
            ))}
            {issues.length === 0 ? (
              <tr>
                <td colSpan={4}>Chưa phát hiện lệch dữ liệu chấm công và tồn kho.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AttendanceSettingsSection({ canMutate }: { canMutate: boolean }) {
  const workTypesQuery = useAttendanceWorkTypes(true);
  const bagTypesQuery = useAttendanceCutWorkItems(true);
  const diagnosticsQuery = useAttendanceInventoryDiagnostics();

  if (workTypesQuery.isLoading || bagTypesQuery.isLoading || diagnosticsQuery.isLoading) {
    return <p className="state-message">Đang tải cấu hình chấm công...</p>;
  }

  if (workTypesQuery.isError || bagTypesQuery.isError || diagnosticsQuery.isError) {
    const error = workTypesQuery.error ?? bagTypesQuery.error ?? diagnosticsQuery.error;
    return (
      <p className="state-message error-message">
        {isApiError(error) ? error.message : "Không thể tải cấu hình chấm công."}
      </p>
    );
  }

  return (
    <div className="settings-section-stack">
      <BlowWorkTypesPanel canMutate={canMutate} workTypes={workTypesQuery.data ?? []} />
      <CutItemsPanel canMutate={canMutate} bagTypes={bagTypesQuery.data ?? []} />
      <DiagnosticsPanel issues={diagnosticsQuery.data ?? []} />
    </div>
  );
}

function BackupImportPlaceholderSection() {
  return (
    <section className="inventory-detail-card">
      <div className="inventory-section-heading">
        <h3>Sao lưu / nhập dữ liệu</h3>
        <span>Đang defer</span>
      </div>
      <p className="inventory-subtext">
        Khu vực này sẽ tổng hợp hướng dẫn sao lưu, rehearsal import và kiểm tra an toàn dữ liệu. Batch này chưa cung cấp nút thực thi sao lưu, restore hay import.
      </p>
    </section>
  );
}

function UserRolesPlaceholderSection() {
  return (
    <section className="inventory-detail-card">
      <div className="inventory-section-heading">
        <h3>Người dùng & phân quyền</h3>
        <span>Đang defer</span>
      </div>
      <p className="inventory-subtext">
        Khu vực này sẽ quản lý người dùng, vai trò và phân quyền thao tác. Batch này chưa cho phép tạo, sửa hoặc vô hiệu hóa tài khoản.
      </p>
    </section>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const canMutateAttendance = canMutateAttendanceSettings(user?.role);

  const availableSections = useMemo(() => {
    if (user?.role === "attendance_manager") {
      return attendanceManagerSections;
    }
    if (user?.role === "read_only") {
      return readOnlySections;
    }
    return ownerAdminSections;
  }, [user?.role]);

  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(availableSections[0]?.key ?? "overview");
  const currentSection = availableSections.find((section) => section.key === activeSection) ?? availableSections[0];

  return (
    <InventoryModuleShell
      title="Cài đặt"
      description="Vùng cấu hình hệ thống được chia theo từng nhóm nghiệp vụ, ưu tiên an toàn và giữ nguyên lịch sử dữ liệu đã phát sinh."
      activeNavPath="/settings"
      contentClassName="settings-page-layout"
      compactHero
    >
      <div className="inventory-mode-tabs settings-page-tabs" role="tablist" aria-label="Điều hướng cài đặt">
        {availableSections.map((section) => (
          <button
            key={section.key}
            className={activeSection === section.key ? "inventory-mode-tab active" : "inventory-mode-tab"}
            type="button"
            role="tab"
            aria-selected={activeSection === section.key}
            onClick={() => setActiveSection(section.key)}
          >
            {section.title}
          </button>
        ))}
      </div>

      {currentSection ? (
        <div className="settings-section-shell">
          <section className="inventory-detail-card">
            <div className="inventory-section-heading">
              <h3>{currentSection.title}</h3>
              <span>{currentSection.key === "attendance" && canMutateAttendance ? "Có thể chỉnh sửa" : "Read-only"}</span>
            </div>
            <p className="inventory-subtext">{currentSection.description}</p>
          </section>

          {currentSection.key === "overview" ? <SystemOverviewSection /> : null}
          {currentSection.key === "attendance" ? <AttendanceSettingsSection canMutate={canMutateAttendance} /> : null}
          {currentSection.key === "backup_import" ? <BackupImportPlaceholderSection /> : null}
          {currentSection.key === "user_roles" ? <UserRolesPlaceholderSection /> : null}
        </div>
      ) : null}
    </InventoryModuleShell>
  );
}
