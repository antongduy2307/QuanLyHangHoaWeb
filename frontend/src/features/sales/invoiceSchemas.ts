import type { Invoice, InvoiceCreatePayload, Product, UnitType } from "../../api/types";

export type InvoiceItemFormState = {
  rowId: string;
  productId: string;
  unitType: UnitType | "";
  quantity: string;
  unitPrice: string;
};

export type InvoiceFormState = {
  invoice_datetime: string;
  saleMode: "walk_in" | "customer";
  customerId: string;
  customer_snapshot_name: string;
  paid_amount: string;
  payment_method: string;
  note: string;
  items: InvoiceItemFormState[];
};

export type InvoiceFormErrors = Record<string, string>;

const decimalPattern = /^(?:\d+)(?:\.\d{1,3})?$/;
const moneyPattern = /^(?:\d+)(?:\.\d{1,2})?$/;

export function localDateTimeNow() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export function newInvoiceItem(rowId = crypto.randomUUID()): InvoiceItemFormState {
  return {
    rowId,
    productId: "",
    unitType: "",
    quantity: "1",
    unitPrice: "",
  };
}

export function initialInvoiceFormState(): InvoiceFormState {
  return {
    invoice_datetime: localDateTimeNow(),
    saleMode: "walk_in",
    customerId: "",
    customer_snapshot_name: "Khach le",
    paid_amount: "0",
    payment_method: "",
    note: "",
    items: [newInvoiceItem()],
  };
}

export function invoiceToFormState(invoice: Invoice): InvoiceFormState {
  return {
    invoice_datetime: toLocalDateTimeInput(invoice.invoice_datetime),
    saleMode: invoice.customer_id === null ? "walk_in" : "customer",
    customerId: invoice.customer_id === null ? "" : String(invoice.customer_id),
    customer_snapshot_name: invoice.customer_snapshot_name,
    paid_amount: invoice.paid_amount,
    payment_method: invoice.payment_method ?? "",
    note: invoice.note ?? "",
    items: invoice.items.map((item) => ({
      rowId: `invoice-item-${item.id}`,
      productId: String(item.product_id),
      unitType: item.unit_type,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}

function isNonNegativeMoney(value: string) {
  return moneyPattern.test(value.trim());
}

function isPositiveDecimal(value: string) {
  const normalized = value.trim();
  return decimalPattern.test(normalized) && !/^0(?:\.0{1,3})?$/.test(normalized);
}

function isCompatibleUnit(product: Product, unitType: UnitType | "") {
  if (!unitType) {
    return false;
  }
  return product.unit_mode === "BICH" ? unitType === "BICH" : unitType === "BAO" || unitType === "KG";
}

function parseScaled(value: string, scale: number) {
  const [whole, fraction = ""] = value.trim().split(".");
  const paddedFraction = fraction.padEnd(scale, "0").slice(0, scale);
  return BigInt(whole || "0") * 10n ** BigInt(scale) + BigInt(paddedFraction || "0");
}

function lineTotalCents(item: InvoiceItemFormState) {
  const quantityThousandths = parseScaled(item.quantity, 3);
  const priceCents = parseScaled(item.unitPrice, 2);
  return (quantityThousandths * priceCents) / 1000n;
}

export function estimateInvoiceTotal(formState: InvoiceFormState) {
  if (formState.items.some((item) => !isPositiveDecimal(item.quantity) || !isNonNegativeMoney(item.unitPrice))) {
    return null;
  }
  return formState.items.reduce((total, item) => total + lineTotalCents(item), 0n);
}

export function formatCents(cents: bigint | null) {
  if (cents === null) {
    return "-";
  }
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${sign}${whole.toString()}.${fraction}`;
}

export function enabledUnitsForProduct(product: Product) {
  return product.prices
    .filter((price) => price.is_enabled && isCompatibleUnit(product, price.unit_type))
    .map((price) => price.unit_type);
}

export function defaultPriceForUnit(product: Product, unitType: UnitType | "") {
  return product.prices.find((price) => price.unit_type === unitType && price.is_enabled)?.price ?? "";
}

export function validateInvoiceForm(formState: InvoiceFormState, products: Product[]) {
  const errors: InvoiceFormErrors = {};
  const productById = new Map(products.map((product) => [String(product.id), product]));

  if (!formState.invoice_datetime) {
    errors.invoice_datetime = "Thoi gian hoa don la bat buoc.";
  }
  if (formState.saleMode === "customer" && !formState.customerId) {
    errors.customerId = "Can chon khach hang.";
  }
  if (formState.saleMode === "walk_in" && !formState.customer_snapshot_name.trim()) {
    errors.customer_snapshot_name = "Ten khach le la bat buoc.";
  }
  if (!isNonNegativeMoney(formState.paid_amount)) {
    errors.paid_amount = "So tien da thanh toan phai la so khong am.";
  }
  if (formState.items.length === 0) {
    errors.items = "Hoa don can it nhat mot dong hang.";
  }

  formState.items.forEach((item, index) => {
    const prefix = `items.${index}`;
    const product = productById.get(item.productId);
    if (!product) {
      errors[`${prefix}.productId`] = "Can chon hang hoa.";
      return;
    }
    if (!item.unitType) {
      errors[`${prefix}.unitType`] = "Can chon don vi.";
    } else if (!isCompatibleUnit(product, item.unitType)) {
      errors[`${prefix}.unitType`] = "Don vi khong phu hop voi hang hoa.";
    }
    if (!isPositiveDecimal(item.quantity)) {
      errors[`${prefix}.quantity`] = "So luong phai lon hon 0.";
    }
    if (!isNonNegativeMoney(item.unitPrice)) {
      errors[`${prefix}.unitPrice`] = "Don gia phai la so khong am.";
    }
  });

  const estimatedTotal = estimateInvoiceTotal(formState);
  if (formState.saleMode === "walk_in" && estimatedTotal !== null && isNonNegativeMoney(formState.paid_amount)) {
    const paidCents = parseScaled(formState.paid_amount, 2);
    if (paidCents < estimatedTotal) {
      errors.paid_amount = "Hoa don khach le phai thanh toan du hoac thanh toan thua.";
    }
  }

  return errors;
}

export function toInvoiceCreatePayload(formState: InvoiceFormState, products: Product[]): InvoiceCreatePayload {
  const productById = new Map(products.map((product) => [String(product.id), product]));
  const selectedCustomerId = formState.saleMode === "customer" ? Number(formState.customerId) : null;
  return {
    customer_id: selectedCustomerId,
    customer_snapshot_name: formState.saleMode === "walk_in" ? formState.customer_snapshot_name.trim() : null,
    invoice_datetime: new Date(formState.invoice_datetime).toISOString(),
    paid_amount: formState.paid_amount.trim() || "0",
    payment_method: formState.payment_method || null,
    note: formState.note.trim() || null,
    items: formState.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        product_id: Number(item.productId),
        unit_type: item.unitType || enabledUnitsForProduct(product as Product)[0],
        quantity: item.quantity.trim(),
        unit_price: item.unitPrice.trim(),
      };
    }),
  };
}
