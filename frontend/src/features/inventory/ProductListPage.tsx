import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { deleteProduct } from "../../api/inventory";
import { isApiError } from "../../api/errors";
import type { Product, ProductPrice, UnitMode } from "../../api/types";
import { useAuth } from "../../auth/useAuth";
import { InventoryModuleShell } from "./InventoryModuleShell";
import { useProducts } from "./productQueries";

const writeRoles = ["owner", "admin"] as const;

type UnitFilter = "ALL" | UnitMode;

function canWriteInventory(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

function unitModeLabel(unitMode: UnitMode) {
  return unitMode === "BAO_KG" ? "Bao / Kg" : "Bịch";
}

function enabledPriceText(product: Product) {
  if (product.unit_mode === "BICH") {
    const bichPrice = product.prices.find((price) => price.unit_type === "BICH" && price.is_enabled);
    return bichPrice ? `${bichPrice.price} / Bịch` : "Chưa có giá";
  }

  const baoPrice = product.prices.find((price) => price.unit_type === "BAO" && price.is_enabled);
  if (baoPrice) {
    return `${baoPrice.price} / Bao`;
  }

  const kgPrice = product.prices.find((price) => price.unit_type === "KG" && price.is_enabled);
  if (kgPrice) {
    return `${kgPrice.price} / Kg`;
  }

  return "Chưa có giá";
}

function sellingUnitText(product: Product, prices: ProductPrice[]) {
  if (product.unit_mode === "BICH") {
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

function balanceText(product: Product) {
  if (!product.balance) {
    return "Chưa có tồn";
  }
  if (product.unit_mode === "BICH") {
    return `${product.balance.on_hand_bich_integer ?? "0"} Bịch`;
  }
  return `${product.balance.on_hand_bao_decimal ?? "0"} Bao · ${product.balance.derived_kg_balance ?? "0"} Kg`;
}

function filterProducts(products: Product[], unitFilter: UnitFilter) {
  if (unitFilter === "ALL") {
    return products;
  }
  return products.filter((product) => product.unit_mode === unitFilter);
}

export function ProductListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const locationState = location.state as { productDeleteMessage?: string } | null;
  const productsQuery = useProducts(search, includeInactive);
  const canMutate = user ? canWriteInventory(user.role) : false;
  const errorMessage = isApiError(productsQuery.error)
    ? productsQuery.error.message
    : "Không thể tải danh sách hàng hóa.";
  const products = filterProducts(productsQuery.data ?? [], unitFilter);
  const selectedCount = selectedIds.length;
  const hasVisibleProducts = products.length > 0;
  const allVisibleSelected = hasVisibleProducts && products.every((product) => selectedIds.includes(product.id));

  function clearMessages() {
    setActionMessage(null);
    setActionError(null);
  }

  function toggleSelection(productId: number, checked: boolean) {
    clearMessages();
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(productId) ? current : [...current, productId];
      }
      return current.filter((id) => id !== productId);
    });
  }

  function toggleSelectAll(checked: boolean) {
    clearMessages();
    setSelectedIds((current) => {
      if (!checked) {
        return current.filter((id) => !products.some((product) => product.id === id));
      }
      const nextIds = new Set(current);
      products.forEach((product) => nextIds.add(product.id));
      return [...nextIds];
    });
  }

  function navigateToDetail(productId: number) {
    navigate(`/inventory/products/${productId}`);
  }

  async function handleDelete() {
    if (!canMutate || selectedCount === 0 || isDeleting) {
      return;
    }

    const confirmMessage =
      selectedCount === 1
        ? "Xóa hoặc ngưng dùng hàng hóa đã chọn?"
        : `Xóa hoặc ngưng dùng ${selectedCount} hàng hóa đã chọn?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    clearMessages();
    setIsDeleting(true);
    const failures: string[] = [];
    let successCount = 0;

    for (const productId of selectedIds) {
      try {
        await deleteProduct(productId);
        successCount += 1;
      } catch (error) {
        failures.push(isApiError(error) ? error.message : `Không thể xóa hàng hóa #${productId}.`);
      }
    }

    setSelectedIds([]);
    await productsQuery.refetch();
    setIsDeleting(false);

    if (failures.length > 0) {
      setActionError(
        successCount > 0
          ? `Đã xử lý ${successCount}/${selectedCount} hàng hóa. ${failures.join(" ")}`
          : failures.join(" "),
      );
      return;
    }

    setActionMessage(
      successCount === 1 ? "Đã xử lý xóa hàng hóa đã chọn." : `Đã xử lý xóa ${successCount} hàng hóa đã chọn.`,
    );
  }

  return (
    <InventoryModuleShell
      title="Hàng hóa"
      description="Theo dõi mã hàng, đơn vị bán, giá bán đang bật và tồn kho hiện tại theo bố cục vận hành gọn."
      contentClassName="inventory-layout"
      compactHero
      hideDescription
    >
      <aside className="inventory-filter-panel" aria-label="Bộ lọc hàng hóa">
        <section className="inventory-filter-card">
          <div className="inventory-filter-card__header">
            <h3>Loại hàng</h3>
            <span>{products.length}</span>
          </div>
          <label className="inventory-filter-option">
            <input type="radio" name="unit-filter" checked={unitFilter === "ALL"} onChange={() => setUnitFilter("ALL")} />
            <span>Tất cả</span>
          </label>
          <label className="inventory-filter-option">
            <input
              type="radio"
              name="unit-filter"
              checked={unitFilter === "BAO_KG"}
              onChange={() => setUnitFilter("BAO_KG")}
            />
            <span>Bao / Kg</span>
          </label>
          <label className="inventory-filter-option">
            <input type="radio" name="unit-filter" checked={unitFilter === "BICH"} onChange={() => setUnitFilter("BICH")} />
            <span>Bịch</span>
          </label>
        </section>

        <section className="inventory-filter-card">
          <div className="inventory-filter-card__header">
            <h3>Hiển thị</h3>
          </div>
          <label className="inventory-filter-option">
            <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
            <span>Hiển thị hàng ngưng dùng</span>
          </label>
        </section>
      </aside>

      <section className="inventory-main-panel">
        <div className="inventory-toolbar">
          <div className="inventory-toolbar__search">
            <label htmlFor="inventory-name-search">Tìm hàng hóa</label>
            <input
              id="inventory-name-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hàng..."
            />
          </div>

          <div className="inventory-toolbar__actions">
            {canMutate ? (
              <>
                <button className="inventory-solid-button" type="button" onClick={() => navigate("/inventory/products/new")}>
                  Tạo mới
                </button>
                <button
                  className="inventory-ghost-button inventory-ghost-button--danger"
                  type="button"
                  disabled={selectedCount === 0 || isDeleting}
                  onClick={() => void handleDelete()}
                >
                  Xóa
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="inventory-selection-bar" aria-live="polite">
          <span>{selectedCount > 0 ? `Đã chọn ${selectedCount} hàng hóa` : "Chưa chọn hàng hóa nào"}</span>
          <span>{includeInactive ? "Đang gồm hàng ngưng dùng" : "Chỉ hiển thị hàng đang dùng"}</span>
        </div>

        {locationState?.productDeleteMessage ? <p className="state-message">{locationState.productDeleteMessage}</p> : null}
        {actionMessage ? <p className="state-message">{actionMessage}</p> : null}
        {actionError ? <p className="state-message error-message">{actionError}</p> : null}
        {productsQuery.isLoading ? <p className="state-message">Đang tải danh sách hàng hóa...</p> : null}
        {productsQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
        {productsQuery.isSuccess && products.length === 0 ? <p className="state-message">Chưa có hàng hóa phù hợp.</p> : null}
        {productsQuery.isSuccess && products.length > 0 ? (
          <div className="table-wrap inventory-table-wrap">
            <table className="data-table inventory-data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="Chọn tất cả hàng hóa"
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th>Mã hàng</th>
                  <th>Tên hàng</th>
                  <th>Đơn vị bán</th>
                  <th>Giá bán</th>
                  <th>Tồn kho</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <tr
                      key={product.id}
                      className={isSelected ? "inventory-row selected" : "inventory-row"}
                      onClick={() => navigateToDetail(product.id)}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={`Chọn hàng hóa ${product.product_name}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => toggleSelection(product.id, event.target.checked)}
                        />
                      </td>
                      <td>{product.product_code_base}</td>
                      <td>
                        <NavLink
                          className="table-link"
                          to={`/inventory/products/${product.id}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {product.product_name}
                        </NavLink>
                        <div className="inventory-subtext">{unitModeLabel(product.unit_mode)}</div>
                      </td>
                      <td>{sellingUnitText(product, product.prices)}</td>
                      <td>{enabledPriceText(product)}</td>
                      <td>{balanceText(product)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </InventoryModuleShell>
  );
}
