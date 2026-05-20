import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Product, ProductPrice } from "../../api/types";
import { PageHeader } from "../../components/PageHeader";
import { useAuth } from "../../auth/useAuth";
import { useProducts } from "./productQueries";

const writeRoles = ["owner", "admin"] as const;

function canWriteInventory(role: string) {
  return writeRoles.some((writeRole) => writeRole === role);
}

function enabledPriceText(prices: ProductPrice[]) {
  const enabledPrices = prices.filter((price) => price.is_enabled);
  if (enabledPrices.length === 0) {
    return "Chua co gia";
  }
  return enabledPrices.map((price) => `${price.unit_type}: ${price.price}`).join(" | ");
}

function balanceText(product: Product) {
  if (!product.balance) {
    return "Chua co ton kho";
  }
  if (product.unit_mode === "BICH") {
    return product.balance.on_hand_bich_integer ?? "0";
  }
  return `BAO: ${product.balance.on_hand_bao_decimal ?? "0"} | KG: ${product.balance.derived_kg_balance ?? "0"}`;
}

export function ProductListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const location = useLocation();
  const locationState = location.state as { productDeleteMessage?: string } | null;
  const productsQuery = useProducts(search, includeInactive);
  const canCreate = user ? canWriteInventory(user.role) : false;
  const errorMessage = isApiError(productsQuery.error)
    ? productsQuery.error.message
    : "Khong the tai danh sach hang hoa.";

  return (
    <>
      <div className="page-title-row">
        <PageHeader title="Hang hoa" description="Quan ly danh sach san pham, don vi ban va ton kho hien tai." />
        {canCreate ? (
          <Link className="primary-link" to="/inventory/products/new">
            Tạo sản phẩm
          </Link>
        ) : null}
      </div>

      <section className="toolbar" aria-label="Bo loc hang hoa">
        <label>
          Tim kiem
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ten hang hoa"
          />
        </label>
        <label className="inline-choice filter-choice">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Hien hang ngung dung
        </label>
      </section>

      {locationState?.productDeleteMessage ? <p className="state-message">{locationState.productDeleteMessage}</p> : null}
      {productsQuery.isLoading ? <p className="state-message">Dang tai danh sach hang hoa...</p> : null}
      {productsQuery.isError ? <p className="state-message error-message">{errorMessage}</p> : null}
      {productsQuery.isSuccess && productsQuery.data.length === 0 ? (
        <p className="state-message">Chua co hang hoa phu hop.</p>
      ) : null}
      {productsQuery.isSuccess && productsQuery.data.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ma hang</th>
                <th>Ten hang</th>
                <th>Kieu don vi</th>
                <th>Trang thai</th>
                <th>Gia dang bat</th>
                <th>Ton kho</th>
              </tr>
            </thead>
            <tbody>
              {productsQuery.data.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link className="table-link" to={`/inventory/products/${product.id}`}>
                      {product.product_code_base}
                    </Link>
                  </td>
                  <td>{product.product_name}</td>
                  <td>{product.unit_mode}</td>
                  <td>{product.is_active ? "Dang dung" : "Ngung dung"}</td>
                  <td>{enabledPriceText(product.prices)}</td>
                  <td>{balanceText(product)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
