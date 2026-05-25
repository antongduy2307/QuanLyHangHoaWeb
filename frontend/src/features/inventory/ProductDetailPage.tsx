import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { InventoryMovement, Product, ProductPrice, UnitMode, UnitType } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { formatDateTime } from "../../domain/dates";
import { InventoryModuleShell } from "./InventoryModuleShell";
import {
  initialProductFormState,
  productToFormState,
  toProductCreatePayload,
  toProductUpdatePayload,
  validateProductForm,
  type ProductFormState,
} from "./productSchemas";
import {
  useCreateProduct,
  useDecreaseStock,
  useDeleteProduct,
  useIncreaseStock,
  useProduct,
  useProductMovements,
  useSetStock,
  useUpdateProduct,
} from "./productQueries";

const writeRoles = ["owner", "admin"] as const;
const positiveQuantityPattern = /^(?:[1-9]\d*|0)(?:\.\d{1,3})?$/;
const quantityPattern = /^-?(?:[1-9]\d*|0)(?:\.\d{1,3})?$/;
const productFormId = "inventory-product-form";
const priceSlots: Array<{ unitType: UnitType; label: string }> = [
  { unitType: "BAO", label: "BAO" },
  { unitType: "KG", label: "KG" },
  { unitType: "BICH", label: "BỊCH" },
];

type ProductScreenMode = "create" | "detail";
type AdjustmentMode = "increase" | "decrease" | "set";

function canWriteInventory(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

function unitChoices(unitMode: UnitMode): UnitType[] {
  return unitMode === "BICH" ? ["BICH"] : ["BAO", "KG"];
}

function sellingUnitText(unitMode: UnitMode, prices: ProductPrice[]) {
  if (unitMode === "BICH") {
    return "Bịch";
  }
  const baoEnabled = prices.some((price) => price.unit_type === "BAO" && price.is_enabled);
  const kgEnabled = prices.some((price) => price.unit_type === "KG" && price.is_enabled);
  if (baoEnabled && kgEnabled) {
    return "Bao / Kg";
  }
  if (baoEnabled) {
    return "Bao";
  }
  if (kgEnabled) {
    return "Kg";
  }
  return "Bao / Kg";
}

function stockSummaryRows(product: Product) {
  if (product.unit_mode === "BICH") {
    return [{ label: "Tồn BỊCH", value: product.balance?.on_hand_bich_integer ?? "0" }];
  }

  return [
    { label: "Tồn BAO", value: product.balance?.on_hand_bao_decimal ?? "0" },
    { label: "Tồn KG quy đổi", value: product.balance?.derived_kg_balance ?? "0" },
  ];
}

function isPositiveQuantity(value: string) {
  const normalizedValue = value.trim();
  if (!positiveQuantityPattern.test(normalizedValue)) {
    return false;
  }
  return !/^0(?:\.0{1,3})?$/.test(normalizedValue);
}

function isQuantity(value: string) {
  return quantityPattern.test(value.trim());
}

function movementTypeLabel(type: string | undefined) {
  const labels: Record<string, string> = {
    SALE: "Bán hàng",
    RETURN: "Trả hàng",
    STOCK_INCREASE: "Nhập kho",
    STOCK_DECREASE: "Xuất kho",
    STOCK_SET: "Đặt tồn thực tế",
    IMPORT: "Nhập dữ liệu",
    MANUAL: "Điều chỉnh thủ công",
  };
  if (!type) {
    return "Khác";
  }
  return labels[type] ?? type.replaceAll("_", " ");
}

function sourceReference(movement: InventoryMovement) {
  if (movement.source_type === "invoice") {
    return <Link to={`/sales/invoices/${movement.source_id}`}>Hóa đơn #{movement.source_id}</Link>;
  }
  if (movement.source_type === "return") {
    return <Link to={`/returns/${movement.source_id}`}>Phiếu trả #{movement.source_id}</Link>;
  }
  if (movement.source_type === "stock_adjustment") {
    return `Điều chỉnh #${movement.source_id}`;
  }
  return `${movement.source_type ?? "Nguồn"} #${movement.source_id}`;
}

function toDateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function movementMatchesFilters(movement: InventoryMovement, typeFilter: string, dateFrom: string, dateTo: string) {
  const movementDate = toDateInputValue(movement.movement_datetime);
  if (typeFilter && movement.movement_type !== typeFilter) {
    return false;
  }
  if (dateFrom && movementDate && movementDate < dateFrom) {
    return false;
  }
  if (dateTo && movementDate && movementDate > dateTo) {
    return false;
  }
  return true;
}

function adjustmentSubmitLabel(mode: AdjustmentMode) {
  if (mode === "increase") {
    return "Xác nhận nhập kho";
  }
  if (mode === "decrease") {
    return "Xác nhận xuất kho";
  }
  return "Cập nhật tồn thực tế";
}

function createComparableState(state: ProductFormState) {
  return JSON.stringify(toProductCreatePayload(state));
}

function updateComparableState(state: ProductFormState) {
  return JSON.stringify(toProductUpdatePayload(state));
}

function ProductUnifiedScreen({ mode }: { mode: ProductScreenMode }) {
  const createMode = mode === "create";
  const { productId } = useParams();
  const parsedProductId = Number(productId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draftFormState, setDraftFormState] = useState<ProductFormState | null>(createMode ? initialProductFormState : null);
  const [savedComparableState, setSavedComparableState] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockMessage, setStockMessage] = useState<string | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>("increase");
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [stockUnit, setStockUnit] = useState<UnitType>("BAO");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");
  const productQuery = useProduct(createMode ? 0 : parsedProductId);
  const movementsQuery = useProductMovements(createMode ? 0 : parsedProductId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(parsedProductId);
  const deleteProduct = useDeleteProduct(parsedProductId);
  const increaseStock = useIncreaseStock(parsedProductId);
  const decreaseStock = useDecreaseStock(parsedProductId);
  const setStock = useSetStock(parsedProductId);
  const canEditFields = user ? canWriteInventory(user.role) : false;
  const product = productQuery.data;
  const baseFormState = createMode ? initialProductFormState : product ? productToFormState(product) : null;
  const formState = draftFormState ?? baseFormState ?? initialProductFormState;
  const effectiveUnitMode = createMode ? formState.unit_mode : product?.unit_mode ?? formState.unit_mode;
  const baselineComparableState = createMode
    ? createComparableState(initialProductFormState)
    : savedComparableState ?? (baseFormState ? updateComparableState(baseFormState) : "");
  const availableUnits = useMemo(() => unitChoices(effectiveUnitMode), [effectiveUnitMode]);
  const selectedStockUnit = availableUnits.includes(stockUnit) ? stockUnit : availableUnits[0] ?? stockUnit;
  const isSubmittingAdjustment = increaseStock.isPending || decreaseStock.isPending || setStock.isPending;
  const filteredMovements = useMemo(
    () =>
      (movementsQuery.data ?? []).filter((movement) =>
        movementMatchesFilters(movement, movementTypeFilter, movementDateFrom, movementDateTo),
      ),
    [movementDateFrom, movementDateTo, movementTypeFilter, movementsQuery.data],
  );
  const isDirty = createMode
    ? createComparableState(formState) !== baselineComparableState
    : updateComparableState(formState) !== baselineComparableState;
  const canSubmit = createMode ? true : canEditFields && productQuery.isSuccess;

  if (!createMode && (!Number.isInteger(parsedProductId) || parsedProductId <= 0)) {
    return <p className="state-message error-message">Mã hàng hóa không hợp lệ.</p>;
  }

  function clearFormMessages() {
    setFormMessage(null);
    setFormError(null);
  }

  function clearStockMessages() {
    setStockMessage(null);
    setStockError(null);
  }

  function updateField(field: keyof Pick<ProductFormState, "product_code_base" | "product_name">, value: string) {
    clearFormMessages();
    setDraftFormState((current) => ({ ...(current ?? formState), [field]: value }));
  }

  function updateUnitMode(unitMode: UnitMode) {
    clearFormMessages();
    setDraftFormState((current) => {
      const next = current ?? formState;
      return {
        ...next,
        unit_mode: unitMode,
        prices:
          unitMode === "BICH"
            ? {
                BAO: { ...next.prices.BAO, is_enabled: false, price: "" },
                KG: { ...next.prices.KG, is_enabled: false, price: "" },
                BICH: { ...next.prices.BICH, is_enabled: true },
              }
            : {
                BAO: { ...next.prices.BAO, is_enabled: true },
                KG: { ...next.prices.KG },
                BICH: { ...next.prices.BICH, is_enabled: false, price: "" },
              },
      };
    });
  }

  function updatePrice(unitType: UnitType, value: string) {
    clearFormMessages();
    setDraftFormState((current) => {
      const next = current ?? formState;
      return {
        ...next,
        prices: {
          ...next.prices,
          [unitType]: { ...next.prices[unitType], price: value },
        },
      };
    });
  }

  function updatePriceEnabled(unitType: UnitType, isEnabled: boolean) {
    clearFormMessages();
    setDraftFormState((current) => {
      const next = current ?? formState;
      return {
        ...next,
        prices: {
          ...next.prices,
          [unitType]: { ...next.prices[unitType], is_enabled: isEnabled },
        },
      };
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFormMessages();
    const errors = validateProductForm(formState);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      if (createMode) {
        const created = await createProduct.mutateAsync(toProductCreatePayload(formState));
        navigate(created?.id ? `/inventory/products/${created.id}` : "/inventory/products");
        return;
      }

      const updated = await updateProduct.mutateAsync(toProductUpdatePayload(formState));
      const nextState = productToFormState(updated);
      setDraftFormState(nextState);
      setSavedComparableState(updateComparableState(nextState));
      setFormMessage("Đã lưu thay đổi hàng hóa.");
    } catch (error) {
      setFormError(isApiError(error) ? error.message : createMode ? "Không thể tạo hàng hóa." : "Không thể cập nhật hàng hóa.");
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Xóa hàng hóa này? Nếu hàng hóa đã có lịch sử giao dịch hoặc điều chỉnh kho, hệ thống sẽ ngưng dùng thay vì xóa vĩnh viễn.",
      )
    ) {
      return;
    }
    clearFormMessages();
    try {
      const result = await deleteProduct.mutateAsync();
      navigate("/inventory/products", {
        state: {
          productDeleteMessage:
            result.action === "hard_deleted"
              ? "Hàng hóa đã được xóa vĩnh viễn."
              : "Hàng hóa đã được ngưng dùng do đã có lịch sử phát sinh.",
        },
      });
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "Không thể xóa hàng hóa.");
    }
  }

  async function handleAdjustmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearStockMessages();

    if (adjustmentMode === "set" ? !isQuantity(stockQuantity) : !isPositiveQuantity(stockQuantity)) {
      setStockError(adjustmentMode === "set" ? "Tồn thực tế phải là số hợp lệ." : "Số lượng phải lớn hơn 0.");
      return;
    }
    if (!stockNote.trim()) {
      setStockError("Cần nhập ghi chú điều chỉnh.");
      return;
    }

    try {
      if (adjustmentMode === "set") {
        await setStock.mutateAsync({
          unit_type: selectedStockUnit,
          target_quantity: stockQuantity.trim(),
          note: stockNote.trim(),
        });
      } else if (adjustmentMode === "increase") {
        await increaseStock.mutateAsync({
          unit_type: selectedStockUnit,
          quantity: stockQuantity.trim(),
          note: stockNote.trim(),
        });
      } else {
        await decreaseStock.mutateAsync({
          unit_type: selectedStockUnit,
          quantity: stockQuantity.trim(),
          note: stockNote.trim(),
        });
      }

      setStockQuantity("");
      setStockNote("");
      setStockMessage(
        adjustmentMode === "increase"
          ? "Đã nhập kho thành công."
          : adjustmentMode === "decrease"
            ? "Đã xuất kho thành công."
            : "Đã cập nhật tồn thực tế.",
      );
    } catch (error) {
      setStockError(isApiError(error) ? error.message : "Không thể cập nhật tồn kho.");
    }
  }

  return (
    <InventoryModuleShell
      title={createMode ? "Tạo hàng hóa" : "Chi tiết hàng hóa"}
      description={
        createMode
          ? "Tạo hàng hóa mới trên cùng bố cục chi tiết để thống nhất trải nghiệm quản lý."
          : "Theo dõi nhanh thông tin mặt hàng, trạng thái giá bán, tồn kho và lịch sử phát sinh theo cùng bố cục vận hành với danh sách hàng hóa."
      }
      heroActions={
        <div className="inventory-product-hero-actions">
          <Link className="inventory-ghost-button" to="/inventory/products">
            Quay lại danh sách
          </Link>
          {!createMode && canEditFields ? (
            <button className="inventory-ghost-button inventory-ghost-button--danger" type="button" onClick={() => void handleDelete()}>
              Xóa / Ngưng dùng
            </button>
          ) : null}
          {(createMode || canEditFields) && canSubmit ? (
            <button
              className="inventory-solid-button"
              form={productFormId}
              type="submit"
              disabled={(createMode ? createProduct.isPending : updateProduct.isPending) || (!createMode && !isDirty)}
            >
              {createMode ? "Tạo hàng hóa" : "Lưu thay đổi"}
            </button>
          ) : null}
        </div>
      }
      contentClassName="inventory-detail-layout inventory-detail-layout--unified"
    >
      {!createMode && productQuery.isLoading ? <p className="state-message">Đang tải chi tiết hàng hóa...</p> : null}
      {!createMode && productQuery.isError ? (
        <p className="state-message error-message">
          {isApiError(productQuery.error) ? productQuery.error.message : "Không thể tải chi tiết hàng hóa."}
        </p>
      ) : null}
      {formMessage ? <p className="state-message">{formMessage}</p> : null}
      {formError ? <p className="state-message error-message">{formError}</p> : null}

      {(createMode || product) && (!createMode || canSubmit) ? (
        <form id={productFormId} className="inventory-product-form" onSubmit={handleSave}>
          <section className="inventory-detail-card" aria-label={createMode ? "Tạo hàng hóa" : "Thông tin hàng hóa"}>
            <div className="inventory-section-heading">
              <h3>{createMode ? "Tạo hàng hóa" : "Thông tin hàng hóa"}</h3>
              {!createMode && product ? <span>{product.is_active ? "Đang kinh doanh" : "Ngưng dùng"}</span> : null}
            </div>
            <div className="inventory-detail-form-grid">
              <label>
                Mã hàng
                <input
                  value={formState.product_code_base}
                  disabled={!createMode}
                  readOnly={!createMode}
                  onChange={(event) => updateField("product_code_base", event.target.value)}
                />
                {fieldErrors.product_code_base ? <span className="field-error">{fieldErrors.product_code_base}</span> : null}
              </label>
              <label>
                Tên hàng
                <input
                  value={formState.product_name}
                  disabled={!createMode && !canEditFields}
                  onChange={(event) => updateField("product_name", event.target.value)}
                />
                {fieldErrors.product_name ? <span className="field-error">{fieldErrors.product_name}</span> : null}
              </label>
              {createMode ? (
                <fieldset className="inventory-unit-mode-fieldset">
                  <legend>Đơn vị bán</legend>
                  <label className="inline-choice">
                    <input
                      type="radio"
                      name="unit_mode"
                      value="BAO_KG"
                      checked={formState.unit_mode === "BAO_KG"}
                      onChange={() => updateUnitMode("BAO_KG")}
                    />
                    Bao / Kg
                  </label>
                  <label className="inline-choice">
                    <input type="radio" name="unit_mode" value="BICH" checked={formState.unit_mode === "BICH"} onChange={() => updateUnitMode("BICH")} />
                    Bịch
                  </label>
                </fieldset>
              ) : (
                <label>
                  Đơn vị bán
                  <input value={product ? sellingUnitText(product.unit_mode, product.prices) : ""} disabled readOnly />
                </label>
              )}
              {!createMode && product ? (
                <label>
                  Trạng thái
                  <input value={product.is_active ? "Đang dùng" : "Ngưng dùng"} disabled readOnly />
                </label>
              ) : null}
            </div>
          </section>

          <section className="inventory-detail-card" aria-label="Giá bán">
            <div className="inventory-section-heading">
              <h3>Giá bán</h3>
              <span>{createMode ? "Thiết lập giá khởi tạo" : "Cập nhật trạng thái và giá theo đơn vị"}</span>
            </div>
            <div className="inventory-price-editor-grid">
              {priceSlots.map(({ unitType, label }) => {
                const isApplicable = formState.unit_mode === "BICH" ? unitType === "BICH" : unitType !== "BICH";
                const enableToggleVisible = formState.unit_mode === "BAO_KG" ? unitType !== "BICH" : unitType === "BICH";
                return (
                  <div key={unitType} className="inventory-price-editor-card">
                    <div className="inventory-price-editor-card__header">
                      <strong>{label}</strong>
                      {enableToggleVisible ? (
                        <label className="inline-choice">
                          <input
                            type="checkbox"
                            checked={formState.prices[unitType].is_enabled}
                            disabled={!createMode && !canEditFields}
                            onChange={(event) => updatePriceEnabled(unitType, event.target.checked)}
                          />
                          Bật giá
                        </label>
                      ) : (
                        <span>{isApplicable ? "Bắt buộc" : "Không áp dụng"}</span>
                      )}
                    </div>
                    <label>
                      Giá {label}
                      <input
                        inputMode="decimal"
                        value={formState.prices[unitType].price}
                        disabled={!isApplicable || (!createMode && !canEditFields) || (enableToggleVisible && !formState.prices[unitType].is_enabled)}
                        onChange={(event) => updatePrice(unitType, event.target.value)}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
            {fieldErrors.prices ? <p className="field-error">{fieldErrors.prices}</p> : null}
          </section>

          {!createMode && product ? (
            <>
              <section className="inventory-detail-card" aria-label="Tồn kho">
                <div className="inventory-section-heading">
                  <h3>Tồn kho</h3>
                  <div className="inventory-stock-section-actions">
                    <span>Cập nhật {formatDateTime(product.updated_at)}</span>
                    {canEditFields ? (
                      <button className="inventory-ghost-button" type="button" onClick={() => setShowStockAdjustment((current) => !current)}>
                        Điều chỉnh tồn kho
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="inventory-stock-grid">
                  {stockSummaryRows(product).map((row) => (
                    <div key={row.label} className="inventory-stock-card">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>

                {canEditFields && showStockAdjustment ? (
                  <section id="stock-adjustment-panel" className="inventory-inline-adjustment-panel" aria-label="Điều chỉnh tồn kho">
                    <div className="inventory-mode-tabs" role="tablist" aria-label="Loại điều chỉnh">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={adjustmentMode === "increase"}
                        className={adjustmentMode === "increase" ? "inventory-mode-tab active" : "inventory-mode-tab"}
                        onClick={() => {
                          setAdjustmentMode("increase");
                          clearStockMessages();
                        }}
                      >
                        Nhập kho
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={adjustmentMode === "decrease"}
                        className={adjustmentMode === "decrease" ? "inventory-mode-tab active" : "inventory-mode-tab"}
                        onClick={() => {
                          setAdjustmentMode("decrease");
                          clearStockMessages();
                        }}
                      >
                        Xuất kho / Giảm tồn
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={adjustmentMode === "set"}
                        className={adjustmentMode === "set" ? "inventory-mode-tab active" : "inventory-mode-tab"}
                        onClick={() => {
                          setAdjustmentMode("set");
                          clearStockMessages();
                        }}
                      >
                        Đặt tồn thực tế
                      </button>
                    </div>

                    <form className="inventory-adjustment-form" onSubmit={handleAdjustmentSubmit}>
                      <label>
                        Đơn vị
                        <select value={selectedStockUnit} onChange={(event) => setStockUnit(event.target.value as UnitType)}>
                          {availableUnits.map((unitType) => (
                            <option key={unitType} value={unitType}>
                              {unitType}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {adjustmentMode === "set" ? "Tồn thực tế" : "Số lượng"}
                        <input inputMode="decimal" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} />
                      </label>
                      <label>
                        Ghi chú
                        <input value={stockNote} onChange={(event) => setStockNote(event.target.value)} />
                      </label>
                      <button className="inventory-solid-button" type="submit" disabled={isSubmittingAdjustment}>
                        {adjustmentSubmitLabel(adjustmentMode)}
                      </button>
                    </form>
                    {stockMessage ? <p className="state-message">{stockMessage}</p> : null}
                    {stockError ? <p className="state-message error-message">{stockError}</p> : null}
                  </section>
                ) : null}
              </section>

              <section className="inventory-detail-card" aria-label="Lịch sử tồn kho">
                <div className="inventory-section-heading">
                  <h3>Lịch sử tồn kho</h3>
                  <span>Nhật ký phát sinh và điều chỉnh</span>
                </div>
                <section className="inventory-movement-filters" aria-label="Bộ lọc lịch sử tồn kho">
                  <label>
                    Loại phát sinh
                    <select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value)}>
                      <option value="">Tất cả</option>
                      <option value="SALE">Bán hàng</option>
                      <option value="RETURN">Trả hàng</option>
                      <option value="STOCK_INCREASE">Nhập kho</option>
                      <option value="STOCK_DECREASE">Xuất kho</option>
                      <option value="STOCK_SET">Đặt tồn thực tế</option>
                    </select>
                  </label>
                  <label>
                    Từ ngày
                    <input type="date" value={movementDateFrom} onChange={(event) => setMovementDateFrom(event.target.value)} />
                  </label>
                  <label>
                    Đến ngày
                    <input type="date" value={movementDateTo} onChange={(event) => setMovementDateTo(event.target.value)} />
                  </label>
                </section>
                {movementsQuery.isLoading ? <p className="state-message">Đang tải lịch sử tồn kho...</p> : null}
                {movementsQuery.isError ? <p className="state-message error-message">Không thể tải lịch sử tồn kho.</p> : null}
                {movementsQuery.isSuccess && movementsQuery.data.length === 0 ? <p className="state-message">Chưa có phát sinh tồn kho.</p> : null}
                {movementsQuery.isSuccess && movementsQuery.data.length > 0 && filteredMovements.length === 0 ? (
                  <p className="state-message">Không có phát sinh phù hợp bộ lọc.</p>
                ) : null}
                {movementsQuery.isSuccess && filteredMovements.length > 0 ? (
                  <div className="table-wrap inventory-table-wrap inventory-movement-table-wrap">
                    <table className="data-table inventory-data-table">
                      <thead>
                        <tr>
                          <th>Loại</th>
                          <th>Thời gian</th>
                          <th>Biến động</th>
                          <th>Đơn vị</th>
                          <th>Nguồn</th>
                          <th>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovements.map((movement) => (
                          <tr key={`${movement.source_type}-${movement.movement_id}`}>
                            <td>{movementTypeLabel(movement.movement_type)}</td>
                            <td>{formatDateTime(movement.movement_datetime)}</td>
                            <td>{movement.quantity_delta}</td>
                            <td>{movement.unit_type}</td>
                            <td>{sourceReference(movement)}</td>
                            <td>{movement.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </form>
      ) : null}
    </InventoryModuleShell>
  );
}

export function ProductDetailPage() {
  return <ProductUnifiedScreen mode="detail" />;
}

export function ProductCreateScreen() {
  return <ProductUnifiedScreen mode="create" />;
}
