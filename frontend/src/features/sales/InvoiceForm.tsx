import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Customer, Invoice, InvoiceCreatePayload, Product, UnitType } from "../../api/types";
import { unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useCustomers } from "../customers/customerQueries";
import { useProducts } from "../inventory/productQueries";
import {
  defaultPriceForUnit,
  enabledUnitsForProduct,
  estimateInvoiceTotal,
  formatCents,
  initialInvoiceFormState,
  invoiceToFormState,
  isNonNegativeMoney,
  isPositiveDecimal,
  lineEstimateCents,
  mergeHistoricalCustomer,
  mergeHistoricalProducts,
  newInvoiceItem,
  toInvoiceCreatePayload,
  validateInvoiceForm,
  type InvoiceFormState,
} from "./invoiceSchemas";

type InvoiceFormProps = {
  initialInvoice?: Invoice | null;
  mode: "create" | "edit";
  isSubmitting: boolean;
  submitLabel: string;
  errorMessage?: string | null;
  onSubmit: (payload: InvoiceCreatePayload) => Promise<void>;
};

function productLabel(product: Product) {
  return `${product.product_code_base} - ${product.product_name}`;
}

function productPriceLabel(product: Product) {
  const enabledPrices = product.prices
    .filter((price) => price.is_enabled)
    .map((price) => `${price.unit_type}: ${price.price}`)
    .join(" | ");
  return enabledPrices || "Chưa có giá đang bật";
}

function customerLabel(customer: Customer) {
  return customer.phone ? `${customer.customer_name} - ${customer.phone}` : customer.customer_name;
}

export function InvoiceForm({ initialInvoice, mode, isSubmitting, submitLabel, errorMessage, onSubmit }: InvoiceFormProps) {
  const [formState, setFormState] = useState<InvoiceFormState>(() =>
    initialInvoice ? invoiceToFormState(initialInvoice) : initialInvoiceFormState(),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const productsQuery = useProducts("");
  const customersQuery = useCustomers("", false);
  const products = useMemo(
    () => mergeHistoricalProducts(productsQuery.data ?? [], formState.items, initialInvoice?.created_at, initialInvoice?.updated_at),
    [formState.items, initialInvoice?.created_at, initialInvoice?.updated_at, productsQuery.data],
  );
  const customers = useMemo(
    () =>
      mergeHistoricalCustomer(
        customersQuery.data ?? [],
        initialInvoice?.customer_id
          ? {
              customerId: String(initialInvoice.customer_id),
              customerSnapshotName: initialInvoice.customer_snapshot_name,
              createdAt: initialInvoice.created_at,
              updatedAt: initialInvoice.updated_at,
            }
          : null,
      ),
    [customersQuery.data, initialInvoice],
  );
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const estimatedTotal = estimateInvoiceTotal(formState);
  const firstProduct = products[0];

  function updateField(
    field: keyof Pick<InvoiceFormState, "invoice_datetime" | "customer_snapshot_name" | "paid_amount" | "payment_method" | "note">,
    value: string,
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function updateSaleMode(saleMode: InvoiceFormState["saleMode"]) {
    setFormState((current) => ({
      ...current,
      saleMode,
      customerId: saleMode === "walk_in" ? "" : current.customerId,
      customer_snapshot_name: saleMode === "walk_in" ? current.customer_snapshot_name || "Khách lẻ" : "",
    }));
  }

  function updateCustomer(customerId: string) {
    const customer = customers.find((candidate) => String(candidate.id) === customerId);
    setFormState((current) => ({
      ...current,
      customerId,
      customer_snapshot_name: customer?.customer_name ?? "",
    }));
  }

  function updateItem(rowId: string, updater: (item: InvoiceFormState["items"][number]) => InvoiceFormState["items"][number]) {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item) => (item.rowId === rowId ? updater(item) : item)),
    }));
  }

  function updateItemProduct(rowId: string, productId: string) {
    const product = productById.get(productId);
    const defaultUnit = product ? enabledUnitsForProduct(product)[0] ?? "" : "";
    updateItem(rowId, (item) => ({
      ...item,
      productId,
      unitType: defaultUnit,
      unitPrice: product ? defaultPriceForUnit(product, defaultUnit) : "",
    }));
  }

  function updateItemUnit(rowId: string, unitType: UnitType) {
    updateItem(rowId, (item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        unitType,
        unitPrice: product ? defaultPriceForUnit(product, unitType) : item.unitPrice,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    const errors = validateInvoiceForm(formState, products);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await onSubmit(toInvoiceCreatePayload(formState, products));
    } catch (error) {
      setLocalError(isApiError(error) ? error.message : "Không thể lưu hóa đơn.");
    }
  }

  function addInvoiceItem(prefillFirstProduct = false) {
    const item = newInvoiceItem();
    if (!prefillFirstProduct || !firstProduct) {
      setFormState((current) => ({ ...current, items: [...current.items, item] }));
      return;
    }
    const defaultUnit = enabledUnitsForProduct(firstProduct)[0] ?? "";
    setFormState((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...item,
          productId: String(firstProduct.id),
          unitType: defaultUnit,
          unitPrice: defaultPriceForUnit(firstProduct, defaultUnit),
        },
      ],
    }));
  }

  if (productsQuery.isLoading || customersQuery.isLoading) {
    return <p className="state-message">Đang tải dữ liệu hóa đơn...</p>;
  }
  if (productsQuery.isError || customersQuery.isError) {
    return <p className="state-message error-message">Không thể tải hàng hóa khách hàng.</p>;
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      {mode === "edit" && initialInvoice ? (
        <p className="state-message">Đang sửa hóa đơn: {initialInvoice.invoice_code}</p>
      ) : null}
      <label>
        Thời gian hóa đơn
        <input
          type="datetime-local"
          value={formState.invoice_datetime}
          onChange={(event) => updateField("invoice_datetime", event.target.value)}
        />
        {fieldErrors.invoice_datetime ? <span className="field-error">{fieldErrors.invoice_datetime}</span> : null}
      </label>

      <fieldset>
        <legend>Loại bán hàng</legend>
        <label className="inline-choice">
          <input
            type="radio"
            name="saleMode"
            checked={formState.saleMode === "walk_in"}
            onChange={() => updateSaleMode("walk_in")}
          />
          Khách lẻ
        </label>
        <label className="inline-choice">
          <input
            type="radio"
            name="saleMode"
            checked={formState.saleMode === "customer"}
            onChange={() => updateSaleMode("customer")}
          />
          Khách hàng
        </label>
      </fieldset>

      {formState.saleMode === "customer" ? (
        <label>
          Chọn khách hàng
          <select value={formState.customerId} onChange={(event) => updateCustomer(event.target.value)}>
            <option value="">Chọn khách hàng</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customerLabel(customer)}
              </option>
            ))}
          </select>
          {fieldErrors.customerId ? <span className="field-error">{fieldErrors.customerId}</span> : null}
        </label>
      ) : (
        <label>
          Tên Khách lẻ
          <input value={formState.customer_snapshot_name} onChange={(event) => updateField("customer_snapshot_name", event.target.value)} />
          {fieldErrors.customer_snapshot_name ? <span className="field-error">{fieldErrors.customer_snapshot_name}</span> : null}
        </label>
      )}

      <label>
        Đã thanh toán
        <input inputMode="decimal" value={formState.paid_amount} onChange={(event) => updateField("paid_amount", event.target.value)} />
        {fieldErrors.paid_amount ? <span className="field-error">{fieldErrors.paid_amount}</span> : null}
      </label>

      <label>
        Phương thức thanh toán
        <select value={formState.payment_method} onChange={(event) => updateField("payment_method", event.target.value)}>
          <option value="">Không ghi nhận</option>
          <option value="CASH">Tiền mặt</option>
          <option value="BANK_TRANSFER">Chuyển khoản</option>
        </select>
      </label>

      <label>
        Ghi chú
        <textarea value={formState.note} onChange={(event) => updateField("note", event.target.value)} />
      </label>

      <fieldset>
        <legend>Dòng hàng</legend>
        {fieldErrors.items ? <p className="field-error">{fieldErrors.items}</p> : null}
        {formState.items.map((item, index) => {
          const product = productById.get(item.productId);
          const unitChoices = product ? enabledUnitsForProduct(product) : [];
          const prefix = `items.${index}`;
          return (
            <div className="line-item-panel" key={item.rowId}>
              <label>
                Hàng hóa
                <select value={item.productId} onChange={(event) => updateItemProduct(item.rowId, event.target.value)}>
                  <option value="">Chọn hàng hóa</option>
                  {products.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {productLabel(candidate)} ({productPriceLabel(candidate)})
                    </option>
                  ))}
                </select>
                {fieldErrors[`${prefix}.productId`] ? <span className="field-error">{fieldErrors[`${prefix}.productId`]}</span> : null}
              </label>
              {product ? <p className="muted-text">Giá đang bật: {productPriceLabel(product)}</p> : null}

              <label>
                Đơn vị
                <select value={item.unitType} onChange={(event) => updateItemUnit(item.rowId, event.target.value as UnitType)}>
                  <option value="">Chọn đơn vị</option>
                  {unitChoices.map((unitType) => (
                    <option key={unitType} value={unitType}>
                      {unitLabel(unitType)}
                    </option>
                  ))}
                </select>
                {fieldErrors[`${prefix}.unitType`] ? <span className="field-error">{fieldErrors[`${prefix}.unitType`]}</span> : null}
              </label>

              <label>
                Số lượng
                <input
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(event) => updateItem(item.rowId, (current) => ({ ...current, quantity: event.target.value }))}
                />
                {fieldErrors[`${prefix}.quantity`] ? <span className="field-error">{fieldErrors[`${prefix}.quantity`]}</span> : null}
              </label>

              <label>
                Đơn giá
                <input
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(event) => updateItem(item.rowId, (current) => ({ ...current, unitPrice: event.target.value }))}
                />
                {fieldErrors[`${prefix}.unitPrice`] ? <span className="field-error">{fieldErrors[`${prefix}.unitPrice`]}</span> : null}
              </label>
              <p className="muted-text">
                Tạm tính dòng:{" "}
                {formatMoney(
                  formatCents(
                    isPositiveDecimal(item.quantity) && isNonNegativeMoney(item.unitPrice)
                      ? lineEstimateCents(item.quantity, item.unitPrice)
                      : null,
                  ),
                )}
              </p>

              <button
                className="secondary-link"
                type="button"
                onClick={() => setFormState((current) => ({ ...current, items: current.items.filter((row) => row.rowId !== item.rowId) }))}
              >
                Xóa dòng
              </button>
            </div>
          );
        })}
        <button
          className="secondary-button"
          type="button"
          onClick={() => addInvoiceItem()}
        >
          Thêm dòng hàng
        </button>
        <button className="secondary-button" type="button" onClick={() => addInvoiceItem(true)}>
          Thêm nhanh hàng đầu tiên
        </button>
      </fieldset>

      <p className="state-message">
        Tổng tạm tính: {formatMoney(formatCents(estimatedTotal))} | Đã thanh toán: {formatMoney(formState.paid_amount || "0")}
      </p>
      {localError || errorMessage ? <p className="form-error">{localError || errorMessage}</p> : null}

      <div className="form-actions">
        <Link className="secondary-link" to={initialInvoice ? `/sales/invoices/${initialInvoice.id}` : "/sales/invoices"}>
          Hủy
        </Link>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Dang luu" : submitLabel}
        </button>
      </div>
    </form>
  );
}
