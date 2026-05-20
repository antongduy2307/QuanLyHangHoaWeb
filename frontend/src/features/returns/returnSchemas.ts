import type { Invoice, Product, ReturnHandlingMode, ReturnInvoice, ReturnInvoiceCreatePayload, UnitType } from "../../api/types";
import { defaultPriceForUnit, enabledUnitsForProduct, formatCents, localDateTimeNow, toLocalDateTimeInput } from "../sales/invoiceSchemas";

export type ReturnItemFormState = {
  rowId: string;
  productId: string;
  unitType: UnitType | "";
  quantity: string;
  unitPrice: string;
  sourceInvoiceItemId: string;
};

export type ReturnFormState = {
  return_datetime: string;
  returnMode: "quick" | "linked";
  sourceInvoiceId: string;
  customerMode: "walk_in" | "customer";
  customerId: string;
  customer_snapshot_name: string;
  handling_mode: ReturnHandlingMode;
  note: string;
  items: ReturnItemFormState[];
};

export type ReturnFormErrors = Record<string, string>;

const decimalPattern = /^(?:\d+)(?:\.\d{1,3})?$/;
const moneyPattern = /^(?:\d+)(?:\.\d{1,2})?$/;

export function isNonNegativeMoney(value: string) {
  return moneyPattern.test(value.trim());
}

export function isPositiveDecimal(value: string) {
  const normalized = value.trim();
  return decimalPattern.test(normalized) && !/^0(?:\.0{1,3})?$/.test(normalized);
}

function parseScaled(value: string, scale: number) {
  const [whole, fraction = ""] = value.trim().split(".");
  const paddedFraction = fraction.padEnd(scale, "0").slice(0, scale);
  return BigInt(whole || "0") * 10n ** BigInt(scale) + BigInt(paddedFraction || "0");
}

function isCompatibleUnit(product: Product, unitType: UnitType | "") {
  if (!unitType) {
    return false;
  }
  return product.unit_mode === "BICH" ? unitType === "BICH" : unitType === "BAO" || unitType === "KG";
}

export function newReturnItem(rowId = crypto.randomUUID()): ReturnItemFormState {
  return {
    rowId,
    productId: "",
    unitType: "",
    quantity: "1",
    unitPrice: "",
    sourceInvoiceItemId: "",
  };
}

export function initialReturnFormState(): ReturnFormState {
  return {
    return_datetime: localDateTimeNow(),
    returnMode: "quick",
    sourceInvoiceId: "",
    customerMode: "walk_in",
    customerId: "",
    customer_snapshot_name: "Khach le",
    handling_mode: "REFUND_NOW",
    note: "",
    items: [newReturnItem()],
  };
}

export function returnToFormState(returnInvoice: ReturnInvoice): ReturnFormState {
  return {
    return_datetime: toLocalDateTimeInput(returnInvoice.return_datetime),
    returnMode: returnInvoice.source_invoice_id ? "linked" : "quick",
    sourceInvoiceId: returnInvoice.source_invoice_id ? String(returnInvoice.source_invoice_id) : "",
    customerMode: returnInvoice.customer_id ? "customer" : "walk_in",
    customerId: returnInvoice.customer_id ? String(returnInvoice.customer_id) : "",
    customer_snapshot_name: returnInvoice.customer_snapshot_name,
    handling_mode: returnInvoice.handling_mode === "STORE_CREDIT" ? "STORE_CREDIT" : "REFUND_NOW",
    note: returnInvoice.note ?? "",
    items: returnInvoice.items.map((item) => ({
      rowId: `return-item-${item.id}`,
      productId: String(item.product_id),
      unitType: item.unit_type,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      sourceInvoiceItemId: item.source_invoice_item_id ? String(item.source_invoice_item_id) : "",
    })),
  };
}

function findSourceInvoice(invoices: Invoice[], sourceInvoiceId: string) {
  return invoices.find((invoice) => String(invoice.id) === sourceInvoiceId);
}

function findSourceInvoiceItem(invoices: Invoice[], sourceInvoiceId: string, sourceInvoiceItemId: string) {
  const sourceInvoice = findSourceInvoice(invoices, sourceInvoiceId);
  return sourceInvoice?.items.find((item) => String(item.id) === sourceInvoiceItemId);
}

export function lineEstimateCents(quantity: string, unitPrice: string) {
  const quantityThousandths = parseScaled(quantity, 3);
  const priceCents = parseScaled(unitPrice, 2);
  return (quantityThousandths * priceCents) / 1000n;
}

function lineTotalCents(item: ReturnItemFormState) {
  return lineEstimateCents(item.quantity, item.unitPrice);
}

export function estimateReturnTotal(formState: ReturnFormState) {
  if (formState.items.some((item) => !isPositiveDecimal(item.quantity) || !isNonNegativeMoney(item.unitPrice))) {
    return null;
  }
  return formState.items.reduce((total, item) => total + lineTotalCents(item), 0n);
}

export { formatCents };

export function validateReturnForm(formState: ReturnFormState, products: Product[], invoices: Invoice[]) {
  const errors: ReturnFormErrors = {};
  const productById = new Map(products.map((product) => [String(product.id), product]));
  const sourceInvoice = findSourceInvoice(invoices, formState.sourceInvoiceId);

  if (!formState.return_datetime) {
    errors.return_datetime = "Thoi gian tra hang la bat buoc.";
  }
  if (formState.returnMode === "linked" && !formState.sourceInvoiceId) {
    errors.sourceInvoiceId = "Can chon hoa don goc.";
  }
  if (formState.returnMode === "quick" && formState.customerMode === "customer" && !formState.customerId) {
    errors.customerId = "Can chon khach hang.";
  }
  if (formState.returnMode === "quick" && formState.customerMode === "walk_in" && !formState.customer_snapshot_name.trim()) {
    errors.customer_snapshot_name = "Ten khach le la bat buoc.";
  }
  if (formState.returnMode === "quick" && formState.customerMode === "walk_in" && formState.handling_mode === "STORE_CREDIT") {
    errors.handling_mode = "Phieu tra khach le chi duoc hoan tien ngay.";
  }
  if (sourceInvoice?.customer_id === null && formState.handling_mode === "STORE_CREDIT") {
    errors.handling_mode = "Hoa don khach le chi duoc hoan tien ngay.";
  }
  if (formState.items.length === 0) {
    errors.items = "Phieu tra can it nhat mot dong hang.";
  }

  formState.items.forEach((item, index) => {
    const prefix = `items.${index}`;
    const product = productById.get(item.productId);
    const sourceItem = findSourceInvoiceItem(invoices, formState.sourceInvoiceId, item.sourceInvoiceItemId);

    if (formState.returnMode === "linked" && !item.sourceInvoiceItemId) {
      errors[`${prefix}.sourceInvoiceItemId`] = "Can chon dong hoa don goc.";
    }
    if (!product) {
      errors[`${prefix}.productId`] = "Can chon hang hoa.";
    }
    if (!item.unitType) {
      errors[`${prefix}.unitType`] = "Can chon don vi.";
    } else if (product && !isCompatibleUnit(product, item.unitType)) {
      errors[`${prefix}.unitType`] = "Don vi khong phu hop voi hang hoa.";
    }
    if (!isPositiveDecimal(item.quantity)) {
      errors[`${prefix}.quantity`] = "So luong phai lon hon 0.";
    }
    if (!isNonNegativeMoney(item.unitPrice)) {
      errors[`${prefix}.unitPrice`] = "Don gia phai la so khong am.";
    }
    if (sourceItem && isPositiveDecimal(item.quantity) && parseScaled(item.quantity, 3) > parseScaled(sourceItem.quantity, 3)) {
      errors[`${prefix}.quantity`] = "So luong tra khong duoc vuot qua dong hoa don goc.";
    }
  });

  return errors;
}

export function toReturnCreatePayload(formState: ReturnFormState, products: Product[], invoices: Invoice[]): ReturnInvoiceCreatePayload {
  const productById = new Map(products.map((product) => [String(product.id), product]));
  const sourceInvoice = findSourceInvoice(invoices, formState.sourceInvoiceId);
  const isLinked = formState.returnMode === "linked";
  const customerId = isLinked ? (sourceInvoice?.customer_id ?? null) : formState.customerMode === "customer" ? Number(formState.customerId) : null;
  const customerSnapshotName = isLinked ? (sourceInvoice?.customer_snapshot_name ?? null) : formState.customer_snapshot_name.trim() || null;

  return {
    source_invoice_id: isLinked ? Number(formState.sourceInvoiceId) : null,
    customer_id: customerId,
    customer_snapshot_name: customerSnapshotName,
    return_datetime: new Date(formState.return_datetime).toISOString(),
    handling_mode: formState.handling_mode,
    note: formState.note.trim() || null,
    items: formState.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        product_id: Number(item.productId),
        unit_type: item.unitType || enabledUnitsForProduct(product as Product)[0],
        quantity: item.quantity.trim(),
        unit_price: item.unitPrice.trim(),
        source_invoice_item_id: isLinked && item.sourceInvoiceItemId ? Number(item.sourceInvoiceItemId) : null,
      };
    }),
  };
}

export function applySourceInvoiceItemToReturnItem(
  item: ReturnItemFormState,
  sourceInvoice: Invoice | undefined,
  sourceInvoiceItemId: string,
): ReturnItemFormState {
  const sourceItem = sourceInvoice?.items.find((candidate) => String(candidate.id) === sourceInvoiceItemId);
  if (!sourceItem) {
    return { ...item, sourceInvoiceItemId };
  }
  return {
    ...item,
    sourceInvoiceItemId,
    productId: String(sourceItem.product_id),
    unitType: sourceItem.unit_type,
    unitPrice: sourceItem.unit_price,
  };
}

export function applyProductToReturnItem(item: ReturnItemFormState, product: Product | undefined, productId: string): ReturnItemFormState {
  const defaultUnit = product ? enabledUnitsForProduct(product)[0] ?? "" : "";
  return {
    ...item,
    productId,
    sourceInvoiceItemId: "",
    unitType: defaultUnit,
    unitPrice: product ? defaultPriceForUnit(product, defaultUnit) : "",
  };
}
