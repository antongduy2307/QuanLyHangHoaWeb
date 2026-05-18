import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import type { Invoice, Product, ReturnInvoice, ReturnInvoiceCreatePayload, UnitType } from "../../api/types";
import { unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { useCustomers } from "../customers/customerQueries";
import { useProducts } from "../inventory/productQueries";
import { useInvoices } from "../sales/invoiceQueries";
import { defaultPriceForUnit, enabledUnitsForProduct } from "../sales/invoiceSchemas";
import {
  applyProductToReturnItem,
  applySourceInvoiceItemToReturnItem,
  estimateReturnTotal,
  formatCents,
  initialReturnFormState,
  newReturnItem,
  returnToFormState,
  toReturnCreatePayload,
  validateReturnForm,
  type ReturnFormState,
} from "./returnSchemas";

type ReturnFormProps = {
  initialReturn?: ReturnInvoice | null;
  mode: "create" | "edit";
  isSubmitting: boolean;
  submitLabel: string;
  errorMessage?: string | null;
  onSubmit: (payload: ReturnInvoiceCreatePayload) => Promise<void>;
};

function productLabel(product: Product) {
  return `${product.product_code_base} - ${product.product_name}`;
}

function invoiceLabel(invoice: Invoice) {
  return `${invoice.invoice_code} - ${invoice.customer_snapshot_name}`;
}

export function ReturnForm({ initialReturn, mode, isSubmitting, submitLabel, errorMessage, onSubmit }: ReturnFormProps) {
  const [formState, setFormState] = useState<ReturnFormState>(() =>
    initialReturn ? returnToFormState(initialReturn) : initialReturnFormState(),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const productsQuery = useProducts("");
  const customersQuery = useCustomers("", false);
  const invoicesQuery = useInvoices();
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const customers = customersQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const sourceInvoice = invoices.find((invoice) => String(invoice.id) === formState.sourceInvoiceId);
  const estimatedTotal = estimateReturnTotal(formState);

  function updateField(field: keyof Pick<ReturnFormState, "return_datetime" | "customer_snapshot_name" | "handling_mode" | "note">, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function updateReturnMode(returnMode: ReturnFormState["returnMode"]) {
    setFormState((current) => ({
      ...current,
      returnMode,
      sourceInvoiceId: returnMode === "quick" ? "" : current.sourceInvoiceId,
      customerMode: returnMode === "linked" ? "customer" : current.customerMode,
      handling_mode: returnMode === "quick" && current.customerMode === "walk_in" ? "REFUND_NOW" : current.handling_mode,
      items: current.items.map((item) => (returnMode === "quick" ? { ...item, sourceInvoiceItemId: "" } : item)),
    }));
  }

  function updateCustomerMode(customerMode: ReturnFormState["customerMode"]) {
    setFormState((current) => ({
      ...current,
      customerMode,
      customerId: customerMode === "walk_in" ? "" : current.customerId,
      customer_snapshot_name: customerMode === "walk_in" ? current.customer_snapshot_name || "Khach le" : "",
      handling_mode: customerMode === "walk_in" ? "REFUND_NOW" : current.handling_mode,
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

  function updateSourceInvoice(sourceInvoiceId: string) {
    const selectedInvoice = invoices.find((invoice) => String(invoice.id) === sourceInvoiceId);
    setFormState((current) => ({
      ...current,
      sourceInvoiceId,
      customerId: selectedInvoice?.customer_id ? String(selectedInvoice.customer_id) : "",
      customer_snapshot_name: selectedInvoice?.customer_snapshot_name ?? "",
      handling_mode: selectedInvoice?.customer_id ? current.handling_mode : "REFUND_NOW",
      items: current.items.map((item) => ({ ...item, sourceInvoiceItemId: "" })),
    }));
  }

  function updateItem(rowId: string, updater: (item: ReturnFormState["items"][number]) => ReturnFormState["items"][number]) {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item) => (item.rowId === rowId ? updater(item) : item)),
    }));
  }

  function updateItemProduct(rowId: string, productId: string) {
    const product = productById.get(productId);
    updateItem(rowId, (item) => applyProductToReturnItem(item, product, productId));
  }

  function updateSourceInvoiceItem(rowId: string, sourceInvoiceItemId: string) {
    updateItem(rowId, (item) => applySourceInvoiceItemToReturnItem(item, sourceInvoice, sourceInvoiceItemId));
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
    const errors = validateReturnForm(formState, products, invoices);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await onSubmit(toReturnCreatePayload(formState, products, invoices));
    } catch (error) {
      setLocalError(isApiError(error) ? error.message : "Khong the luu phieu tra.");
    }
  }

  if (productsQuery.isLoading || customersQuery.isLoading || invoicesQuery.isLoading) {
    return <p className="state-message">Dang tai du lieu phieu tra...</p>;
  }
  if (productsQuery.isError || customersQuery.isError || invoicesQuery.isError) {
    return <p className="state-message error-message">Khong the tai hang hoa, khach hang hoac hoa don.</p>;
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      {mode === "edit" && initialReturn ? <p className="state-message">Dang sua phieu tra: {initialReturn.return_code}</p> : null}

      <label>
        Thoi gian tra hang
        <input
          type="datetime-local"
          value={formState.return_datetime}
          onChange={(event) => updateField("return_datetime", event.target.value)}
        />
        {fieldErrors.return_datetime ? <span className="field-error">{fieldErrors.return_datetime}</span> : null}
      </label>

      <fieldset>
        <legend>Loai phieu tra</legend>
        <label className="inline-choice">
          <input
            type="radio"
            name="returnMode"
            checked={formState.returnMode === "quick"}
            onChange={() => updateReturnMode("quick")}
          />
          Tra nhanh
        </label>
        <label className="inline-choice">
          <input
            type="radio"
            name="returnMode"
            checked={formState.returnMode === "linked"}
            onChange={() => updateReturnMode("linked")}
          />
          Tra theo hoa don
        </label>
      </fieldset>

      {formState.returnMode === "linked" ? (
        <>
          <label>
            Hoa don goc
            <select value={formState.sourceInvoiceId} onChange={(event) => updateSourceInvoice(event.target.value)}>
              <option value="">Chon hoa don goc</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoiceLabel(invoice)}
                </option>
              ))}
            </select>
            {fieldErrors.sourceInvoiceId ? <span className="field-error">{fieldErrors.sourceInvoiceId}</span> : null}
          </label>
          <p className="muted-text">Khach hang: {(sourceInvoice?.customer_snapshot_name ?? formState.customer_snapshot_name) || "-"}</p>
        </>
      ) : (
        <>
          <fieldset>
            <legend>Loai khach</legend>
            <label className="inline-choice">
              <input
                type="radio"
                name="customerMode"
                checked={formState.customerMode === "walk_in"}
                onChange={() => updateCustomerMode("walk_in")}
              />
              Khach le
            </label>
            <label className="inline-choice">
              <input
                type="radio"
                name="customerMode"
                checked={formState.customerMode === "customer"}
                onChange={() => updateCustomerMode("customer")}
              />
              Khach hang
            </label>
          </fieldset>

          {formState.customerMode === "customer" ? (
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
        </>
      )}

      <label>
        Cach xu ly
        <select value={formState.handling_mode} onChange={(event) => updateField("handling_mode", event.target.value)}>
          <option value="REFUND_NOW">Hoan tien ngay</option>
          <option value="STORE_CREDIT">Tru cong no</option>
        </select>
        {fieldErrors.handling_mode ? <span className="field-error">{fieldErrors.handling_mode}</span> : null}
      </label>

      <label>
        Ghi chu
        <textarea value={formState.note} onChange={(event) => updateField("note", event.target.value)} />
      </label>

      <fieldset>
        <legend>Dong hang tra</legend>
        {fieldErrors.items ? <p className="field-error">{fieldErrors.items}</p> : null}
        {formState.items.map((item, index) => {
          const product = productById.get(item.productId);
          const unitChoices = product ? enabledUnitsForProduct(product) : [];
          const prefix = `items.${index}`;
          return (
            <div className="line-item-panel" key={item.rowId}>
              {formState.returnMode === "linked" ? (
                <label>
                  Dong hoa don goc
                  <select value={item.sourceInvoiceItemId} onChange={(event) => updateSourceInvoiceItem(item.rowId, event.target.value)}>
                    <option value="">Chon dong hoa don goc</option>
                    {sourceInvoice?.items.map((sourceItem) => (
                      <option key={sourceItem.id} value={sourceItem.id}>
                        #{sourceItem.id} - {sourceItem.product_code_snapshot} - {sourceItem.product_name_snapshot}
                      </option>
                    ))}
                  </select>
                  {fieldErrors[`${prefix}.sourceInvoiceItemId`] ? (
                    <span className="field-error">{fieldErrors[`${prefix}.sourceInvoiceItemId`]}</span>
                  ) : null}
                </label>
              ) : null}

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
          onClick={() => setFormState((current) => ({ ...current, items: [...current.items, newReturnItem()] }))}
        >
          Them dong hang
        </button>
      </fieldset>

      <p className="state-message">Tong tam tinh: {formatMoney(formatCents(estimatedTotal))}</p>
      {localError || errorMessage ? <p className="form-error">{localError || errorMessage}</p> : null}

      <div className="form-actions">
        <Link className="secondary-link" to={initialReturn ? `/returns/${initialReturn.id}` : "/returns"}>
          Huy
        </Link>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Dang luu" : submitLabel}
        </button>
      </div>
    </form>
  );
}
