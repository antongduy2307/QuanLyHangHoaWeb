import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { InventoryMovement, Product, UnitType } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../domain/dates";
import { useDecreaseStock, useDeleteProduct, useIncreaseStock, useProduct, useProductMovements, useSetStock } from "./productQueries";

const writeRoles = ["owner", "admin"] as const;
const positiveQuantityPattern = /^(?:[1-9]\d*|0)(?:\.\d{1,3})?$/;
const quantityPattern = /^-?(?:[1-9]\d*|0)(?:\.\d{1,3})?$/;

function canWriteInventory(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

function unitChoices(product: Product): UnitType[] {
  return product.unit_mode === "BICH" ? ["BICH"] : ["BAO", "KG"];
}

function balanceText(product: Product) {
  if (!product.balance) {
    return "Chua co ton kho";
  }
  if (product.unit_mode === "BICH") {
    return `BICH: ${product.balance.on_hand_bich_integer ?? "0"}`;
  }
  return `BAO: ${product.balance.on_hand_bao_decimal ?? "0"} | KG: ${product.balance.derived_kg_balance ?? "0"}`;
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

function movementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    SALE: "Ban hang",
    RETURN: "Tra hang",
    STOCK_INCREASE: "Tang ton",
    STOCK_DECREASE: "Giam ton",
    STOCK_SET: "Dat ton thuc te",
    IMPORT: "Nhap du lieu",
    MANUAL: "Thu cong",
  };
  return labels[type] ?? type;
}

function sourceLink(movement: InventoryMovement) {
  if (movement.source_type === "invoice") {
    return <Link to={`/sales/invoices/${movement.source_id}`}>Hoa don #{movement.source_id}</Link>;
  }
  if (movement.source_type === "return") {
    return <Link to={`/returns/${movement.source_id}`}>Phieu tra #{movement.source_id}</Link>;
  }
  if (movement.source_type === "stock_adjustment") {
    return `Dieu chinh #${movement.source_id}`;
  }
  return `${movement.source_type} #${movement.source_id}`;
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

export function ProductDetailPage() {
  const { productId } = useParams();
  const parsedProductId = Number(productId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockMessage, setStockMessage] = useState<string | null>(null);
  const [stockUnit, setStockUnit] = useState<UnitType>("BAO");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");
  const productQuery = useProduct(parsedProductId);
  const movementsQuery = useProductMovements(parsedProductId);
  const deleteProduct = useDeleteProduct(parsedProductId);
  const increaseStock = useIncreaseStock(parsedProductId);
  const decreaseStock = useDecreaseStock(parsedProductId);
  const setStock = useSetStock(parsedProductId);
  const canMutate = user ? canWriteInventory(user.role) : false;
  const errorMessage = isApiError(productQuery.error) ? productQuery.error.message : "Khong the tai chi tiet hang hoa.";
  const product = productQuery.data;
  const availableUnits = useMemo(() => (product ? unitChoices(product) : []), [product]);
  const selectedStockUnit = availableUnits.includes(stockUnit) ? stockUnit : availableUnits[0] ?? stockUnit;
  const filteredMovements = useMemo(
    () =>
      (movementsQuery.data ?? []).filter((movement) =>
        movementMatchesFilters(movement, movementTypeFilter, movementDateFrom, movementDateTo),
      ),
    [movementDateFrom, movementDateTo, movementTypeFilter, movementsQuery.data],
  );

  async function handleDelete() {
    if (!window.confirm("Xoa hoac ngung dung hang hoa nay?")) {
      return;
    }
    setDeleteError(null);
    try {
      const result = await deleteProduct.mutateAsync();
      navigate("/inventory/products", {
        state: {
          productDeleteMessage:
            result.action === "hard_deleted"
              ? "Hang hoa da duoc xoa vinh vien."
              : "Hang hoa da duoc ngung dung.",
        },
      });
    } catch (error) {
      setDeleteError(isApiError(error) ? error.message : "Khong the xoa hang hoa.");
    }
  }

  async function submitStockAdjustment(direction: "increase" | "decrease" | "set") {
    setStockError(null);
    setStockMessage(null);
    if (direction === "set" ? !isQuantity(stockQuantity) : !isPositiveQuantity(stockQuantity)) {
      setStockError(direction === "set" ? "Ton thuc te phai la so hop le." : "So luong phai lon hon 0.");
      return;
    }
    if (!stockNote.trim()) {
      setStockError("Can nhap ly do dieu chinh.");
      return;
    }

    try {
      if (direction === "set") {
        await setStock.mutateAsync({
          unit_type: selectedStockUnit,
          target_quantity: stockQuantity.trim(),
          note: stockNote.trim(),
        });
      } else {
        const mutation = direction === "increase" ? increaseStock : decreaseStock;
        await mutation.mutateAsync({
          unit_type: selectedStockUnit,
          quantity: stockQuantity.trim(),
          note: stockNote.trim(),
        });
      }
      setStockQuantity("");
      setStockNote("");
      setStockMessage(
        direction === "increase" ? "Da tang ton kho." : direction === "decrease" ? "Da giam ton kho." : "Da dat ton thuc te.",
      );
    } catch (error) {
      setStockError(isApiError(error) ? error.message : "Khong the dieu chinh ton kho.");
    }
  }
  function handleStockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitStockAdjustment("increase");
  }

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return <p className="state-message error-message">Ma hang hoa khong hop le.</p>;
  }

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Chi tiet hang hoa" description="Thong tin san pham, gia ban va ton kho hien tai." />
        <div className="row-actions">
          {canMutate && productQuery.isSuccess ? (
            <>
              <Link className="primary-link" to={`/inventory/products/${parsedProductId}/edit`}>
                Sua hang hoa
              </Link>
              <button type="button" onClick={() => void handleDelete()}>
                Xoa hang hoa
              </button>
            </>
          ) : null}
          <Link className="secondary-link" to="/inventory/products">
            Quay lai
          </Link>
        </div>
      </div>

      {productQuery.isLoading ? <p className="state-message">Dang tai chi tiet hang hoa...</p> : null}
      {productQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {deleteError ? <p className="state-message error-message">{deleteError}</p> : null}
      {productQuery.isSuccess ? (
        <>
          <section className="summary-grid" aria-label="Thong tin hang hoa">
            <div className="summary-card">
              <span>Ma hang</span>
              <strong>{productQuery.data.product_code_base}</strong>
            </div>
            <div className="summary-card">
              <span>Ten hang</span>
              <strong>{productQuery.data.product_name}</strong>
            </div>
            <div className="summary-card">
              <span>Kieu don vi</span>
              <strong>{productQuery.data.unit_mode}</strong>
            </div>
            <div className="summary-card">
              <span>Trang thai</span>
              <strong>{productQuery.data.is_active ? "Dang dung" : "Ngung dung"}</strong>
            </div>
            <div className="summary-card">
              <span>Ton kho</span>
              <strong>{balanceText(productQuery.data)}</strong>
            </div>
            <div className="summary-card">
              <span>Ngay tao</span>
              <strong>{formatDateTime(productQuery.data.created_at)}</strong>
            </div>
            <div className="summary-card">
              <span>Cap nhat</span>
              <strong>{formatDateTime(productQuery.data.updated_at)}</strong>
            </div>
            <div className="summary-card">
              <span>Kich hoat lai</span>
              <strong>{productQuery.data.is_active ? "Khong ap dung" : "Chua co API kich hoat lai truc tiep"}</strong>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-title-row">
              <h3>Gia ban</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Don vi</th>
                    <th>Gia</th>
                    <th>Trang thai</th>
                  </tr>
                </thead>
                <tbody>
                  {productQuery.data.prices.map((price) => (
                    <tr key={price.unit_type}>
                      <td>{price.unit_type}</td>
                      <td>{price.price}</td>
                      <td>{price.is_enabled ? "Dang bat" : "Tat"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canMutate ? (
            <section className="inline-edit-panel" aria-label="Dieu chinh ton kho">
              <h4>Dieu chinh ton kho</h4>
              <form className="stock-adjust-form" onSubmit={handleStockSubmit}>
                <label>
                  Don vi
                  <select value={selectedStockUnit} onChange={(event) => setStockUnit(event.target.value as UnitType)}>
                    {availableUnits.map((unitType) => (
                      <option key={unitType} value={unitType}>
                        {unitType}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  So luong
                  <input
                    inputMode="decimal"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                  />
                </label>
                <label>
                  Ly do
                  <input value={stockNote} onChange={(event) => setStockNote(event.target.value)} />
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={increaseStock.isPending || decreaseStock.isPending || setStock.isPending}>
                    Tang ton
                  </button>
                  <button
                    type="button"
                    disabled={increaseStock.isPending || decreaseStock.isPending || setStock.isPending}
                    onClick={() => void submitStockAdjustment("decrease")}
                  >
                    Giam ton
                  </button>
                  <button
                    type="button"
                    disabled={increaseStock.isPending || decreaseStock.isPending || setStock.isPending}
                    onClick={() => void submitStockAdjustment("set")}
                  >
                    Dat ton thuc te
                  </button>
                </div>
              </form>
              {stockMessage ? <p className="state-message">{stockMessage}</p> : null}
              {stockError ? <p className="form-error">{stockError}</p> : null}
            </section>
          ) : null}

          <section className="detail-section">
            <div className="section-title-row">
              <h3>Lich su ton kho</h3>
            </div>
            <section className="toolbar" aria-label="Bo loc lich su ton kho">
              <label>
                Loai phat sinh
                <select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value)}>
                  <option value="">Tat ca</option>
                  <option value="SALE">Ban hang</option>
                  <option value="RETURN">Tra hang</option>
                  <option value="STOCK_INCREASE">Tang ton</option>
                  <option value="STOCK_DECREASE">Giam ton</option>
                  <option value="STOCK_SET">Dat ton thuc te</option>
                </select>
              </label>
              <label>
                Tu ngay
                <input type="date" value={movementDateFrom} onChange={(event) => setMovementDateFrom(event.target.value)} />
              </label>
              <label>
                Den ngay
                <input type="date" value={movementDateTo} onChange={(event) => setMovementDateTo(event.target.value)} />
              </label>
            </section>
            {movementsQuery.isLoading ? <p className="state-message">Dang tai lich su ton kho...</p> : null}
            {movementsQuery.isError ? <p className="state-message error-message">Khong the tai lich su ton kho.</p> : null}
            {movementsQuery.isSuccess && movementsQuery.data.length === 0 ? (
              <p className="state-message">Chua co phat sinh ton kho.</p>
            ) : null}
            {movementsQuery.isSuccess && movementsQuery.data.length > 0 && filteredMovements.length === 0 ? (
              <p className="state-message">Khong co phat sinh phu hop bo loc.</p>
            ) : null}
            {movementsQuery.isSuccess && filteredMovements.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thoi gian</th>
                      <th>Loai</th>
                      <th>So luong</th>
                      <th>Don vi</th>
                      <th>Nguon</th>
                      <th>Ton sau</th>
                      <th>Ghi chu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map((movement) => (
                      <tr key={`${movement.source_type}-${movement.movement_id}`}>
                        <td>{formatDateTime(movement.movement_datetime)}</td>
                        <td>{movementTypeLabel(movement.movement_type)}</td>
                        <td>{movement.quantity_delta}</td>
                        <td>{movement.unit_type}</td>
                        <td>{sourceLink(movement)}</td>
                        <td>{movement.balance_after ?? "-"}</td>
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
    </>
  );
}
