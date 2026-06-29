import type { Customer, Invoice, InvoiceCreatePayload, Product, UnitType } from "../../api/types";

export type InvoiceItemFormState = {
  rowId: string;
  productId: string;
  unitType: UnitType | "";
  quantity: string;
  unitPrice: string;
  productCodeSnapshot?: string;
  productNameSnapshot?: string;
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

export type HistoricalCustomerReference = {
  customerId: string;
  customerSnapshotName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

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
      productCodeSnapshot: item.product_code_snapshot,
      productNameSnapshot: item.product_name_snapshot,
    })),
  };
}

export function mergeHistoricalProducts(
  activeProducts: Product[],
  items: InvoiceItemFormState[],
  fallbackCreatedAt?: string | null,
  fallbackUpdatedAt?: string | null,
) {
  const productById = new Map(activeProducts.map((product) => [String(product.id), product]));
  const merged = [...activeProducts];

  for (const item of items) {
    if (!item.productId || productById.has(item.productId)) {
      continue;
    }
    merged.push({
      id: Number(item.productId),
      product_code_base: item.productCodeSnapshot || item.productId,
      product_name: item.productNameSnapshot || item.productId,
      unit_mode: item.unitType === "BICH" ? "BICH" : "BAO_KG",
      is_active: false,
      created_at: fallbackCreatedAt || fallbackUpdatedAt || new Date(0).toISOString(),
      updated_at: fallbackUpdatedAt || fallbackCreatedAt || new Date(0).toISOString(),
      prices: item.unitType ? [{ unit_type: item.unitType, price: item.unitPrice || "0", is_enabled: true }] : [],
      balance: null,
    });
    productById.set(item.productId, merged[merged.length - 1]);
  }

  return merged;
}

export function mergeHistoricalCustomer(activeCustomers: Customer[], reference?: HistoricalCustomerReference | null) {
  if (!reference?.customerId || activeCustomers.some((customer) => String(customer.id) === reference.customerId)) {
    return activeCustomers;
  }

  return [
    ...activeCustomers,
    {
      id: Number(reference.customerId),
      customer_name: reference.customerSnapshotName,
      phone: null,
      address: null,
      note: null,
      current_balance: "0",
      total_sales: "0",
      is_walk_in: false,
      is_active: false,
      created_at: reference.createdAt || reference.updatedAt || new Date(0).toISOString(),
      updated_at: reference.updatedAt || reference.createdAt || new Date(0).toISOString(),
    },
  ];
}

export function isNonNegativeMoney(value: string) {
  return moneyPattern.test(value.trim());
}

export function isPositiveDecimal(value: string) {
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

export function lineEstimateCents(quantity: string, unitPrice: string) {
  const quantityThousandths = parseScaled(quantity, 3);
  const priceCents = parseScaled(unitPrice, 2);
  return (quantityThousandths * priceCents) / 1000n;
}

function lineTotalCents(item: InvoiceItemFormState) {
  return lineEstimateCents(item.quantity, item.unitPrice);
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
    errors.invoice_datetime = "Thời gian hóa đơn là bắt buộc.";
  }
  if (formState.saleMode === "customer" && !formState.customerId) {
    errors.customerId = "Cần chọn khách hàng.";
  }
  if (formState.saleMode === "walk_in" && !formState.customer_snapshot_name.trim()) {
    errors.customer_snapshot_name = "Tên khách lẻ là bắt buộc.";
  }
  if (!isNonNegativeMoney(formState.paid_amount)) {
    errors.paid_amount = "Số tiền đã thanh toán phải là số không âm.";
  }
  if (formState.items.length === 0) {
    errors.items = "Hóa đơn cần ít nhất một dòng hàng.";
  }

  formState.items.forEach((item, index) => {
    const prefix = `items.${index}`;
    const product = productById.get(item.productId);
    if (!product) {
      errors[`${prefix}.productId`] = "Cần chọn hàng hóa.";
    }
    if (!item.unitType && product) {
      errors[`${prefix}.unitType`] = "Cần chọn đơn vị.";
    } else if (product && !isCompatibleUnit(product, item.unitType)) {
      errors[`${prefix}.unitType`] = "Đơn vị không phù hợp với hàng hóa.";
    }
    if (!isPositiveDecimal(item.quantity)) {
      errors[`${prefix}.quantity`] = "Số lượng phải lớn hơn 0.";
    }
    if (!isNonNegativeMoney(item.unitPrice)) {
      errors[`${prefix}.unitPrice`] = "Đơn giá phải là số không âm.";
    }
  });

  const estimatedTotal = estimateInvoiceTotal(formState);
  if (formState.saleMode === "walk_in" && estimatedTotal !== null && isNonNegativeMoney(formState.paid_amount)) {
    const paidCents = parseScaled(formState.paid_amount, 2);
    if (paidCents < estimatedTotal) {
      errors.paid_amount = "Hóa đơn khách lẻ phải thanh toán dư hoặc thanh toán thừa.";
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
