import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Invoice, InvoiceCreatePayload, Product, UnitType } from "../../api/types";
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

export function InvoiceForm({ initialInvoice, mode, isSubmitting, submitLabel, errorMessage, onSubmit }: InvoiceFormProps) {
  const [formState, setFormState] = useState<InvoiceFormState>(() =>
    initialInvoice ? invoiceToFormState(initialInvoice) : initialInvoiceFormState(),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const productsQuery = useProducts("");
  const customersQuery = useCustomers("", false);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const customers = customersQuery.data ?? [];
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const estimatedTotal = estimateInvoiceTotal(formState);

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
      customer_snapshot_name: saleMode === "walk_in" ? current.customer_snapshot_name || "Khach le" : "",
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
      setLocalError(isApiError(error) ? error.message : "Khong the luu hoa don.");
    }
  }

  if (productsQuery.isLoading || customersQuery.isLoading) {
    return <p className="state-message">Dang tai du lieu hoa don...</p>;
  }
  if (productsQuery.isError || customersQuery.isError) {
    return <p className="state-message error-message">Khong the tai hang hoa hoac khach hang.</p>;
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      {mode === "edit" && initialInvoice ? (
        <p className="state-message">Dang sua hoa don: {initialInvoice.invoice_code}</p>
      ) : null}
      <label>
        Thoi gian hoa don
        <input
          type="datetime-local"
          value={formState.invoice_datetime}
          onChange={(event) => updateField("invoice_datetime", event.target.value)}
        />
        {fieldErrors.invoice_datetime ? <span className="field-error">{fieldErrors.invoice_datetime}</span> : null}
      </label>

      <fieldset>
        <legend>Loai ban hang</legend>
        <label className="inline-choice">
          <input
            type="radio"
            name="saleMode"
            checked={formState.saleMode === "walk_in"}
            onChange={() => updateSaleMode("walk_in")}
          />
          Khach le
        </label>
        <label className="inline-choice">
          <input
            type="radio"
            name="saleMode"
            checked={formState.saleMode === "customer"}
            onChange={() => updateSaleMode("customer")}
          />
          Khach hang
        </label>
      </fieldset>

      {formState.saleMode === "customer" ? (
        <label>
          Chon khach hang
          <select value={formState.customerId} onChange={(event) => updateCustomer(event.target.value)}>
            <option value="">Chon khach hang</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_name}
              </option>
            ))}
          </select>
          {fieldErrors.customerId ? <span className="field-error">{fieldErrors.customerId}</span> : null}
        </label>
      ) : (
        <label>
          Ten khach le
          <input value={formState.customer_snapshot_name} onChange={(event) => updateField("customer_snapshot_name", event.target.value)} />
          {fieldErrors.customer_snapshot_name ? <span className="field-error">{fieldErrors.customer_snapshot_name}</span> : null}
        </label>
      )}

      <label>
        Da thanh toan
        <input inputMode="decimal" value={formState.paid_amount} onChange={(event) => updateField("paid_amount", event.target.value)} />
        {fieldErrors.paid_amount ? <span className="field-error">{fieldErrors.paid_amount}</span> : null}
      </label>

      <label>
        Phuong thuc thanh toan
        <select value={formState.payment_method} onChange={(event) => updateField("payment_method", event.target.value)}>
          <option value="">Khong ghi nhan</option>
          <option value="CASH">Tien mat</option>
          <option value="BANK_TRANSFER">Chuyen khoan</option>
        </select>
      </label>

      <label>
        Ghi chu
        <textarea value={formState.note} onChange={(event) => updateField("note", event.target.value)} />
      </label>

      <fieldset>
        <legend>Dong hang</legend>
        {fieldErrors.items ? <p className="field-error">{fieldErrors.items}</p> : null}
        {formState.items.map((item, index) => {
          const product = productById.get(item.productId);
          const unitChoices = product ? enabledUnitsForProduct(product) : [];
          const prefix = `items.${index}`;
          return (
            <div className="line-item-panel" key={item.rowId}>
              <label>
                Hang hoa
                <select value={item.productId} onChange={(event) => updateItemProduct(item.rowId, event.target.value)}>
                  <option value="">Chon hang hoa</option>
                  {products.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {productLabel(candidate)}
                    </option>
                  ))}
                </select>
                {fieldErrors[`${prefix}.productId`] ? <span className="field-error">{fieldErrors[`${prefix}.productId`]}</span> : null}
              </label>
              {product ? <p className="muted-text">Da chon: {productLabel(product)}</p> : null}

              <label>
                Don vi
                <select value={item.unitType} onChange={(event) => updateItemUnit(item.rowId, event.target.value as UnitType)}>
                  <option value="">Chon don vi</option>
                  {unitChoices.map((unitType) => (
                    <option key={unitType} value={unitType}>
                      {unitLabel(unitType)}
                    </option>
                  ))}
                </select>
                {fieldErrors[`${prefix}.unitType`] ? <span className="field-error">{fieldErrors[`${prefix}.unitType`]}</span> : null}
              </label>

              <label>
                So luong
                <input
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(event) => updateItem(item.rowId, (current) => ({ ...current, quantity: event.target.value }))}
                />
                {fieldErrors[`${prefix}.quantity`] ? <span className="field-error">{fieldErrors[`${prefix}.quantity`]}</span> : null}
              </label>

              <label>
                Don gia
                <input
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(event) => updateItem(item.rowId, (current) => ({ ...current, unitPrice: event.target.value }))}
                />
                {fieldErrors[`${prefix}.unitPrice`] ? <span className="field-error">{fieldErrors[`${prefix}.unitPrice`]}</span> : null}
              </label>

              <button
                className="secondary-link"
                type="button"
                onClick={() => setFormState((current) => ({ ...current, items: current.items.filter((row) => row.rowId !== item.rowId) }))}
              >
                Xoa dong
              </button>
            </div>
          );
        })}
        <button
          className="secondary-button"
          type="button"
          onClick={() => setFormState((current) => ({ ...current, items: [...current.items, newInvoiceItem()] }))}
        >
          Them dong hang
        </button>
      </fieldset>

      <p className="state-message">Tong tam tinh: {formatMoney(formatCents(estimatedTotal))}</p>
      {localError || errorMessage ? <p className="form-error">{localError || errorMessage}</p> : null}

      <div className="form-actions">
        <Link className="secondary-link" to={initialInvoice ? `/sales/invoices/${initialInvoice.id}` : "/sales/invoices"}>
          Huy
        </Link>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Dang luu" : submitLabel}
        </button>
      </div>
    </form>
  );
}
