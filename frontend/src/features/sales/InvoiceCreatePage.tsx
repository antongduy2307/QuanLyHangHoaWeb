import { useQueryClient } from "@tanstack/react-query";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { getInvoice } from "../../api/sales";
import type {
  Customer,
  Invoice,
  InvoiceCreatePayload,
  InvoiceItem,
  OrderCreatePayload,
  Product,
  ReturnHandlingMode,
  ReturnInvoice,
  ReturnInvoiceCreatePayload,
  UnitType,
} from "../../api/types";
import { unitLabel } from "../../domain/documents";
import { formatMoney } from "../../domain/money";
import { InventoryModuleShell } from "../inventory/InventoryModuleShell";
import { useProducts } from "../inventory/productQueries";
import { useCustomers } from "../customers/customerQueries";
import { useCreateOrder } from "../orders/orderQueries";
import { useCreateReturn, useReturns } from "../returns/returnQueries";
import { invoiceKeys, useCreateInvoice, useInvoices, useUpdateInvoiceById } from "./invoiceQueries";
import {
  defaultPriceForUnit,
  enabledUnitsForProduct,
  estimateInvoiceTotal,
  formatCents,
  initialInvoiceFormState,
  isNonNegativeMoney,
  isPositiveDecimal,
  lineEstimateCents,
  localDateTimeNow,
  mergeHistoricalCustomer,
  mergeHistoricalProducts,
  toInvoiceCreatePayload,
  toLocalDateTimeInput,
  validateInvoiceForm,
  type InvoiceFormState,
  type InvoiceItemFormState,
} from "./invoiceSchemas";

type PosDraftType = "sale" | "linked_return" | "quick_return" | "order";

type SalePosDraft = InvoiceFormState & {
  id: string;
  type: "sale";
  mode: "create" | "edit";
  invoiceId: number | null;
  invoiceCode: string | null;
  returnTo: string | null;
  returnLabel: string | null;
  detailState: {
    returnTo?: string;
    returnLabel?: string;
    returnState?: unknown;
  } | null;
  sourceOrderId: number | null;
  productSearch: string;
  customerSearch: string;
};

type ReturnLineDraft = {
  rowId: string;
  productId: string;
  sourceInvoiceItemId: string;
  unitType: UnitType | "";
  quantity: string;
  unitPrice: string;
};

type ReturnDraftData = {
  sourceInvoiceSearch: string;
  productSearch: string;
  customerSearch: string;
  sourceInvoiceId: string;
  customerId: string;
  customerSnapshotName: string;
  handlingMode: ReturnHandlingMode;
  returnDatetime: string;
  note: string;
  lines: ReturnLineDraft[];
  errors: Record<string, string>;
};

type ReturnPosDraft = {
  id: string;
  type: "linked_return" | "quick_return";
  data: ReturnDraftData;
};

type OrderLineDraft = {
  rowId: string;
  productId: string;
  unitType: UnitType | "";
  quantity: string;
};

type OrderDraftData = {
  productSearch: string;
  customerSearch: string;
  customerId: string;
  customerSnapshotName: string;
  orderDatetime: string;
  hasRequiredDeliveryDate: boolean;
  requiredDeliveryDatetime: string;
  note: string;
  lines: OrderLineDraft[];
  errors: Record<string, string>;
};

type OrderPosDraft = {
  id: string;
  type: "order";
  data: OrderDraftData;
};

type PosDraft = SalePosDraft | ReturnPosDraft | OrderPosDraft;

type EditInvoiceDraftRouteState = {
  invoiceId: number;
  returnTo?: string;
  returnLabel?: string;
  detailState?: {
    returnTo?: string;
    returnLabel?: string;
    returnState?: unknown;
  };
};

const defaultLineColumnWidths = [5, 5, 12, 26, 12, 12, 14, 14];
const minLineColumnWidths = [4, 4, 8, 16, 9, 9, 10, 10];
const lineColumnLabels = ["STT", "", "Mã hàng", "Tên hàng", "Loại/Đơn vị", "Số lượng", "Đơn giá", "Thành tiền"];

function newSaleDraft(): SalePosDraft {
  const base = initialInvoiceFormState();
  return {
    ...base,
    id: crypto.randomUUID(),
    type: "sale",
    mode: "create",
    invoiceId: null,
    invoiceCode: null,
    returnTo: null,
    returnLabel: null,
    detailState: null,
    sourceOrderId: null,
    items: [],
    productSearch: "",
    customerSearch: "",
  };
}

function newReturnDraft(type: "linked_return" | "quick_return"): ReturnPosDraft {
  return {
    id: crypto.randomUUID(),
    type,
    data: {
      sourceInvoiceSearch: "",
      productSearch: "",
      customerSearch: "",
      sourceInvoiceId: "",
      customerId: "",
      customerSnapshotName: type === "quick_return" ? "Khách lẻ" : "",
      handlingMode: "REFUND_NOW",
      returnDatetime: localDateTimeNow(),
      note: "",
      lines: [],
      errors: {},
    },
  };
}

function newOrderDraft(): OrderPosDraft {
  return {
    id: crypto.randomUUID(),
    type: "order",
    data: {
      productSearch: "",
      customerSearch: "",
      customerId: "",
      customerSnapshotName: "Khách lẻ",
      orderDatetime: localDateTimeNow(),
      hasRequiredDeliveryDate: false,
      requiredDeliveryDatetime: localDateTimeNow(),
      note: "",
      lines: [],
      errors: {},
    },
  };
}

function newDraft(type: PosDraftType = "sale"): PosDraft {
  if (type === "sale") {
    return newSaleDraft();
  }
  if (type === "order") {
    return newOrderDraft();
  }
  return newReturnDraft(type);
}

function draftLabel(draft: PosDraft, drafts: PosDraft[]) {
  const typeIndex = drafts.filter((item) => item.type === draft.type).findIndex((item) => item.id === draft.id) + 1;
  if (draft.type === "sale") {
    if (draft.mode === "edit" && draft.invoiceCode) {
      return `Sửa ${draft.invoiceCode}`;
    }
    return `Bán hàng ${typeIndex}`;
  }
  if (draft.type === "linked_return") {
    return `Trả hàng theo hóa đơn ${typeIndex}`;
  }
  if (draft.type === "order") {
    return `Đặt hàng ${typeIndex}`;
  }
  return `Trả hàng nhanh ${typeIndex}`;
}

function isSaleDraft(draft: PosDraft | null | undefined): draft is SalePosDraft {
  return draft?.type === "sale";
}

function isReturnDraft(draft: PosDraft | null | undefined): draft is ReturnPosDraft {
  return draft?.type === "linked_return" || draft?.type === "quick_return";
}

function isOrderDraft(draft: PosDraft | null | undefined): draft is OrderPosDraft {
  return draft?.type === "order";
}

function isPristineCreateSaleDraft(draft: PosDraft | undefined): draft is SalePosDraft {
  return Boolean(
    draft
    && isSaleDraft(draft)
    && draft.mode === "create"
    && draft.sourceOrderId === null
    && draft.invoiceId === null
    && draft.invoiceCode === null
    && draft.customerId === ""
    && draft.paid_amount === "0"
    && draft.note === ""
    && draft.items.length === 0,
  );
}

function decimalAddOne(value: string) {
  const numericValue = Number(value || "0");
  if (!Number.isFinite(numericValue)) {
    return "1";
  }
  return String(numericValue + 1);
}

function moneyDifference(left: string, right: string) {
  const leftCents = Math.round(Number(left || "0") * 100);
  const rightCents = Math.round(Number(right || "0") * 100);
  if (!Number.isFinite(leftCents) || !Number.isFinite(rightCents)) {
    return null;
  }
  return BigInt(leftCents - rightCents);
}

function customerLabel(customer: Customer) {
  return customer.phone ? `${customer.customer_name} - ${customer.phone}` : customer.customer_name;
}

function productMatchesName(product: Product, search: string) {
  return product.product_name.toLowerCase().includes(search.trim().toLowerCase());
}

function preferredUnitForProduct(product: Product): UnitType | "" {
  const enabledUnits = enabledUnitsForProduct(product);
  if (product.unit_mode === "BAO_KG") {
    if (enabledUnits.includes("BAO")) {
      return "BAO";
    }
    if (enabledUnits.includes("KG")) {
      return "KG";
    }
  }
  return enabledUnits[0] ?? "";
}

function lineTotalLabel(item: InvoiceItemFormState) {
  if (!isPositiveDecimal(item.quantity) || !isNonNegativeMoney(item.unitPrice)) {
    return "-";
  }
  return formatMoney(formatCents(lineEstimateCents(item.quantity, item.unitPrice)));
}

function returnLineTotalLabel(line: ReturnLineDraft) {
  if (!isPositiveDecimal(line.quantity) || !isNonNegativeMoney(line.unitPrice)) {
    return "-";
  }
  return formatMoney(formatCents(lineEstimateCents(line.quantity, line.unitPrice)));
}

function estimateReturnLinesTotal(lines: ReturnLineDraft[]) {
  if (lines.some((line) => !isPositiveDecimal(line.quantity) || !isNonNegativeMoney(line.unitPrice))) {
    return null;
  }
  return lines.reduce((total, line) => total + lineEstimateCents(line.quantity, line.unitPrice), 0n);
}

function validateOrderDraft(draft: OrderPosDraft, products: Product[]) {
  const errors: Record<string, string> = {};
  const productLookup = new Map(products.map((product) => [String(product.id), product]));

  if (!draft.data.orderDatetime) {
    errors.orderDatetime = "Thời gian đặt hàng là bắt buộc.";
  }
  if (draft.data.hasRequiredDeliveryDate && !draft.data.requiredDeliveryDatetime) {
    errors.requiredDeliveryDatetime = "Ngày cần giao là bắt buộc.";
  }
  if (draft.data.lines.length === 0) {
    errors.items = "Đơn đặt hàng cần ít nhất một mặt hàng.";
  }

  draft.data.lines.forEach((line, index) => {
    const prefix = `lines.${index}`;
    const product = productLookup.get(line.productId);
    if (!product) {
      errors[`${prefix}.productId`] = "Cần chọn hàng hóa.";
    }
    if (!line.unitType) {
      errors[`${prefix}.unitType`] = "Cần chọn đơn vị.";
    }
    if (!isPositiveDecimal(line.quantity)) {
      errors[`${prefix}.quantity`] = "Số lượng phải lớn hơn 0.";
    }
  });

  return errors;
}

function buildOrderPayload(draft: OrderPosDraft): OrderCreatePayload {
  return {
    customer_id: draft.data.customerId ? Number(draft.data.customerId) : null,
    customer_snapshot_name: draft.data.customerId ? null : draft.data.customerSnapshotName.trim() || "Khách lẻ",
    order_datetime: new Date(draft.data.orderDatetime).toISOString(),
    required_delivery_datetime:
      draft.data.hasRequiredDeliveryDate && draft.data.requiredDeliveryDatetime
        ? new Date(draft.data.requiredDeliveryDatetime).toISOString()
        : null,
    note: draft.data.note.trim() || null,
    items: draft.data.lines
      .filter((line) => line.productId && line.unitType && isPositiveDecimal(line.quantity))
      .map((line) => ({
        product_id: Number(line.productId),
        unit_type: line.unitType as UnitType,
        quantity: line.quantity.trim(),
      })),
  };
}

function parseDecimal(value: string) {
  const numericValue = Number(value || "0");
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number(value.toFixed(3)).toString();
}

function returnedQuantityForItem(returns: ReturnInvoice[], sourceInvoiceId: string, sourceInvoiceItemId: number) {
  return returns
    .filter((returnInvoice) => String(returnInvoice.source_invoice_id ?? "") === sourceInvoiceId)
    .flatMap((returnInvoice) => returnInvoice.items)
    .filter((item) => item.source_invoice_item_id === sourceInvoiceItemId)
    .reduce((total, item) => total + parseDecimal(item.quantity), 0);
}

function remainingQuantityForItem(sourceItem: InvoiceItem, returns: ReturnInvoice[], sourceInvoiceId: string) {
  return Math.max(0, parseDecimal(sourceItem.quantity) - returnedQuantityForItem(returns, sourceInvoiceId, sourceItem.id));
}

function returnUnitChoices(product: Product | undefined, fallbackUnit?: UnitType) {
  const choices = product ? enabledUnitsForProduct(product) : [];
  if (choices.length > 0) {
    return choices;
  }
  return fallbackUnit ? [fallbackUnit] : [];
}

function validateReturnDraft(draft: ReturnPosDraft, products: Product[], invoices: Invoice[], returns: ReturnInvoice[]) {
  const errors: Record<string, string> = {};
  const sourceInvoice = invoices.find((invoice) => String(invoice.id) === draft.data.sourceInvoiceId);

  if (!draft.data.returnDatetime) {
    errors.returnDatetime = "Thời gian trả hàng là bắt buộc.";
  }
  if (draft.type === "linked_return" && !sourceInvoice) {
    errors.sourceInvoiceId = "Cần chọn hóa đơn gốc.";
  }
  if (!draft.data.lines.some((line) => isPositiveDecimal(line.quantity))) {
    errors.items = "Phiếu trả cần ít nhất một mặt hàng.";
  }
  if (draft.type === "quick_return" && !draft.data.customerId && draft.data.handlingMode === "STORE_CREDIT") {
    errors.handlingMode = "Phiếu trả khách lẻ chỉ được hoàn tiền ngay.";
  }
  if (draft.type === "linked_return" && sourceInvoice?.customer_id === null && draft.data.handlingMode === "STORE_CREDIT") {
    errors.handlingMode = "Hóa đơn khách lẻ chỉ được hoàn tiền ngay.";
  }

  const productById = new Map(products.map((product) => [String(product.id), product]));
  draft.data.lines.forEach((line, index) => {
    const prefix = `lines.${index}`;
    if (!isPositiveDecimal(line.quantity)) {
      if (line.quantity.trim()) {
        errors[`${prefix}.quantity`] = "Số lượng phải lớn hơn 0.";
      }
      return;
    }
    if (!line.productId || !productById.get(line.productId)) {
      errors[`${prefix}.productId`] = "Cần chọn hàng hóa.";
    }
    if (!line.unitType) {
      errors[`${prefix}.unitType`] = "Cần chọn đơn vị.";
    }
    if (!isNonNegativeMoney(line.unitPrice)) {
      errors[`${prefix}.unitPrice`] = "Đơn giá phải là số không âm.";
    }
    if (draft.type === "linked_return" && sourceInvoice) {
      const sourceItem = sourceInvoice.items.find((item) => String(item.id) === line.sourceInvoiceItemId);
      if (!sourceItem) {
        errors[`${prefix}.sourceInvoiceItemId`] = "Cần chọn dòng hóa đơn gốc.";
      } else if (parseDecimal(line.quantity) > remainingQuantityForItem(sourceItem, returns, draft.data.sourceInvoiceId)) {
        errors[`${prefix}.quantity`] = "Số lượng trả không được vượt quá số lượng còn lại.";
      }
    }
  });

  return errors;
}

function buildReturnPayload(draft: ReturnPosDraft, invoices: Invoice[]): ReturnInvoiceCreatePayload {
  const sourceInvoice = invoices.find((invoice) => String(invoice.id) === draft.data.sourceInvoiceId);
  const linked = draft.type === "linked_return";
  return {
    source_invoice_id: linked && sourceInvoice ? sourceInvoice.id : null,
    customer_id: linked ? (sourceInvoice?.customer_id ?? null) : draft.data.customerId ? Number(draft.data.customerId) : null,
    customer_snapshot_name: linked ? (sourceInvoice?.customer_snapshot_name ?? null) : draft.data.customerSnapshotName.trim() || "Khách lẻ",
    return_datetime: new Date(draft.data.returnDatetime).toISOString(),
    handling_mode: draft.data.handlingMode,
    note: draft.data.note.trim() || null,
    items: draft.data.lines
      .filter((line) => isPositiveDecimal(line.quantity))
      .map((line) => ({
        product_id: Number(line.productId),
        unit_type: line.unitType as UnitType,
        quantity: line.quantity.trim(),
        unit_price: line.unitPrice.trim(),
        source_invoice_item_id: linked ? Number(line.sourceInvoiceItemId) : null,
      })),
  };
}

function buildPayload(draft: SalePosDraft, products: Product[]): InvoiceCreatePayload {
  const payload = toInvoiceCreatePayload(
    {
      ...draft,
      saleMode: draft.customerId ? "customer" : "walk_in",
      customer_snapshot_name: draft.customerId ? "" : draft.customer_snapshot_name || "Khách lẻ",
      payment_method: "",
    },
    products,
  );
  return {
    ...payload,
    source_order_id: draft.sourceOrderId,
  };
}

type SourceOrderDraftState = {
  sourceOrderId: number;
  customerId: string;
  customerSnapshotName: string;
  note: string;
  items: Array<{
    productId: string;
    unitType: UnitType;
    quantity: string;
    unitPrice: string;
  }>;
};

type InvoiceCreateLocationState = {
  sourceOrderDraft?: SourceOrderDraftState;
  editInvoiceDraft?: EditInvoiceDraftRouteState;
};

function applySourceOrderDraftState(orderDraft: SourceOrderDraftState): SalePosDraft {
  return {
    ...newSaleDraft(),
    sourceOrderId: orderDraft.sourceOrderId,
    customerId: orderDraft.customerId,
    customer_snapshot_name: orderDraft.customerId ? orderDraft.customerSnapshotName : orderDraft.customerSnapshotName || "Khách lẻ",
    customerSearch: "",
    note: orderDraft.note,
    items: orderDraft.items.map((item) => ({
        rowId: crypto.randomUUID(),
        productId: item.productId,
        unitType: item.unitType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
  };
}

function applyEditInvoiceDraftState(
  invoice: Invoice,
  routeState?: EditInvoiceDraftRouteState | null,
): SalePosDraft {
  return {
    ...newSaleDraft(),
    mode: "edit",
    invoiceId: invoice.id,
    invoiceCode: invoice.invoice_code,
    returnTo: routeState?.returnTo ?? null,
    returnLabel: routeState?.returnLabel ?? null,
    detailState: routeState?.detailState ?? null,
    saleMode: invoice.customer_id === null ? "walk_in" : "customer",
    customerId: invoice.customer_id === null ? "" : String(invoice.customer_id),
    customer_snapshot_name: invoice.customer_snapshot_name,
    invoice_datetime: toLocalDateTimeInput(invoice.invoice_datetime),
    paid_amount: invoice.paid_amount,
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

export function InvoiceCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locationState = location.state as InvoiceCreateLocationState | null;
  const sourceOrderDraftState = locationState?.sourceOrderDraft ?? null;
  const editInvoiceDraftState = locationState?.editInvoiceDraft ?? null;
  const isEditHydrationRoute = Boolean(editInvoiceDraftState?.invoiceId);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoiceById();
  const createReturn = useCreateReturn();
  const createOrder = useCreateOrder();
  const productsQuery = useProducts("");
  const customersQuery = useCustomers("", false);
  const invoicesQuery = useInvoices();
  const returnsQuery = useReturns();
  const [drafts, setDrafts] = useState<PosDraft[]>(() =>
    isEditHydrationRoute ? [] : [sourceOrderDraftState ? applySourceOrderDraftState(sourceOrderDraftState) : newDraft()],
  );
  const [activeDraftId, setActiveDraftId] = useState<string | null>(() => (isEditHydrationRoute ? null : drafts[0]?.id ?? null));
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const pendingEditInvoiceIdRef = useRef<number | null>(null);
  const handledEditRequestKeyRef = useRef<string | null>(null);
  const draftsRef = useRef<PosDraft[]>(drafts);
  const [editHydrationError, setEditHydrationError] = useState<string | null>(null);
  const [editHydrationVersion, setEditHydrationVersion] = useState(0);
  const [lineColumnWidths, setLineColumnWidths] = useState(defaultLineColumnWidths);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const activeProducts = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const activeCustomers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);
  const returns = useMemo(() => returnsQuery.data ?? [], [returnsQuery.data]);
  const products = useMemo(
    () =>
      drafts.reduce(
        (merged, draft) =>
          isSaleDraft(draft) && draft.mode === "edit"
            ? mergeHistoricalProducts(merged, draft.items, undefined, undefined)
            : merged,
        activeProducts,
      ),
    [activeProducts, drafts],
  );
  const customers = useMemo(
    () =>
      drafts.reduce(
        (merged, draft) =>
          isSaleDraft(draft) && draft.mode === "edit" && draft.customerId
            ? mergeHistoricalCustomer(merged, { customerId: draft.customerId, customerSnapshotName: draft.customer_snapshot_name })
            : merged,
        activeCustomers,
      ),
    [activeCustomers, drafts],
  );
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const activeDraft = (activeDraftId ? drafts.find((draft) => draft.id === activeDraftId) : null) ?? drafts[0] ?? null;
  const activeSaleDraft = isSaleDraft(activeDraft) ? activeDraft : null;
  const activeReturnDraft = isReturnDraft(activeDraft) ? activeDraft : null;
  const activeOrderDraft = isOrderDraft(activeDraft) ? activeDraft : null;
  const activeSourceInvoice = activeReturnDraft?.data.sourceInvoiceId
    ? invoices.find((invoice) => String(invoice.id) === activeReturnDraft.data.sourceInvoiceId) ?? null
    : null;
  const selectedReturnCustomer = activeReturnDraft?.data.customerId
    ? customers.find((customer) => String(customer.id) === activeReturnDraft.data.customerId) ?? null
    : null;
  const selectedOrderCustomer = activeOrderDraft?.data.customerId
    ? customers.find((customer) => String(customer.id) === activeOrderDraft.data.customerId) ?? null
    : null;
  const selectedCustomer = activeSaleDraft
    ? customers.find((customer) => String(customer.id) === activeSaleDraft.customerId) ?? null
    : null;
  const estimatedTotal = activeSaleDraft ? estimateInvoiceTotal(activeSaleDraft) : 0n;
  const estimatedTotalText = formatCents(estimatedTotal);
  const paymentDelta = activeSaleDraft ? moneyDifference(activeSaleDraft.paid_amount, estimatedTotalText === "-" ? "0" : estimatedTotalText) : 0n;
  const lineGridStyle = { "--sales-line-columns": lineColumnWidths.map((width) => `${width}fr`).join(" ") } as CSSProperties;
  const visibleProducts = activeSaleDraft?.productSearch.trim()
    ? activeProducts.filter((product) => productMatchesName(product, activeSaleDraft.productSearch)).slice(0, 8)
    : [];
  const visibleCustomers = activeSaleDraft?.customerSearch.trim()
    ? activeCustomers
        .filter((customer) => {
          const search = activeSaleDraft.customerSearch.trim().toLowerCase();
          return customer.customer_name.toLowerCase().includes(search) || (customer.phone ?? "").includes(search);
        })
        .slice(0, 8)
    : [];
  const visibleSourceInvoices = activeReturnDraft?.type === "linked_return" && activeReturnDraft.data.sourceInvoiceSearch.trim()
    ? invoices
        .filter((invoice) => invoice.invoice_code.toLowerCase().includes(activeReturnDraft.data.sourceInvoiceSearch.trim().toLowerCase()))
        .slice(0, 8)
    : [];
  const visibleReturnProducts = activeReturnDraft?.type === "quick_return" && activeReturnDraft.data.productSearch.trim()
    ? activeProducts.filter((product) => productMatchesName(product, activeReturnDraft.data.productSearch)).slice(0, 8)
    : [];
  const visibleReturnCustomers = activeReturnDraft?.type === "quick_return" && activeReturnDraft.data.customerSearch.trim()
    ? activeCustomers
        .filter((customer) => {
          const search = activeReturnDraft.data.customerSearch.trim().toLowerCase();
          return customer.customer_name.toLowerCase().includes(search) || (customer.phone ?? "").includes(search);
        })
        .slice(0, 8)
    : [];
  const visibleOrderProducts = activeOrderDraft?.data.productSearch.trim()
    ? activeProducts.filter((product) => productMatchesName(product, activeOrderDraft.data.productSearch)).slice(0, 8)
    : [];
  const visibleOrderCustomers = activeOrderDraft?.data.customerSearch.trim()
    ? activeCustomers
        .filter((customer) => {
          const search = activeOrderDraft.data.customerSearch.trim().toLowerCase();
          return customer.customer_name.toLowerCase().includes(search) || (customer.phone ?? "").includes(search);
        })
        .slice(0, 8)
    : [];

  function updateSaleDraft(updater: (draft: SalePosDraft) => SalePosDraft) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === activeDraft.id && isSaleDraft(draft) ? updater(draft) : draft)),
    );
  }

  function updateReturnDraft(updater: (draft: ReturnPosDraft) => ReturnPosDraft) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === activeDraft.id && isReturnDraft(draft) ? updater(draft) : draft)),
    );
  }

  function updateOrderDraft(updater: (draft: OrderPosDraft) => OrderPosDraft) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === activeDraft.id && isOrderDraft(draft) ? updater(draft) : draft)),
    );
  }

  function resetErrors() {
    setFieldErrors({});
    setFeedback(null);
  }

  function retryEditHydration() {
    handledEditRequestKeyRef.current = null;
    pendingEditInvoiceIdRef.current = null;
        setEditHydrationVersion((current) => current + 1);
  }

  useEffect(() => {
    if (!editInvoiceDraftState?.invoiceId || pendingEditInvoiceIdRef.current === editInvoiceDraftState.invoiceId) {
      return;
    }
    const requestKey = JSON.stringify(editInvoiceDraftState);
    if (handledEditRequestKeyRef.current === requestKey) {
      return;
    }

    const existingDraft = drafts.find(
      (draft) => isSaleDraft(draft) && draft.mode === "edit" && draft.invoiceId === editInvoiceDraftState.invoiceId,
    );
    if (existingDraft) {
      queueMicrotask(() => {
        handledEditRequestKeyRef.current = requestKey;
                setActiveDraftId(existingDraft.id);
      });
      return;
    }

    let cancelled = false;
    pendingEditInvoiceIdRef.current = editInvoiceDraftState.invoiceId;
    
    void queryClient
      .fetchQuery({
        queryKey: invoiceKeys.detail(editInvoiceDraftState.invoiceId),
        queryFn: () => getInvoice(editInvoiceDraftState.invoiceId),
      })
      .then((invoice) => {
        if (cancelled) {
          return;
        }
        const nextDraft = applyEditInvoiceDraftState(invoice, editInvoiceDraftState);
        const currentDrafts = draftsRef.current;
        const existingEditDraft = currentDrafts.find(
          (candidate) => isSaleDraft(candidate) && candidate.mode === "edit" && candidate.invoiceId === invoice.id,
        );

        if (existingEditDraft) {
          setDrafts(
            currentDrafts.map((candidate) =>
              candidate.id === existingEditDraft.id && isSaleDraft(candidate)
                ? {
                    ...candidate,
                    ...nextDraft,
                    id: existingEditDraft.id,
                  }
                : candidate,
            ),
          );
          setActiveDraftId(existingEditDraft.id);
        } else if (currentDrafts.length === 1 && isPristineCreateSaleDraft(currentDrafts[0])) {
          setDrafts([nextDraft]);
          setActiveDraftId(nextDraft.id);
        } else {
          setDrafts([...currentDrafts, nextDraft]);
          setActiveDraftId(nextDraft.id);
        }
        handledEditRequestKeyRef.current = requestKey;
        resetErrors();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setEditHydrationError(isApiError(error) ? error.message : "Không thể tải hóa đơn để mở tab sửa.");
      })
      .finally(() => {
        if (!cancelled && pendingEditInvoiceIdRef.current === editInvoiceDraftState.invoiceId) {
          pendingEditInvoiceIdRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [drafts, editHydrationVersion, editInvoiceDraftState, queryClient]);

  function addDraft(type: PosDraftType) {
    const draft = newDraft(type);
    setDrafts((current) => [...current, draft]);
    setActiveDraftId(draft.id);
    setIsAddMenuOpen(false);
    resetErrors();
  }

  function closeDraft(draftId: string) {
    setDrafts((current) => {
      const closingIndex = current.findIndex((draft) => draft.id === draftId);
      if (current.length === 1) {
        const draft = newDraft();
        setActiveDraftId(draft.id);
        return [draft];
      }
      const next = current.filter((draft) => draft.id !== draftId);
      if (draftId === activeDraftId) {
        const nextActiveIndex = Math.min(Math.max(closingIndex, 0), next.length - 1);
        setActiveDraftId(next[nextActiveIndex].id);
      }
      return next;
    });
    resetErrors();
  }

  function cancelEditDraft(draft: SalePosDraft) {
    if (draft.returnTo) {
      navigate(draft.returnTo, { state: draft.detailState ?? undefined });
      return;
    }
    closeDraft(draft.id);
  }

  function selectProduct(product: Product) {
    if (!activeSaleDraft) {
      return;
    }
    const unitType = preferredUnitForProduct(product);
    if (!unitType) {
      return;
    }
    updateSaleDraft((draft) => {
      const existingItem = draft.items.find((item) => item.productId === String(product.id) && item.unitType === unitType);
      if (existingItem) {
        return {
          ...draft,
          productSearch: "",
          items: draft.items.map((item) => (item.rowId === existingItem.rowId ? { ...item, quantity: decimalAddOne(item.quantity) } : item)),
        };
      }
      return {
        ...draft,
        productSearch: "",
        items: [
          ...draft.items,
          {
            rowId: crypto.randomUUID(),
            productId: String(product.id),
            unitType,
            quantity: "1",
            unitPrice: defaultPriceForUnit(product, unitType),
          },
        ],
      };
    });
    resetErrors();
  }

  function selectCustomer(customer: Customer) {
    updateSaleDraft((draft) => ({
      ...draft,
      saleMode: "customer",
      customerId: String(customer.id),
      customer_snapshot_name: customer.customer_name,
      customerSearch: customerLabel(customer),
    }));
    resetErrors();
  }

  function selectReturnCustomer(customer: Customer) {
    updateReturnDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        customerId: String(customer.id),
        customerSnapshotName: customer.customer_name,
        customerSearch: customerLabel(customer),
        errors: {},
      },
    }));
    resetErrors();
  }

  function clearReturnCustomer() {
    updateReturnDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        customerId: "",
        customerSnapshotName: "Khách lẻ",
        customerSearch: "",
        handlingMode: "REFUND_NOW",
        errors: {},
      },
    }));
    resetErrors();
  }

  function selectSourceInvoice(invoice: Invoice) {
    updateReturnDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        sourceInvoiceId: String(invoice.id),
        sourceInvoiceSearch: invoice.invoice_code,
        customerId: invoice.customer_id ? String(invoice.customer_id) : "",
        customerSnapshotName: invoice.customer_snapshot_name,
        handlingMode: invoice.customer_id ? draft.data.handlingMode : "REFUND_NOW",
        lines: invoice.items.map((item) => ({
          rowId: `source-${invoice.id}-${item.id}`,
          productId: String(item.product_id),
          sourceInvoiceItemId: String(item.id),
          unitType: item.unit_type,
          quantity: "",
          unitPrice: item.unit_price,
        })),
        errors: {},
      },
    }));
    resetErrors();
  }

  function addQuickReturnProduct(product: Product) {
    const unitType = preferredUnitForProduct(product);
    if (!unitType) {
      return;
    }
    updateReturnDraft((draft) => {
      const existingLine = draft.data.lines.find((line) => line.productId === String(product.id) && line.unitType === unitType);
      if (existingLine) {
        return {
          ...draft,
          data: {
            ...draft.data,
            productSearch: "",
            errors: {},
            lines: draft.data.lines.map((line) =>
              line.rowId === existingLine.rowId ? { ...line, quantity: decimalAddOne(line.quantity) } : line,
            ),
          },
        };
      }
      return {
        ...draft,
        data: {
          ...draft.data,
          productSearch: "",
          errors: {},
          lines: [
            ...draft.data.lines,
            {
              rowId: crypto.randomUUID(),
              productId: String(product.id),
              sourceInvoiceItemId: "",
              unitType,
              quantity: "1",
              unitPrice: defaultPriceForUnit(product, unitType),
            },
          ],
        },
      };
    });
    resetErrors();
  }

  function selectOrderCustomer(customer: Customer) {
    updateOrderDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        customerId: String(customer.id),
        customerSnapshotName: customer.customer_name,
        customerSearch: customerLabel(customer),
        errors: {},
      },
    }));
    resetErrors();
  }

  function clearOrderCustomer() {
    updateOrderDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        customerId: "",
        customerSnapshotName: "Khách lẻ",
        customerSearch: "",
        errors: {},
      },
    }));
    resetErrors();
  }

  function addOrderProduct(product: Product) {
    const unitType = preferredUnitForProduct(product);
    if (!unitType) {
      return;
    }
    updateOrderDraft((draft) => {
      const existingLine = draft.data.lines.find((line) => line.productId === String(product.id) && line.unitType === unitType);
      if (existingLine) {
        return {
          ...draft,
          data: {
            ...draft.data,
            productSearch: "",
            errors: {},
            lines: draft.data.lines.map((line) =>
              line.rowId === existingLine.rowId ? { ...line, quantity: decimalAddOne(line.quantity) } : line,
            ),
          },
        };
      }
      return {
        ...draft,
        data: {
          ...draft.data,
          productSearch: "",
          errors: {},
          lines: [
            ...draft.data.lines,
            {
              rowId: crypto.randomUUID(),
              productId: String(product.id),
              unitType,
              quantity: "1",
            },
          ],
        },
      };
    });
    resetErrors();
  }

  function updateOrderLine(rowId: string, updater: (line: OrderLineDraft) => OrderLineDraft) {
    updateOrderDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        lines: draft.data.lines.map((line) => (line.rowId === rowId ? updater(line) : line)),
      },
    }));
  }

  function updateReturnLine(rowId: string, updater: (line: ReturnLineDraft) => ReturnLineDraft) {
    updateReturnDraft((draft) => ({
      ...draft,
      data: {
        ...draft.data,
        lines: draft.data.lines.map((line) => (line.rowId === rowId ? updater(line) : line)),
      },
    }));
  }

  function updateReturnLineUnit(line: ReturnLineDraft, unitType: UnitType) {
    const product = productById.get(line.productId);
    updateReturnLine(line.rowId, (current) => ({
      ...current,
      unitType,
      unitPrice: product ? defaultPriceForUnit(product, unitType) : current.unitPrice,
    }));
  }

  function clearCustomer() {
    updateSaleDraft((draft) => ({
      ...draft,
      saleMode: "walk_in",
      customerId: "",
      customer_snapshot_name: "Khách lẻ",
      customerSearch: "",
    }));
    resetErrors();
  }

  function updateItem(rowId: string, updater: (item: InvoiceItemFormState) => InvoiceItemFormState) {
    updateSaleDraft((draft) => ({
      ...draft,
      items: draft.items.map((item) => (item.rowId === rowId ? updater(item) : item)),
    }));
  }

  function updateItemUnit(item: InvoiceItemFormState, unitType: UnitType) {
    const product = productById.get(item.productId);
    updateItem(item.rowId, (current) => ({
      ...current,
      unitType,
      unitPrice: product ? defaultPriceForUnit(product, unitType) : current.unitPrice,
    }));
  }

  function startColumnResize(index: number, event: PointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    const table = event.currentTarget.closest(".sales-line-grid");
    const tableWidth = table?.getBoundingClientRect().width || 1;
    const startX = event.clientX;
    const startWidths = [...lineColumnWidths];

    function applyResize(moveEvent: globalThis.PointerEvent) {
      const deltaPercent = ((moveEvent.clientX - startX) / tableWidth) * 100;
      const currentMin = minLineColumnWidths[index];
      const nextMin = minLineColumnWidths[index + 1];
      const pairTotal = startWidths[index] + startWidths[index + 1];
      const nextWidth = Math.max(nextMin, Math.min(pairTotal - currentMin, startWidths[index + 1] - deltaPercent));
      const currentWidth = pairTotal - nextWidth;
      setLineColumnWidths((current) =>
        current.map((width, columnIndex) => {
          if (columnIndex === index) {
            return currentWidth;
          }
          if (columnIndex === index + 1) {
            return nextWidth;
          }
          return width;
        }),
      );
    }

    function stopResize() {
      window.removeEventListener("pointermove", applyResize);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", applyResize);
    window.addEventListener("pointerup", stopResize);
  }

  function preventEnterSubmit(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
  }

  async function handlePayment() {
    if (!activeSaleDraft) {
      return;
    }
    setFeedback(null);
    const validationState: InvoiceFormState = {
      ...activeSaleDraft,
      saleMode: activeSaleDraft.customerId ? "customer" : "walk_in",
      customer_snapshot_name: activeSaleDraft.customerId ? activeSaleDraft.customer_snapshot_name : activeSaleDraft.customer_snapshot_name || "Khách lẻ",
      payment_method: "",
    };
    const errors = validateInvoiceForm(validationState, products);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const payload = buildPayload(activeSaleDraft, products);
      if (activeSaleDraft.mode === "edit" && activeSaleDraft.invoiceId) {
        const invoice = await updateInvoice.mutateAsync({ invoiceId: activeSaleDraft.invoiceId, payload });
        setFeedback({ type: "success", message: "Đã cập nhật hóa đơn." });
        navigate(activeSaleDraft.returnTo || `/sales/invoices/${invoice.id}`, {
          state: { invoiceMessage: "Đã cập nhật hóa đơn.", ...(activeSaleDraft.detailState ?? {}) },
        });
        return;
      }

      await createInvoice.mutateAsync(payload);
      const freshDraft = newDraft();
      setDrafts([freshDraft]);
      setActiveDraftId(freshDraft.id);
      setFeedback({ type: "success", message: "Đã thanh toán hóa đơn." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          isApiError(error)
            ? error.message
            : activeSaleDraft.mode === "edit"
              ? "Không thể cập nhật hóa đơn."
              : "Không thể thanh toán hóa đơn.",
      });
    }
  }

  async function handleReturnSubmit() {
    if (!activeReturnDraft) {
      return;
    }
    setFeedback(null);
    const errors = validateReturnDraft(activeReturnDraft, products, invoices, returns);
    updateReturnDraft((draft) => ({ ...draft, data: { ...draft.data, errors } }));
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await createReturn.mutateAsync(buildReturnPayload(activeReturnDraft, invoices));
      const freshDraft = newDraft(activeReturnDraft.type);
      setDrafts((current) => current.map((draft) => (draft.id === activeReturnDraft.id ? freshDraft : draft)));
      setActiveDraftId(freshDraft.id);
      setFeedback({ type: "success", message: "Đã tạo phiếu trả hàng." });
    } catch (error) {
      setFeedback({ type: "error", message: isApiError(error) ? error.message : "Không thể tạo phiếu trả hàng." });
    }
  }

  async function handleOrderSubmit() {
    if (!activeOrderDraft) {
      return;
    }
    setFeedback(null);
    const errors = validateOrderDraft(activeOrderDraft, products);
    updateOrderDraft((draft) => ({ ...draft, data: { ...draft.data, errors } }));
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await createOrder.mutateAsync(buildOrderPayload(activeOrderDraft));
      const freshDraft = newDraft("order");
      setDrafts((current) => current.map((draft) => (draft.id === activeOrderDraft.id ? freshDraft : draft)));
      setActiveDraftId(freshDraft.id);
      setFeedback({ type: "success", message: "Đã lưu đơn đặt hàng." });
    } catch (error) {
      setFeedback({ type: "error", message: isApiError(error) ? error.message : "Không thể lưu đơn đặt hàng." });
    }
  }

  if (productsQuery.isLoading || customersQuery.isLoading || invoicesQuery.isLoading || returnsQuery.isLoading) {
    return (
      <InventoryModuleShell title="Bán hàng" description="" contentClassName="sales-pos-shell" hideDescription hideHero>
        <p className="state-message">Đang tải dữ liệu bán hàng...</p>
      </InventoryModuleShell>
    );
  }

  if (productsQuery.isError || customersQuery.isError || invoicesQuery.isError || returnsQuery.isError) {
    return (
      <InventoryModuleShell title="Bán hàng" description="" contentClassName="sales-pos-shell" hideDescription hideHero>
        <p className="state-message error-message">Không thể tải hàng hóa hoặc khách hàng.</p>
      </InventoryModuleShell>
    );
  }

  if (!activeDraft) {
    return (
      <InventoryModuleShell title="Bán hàng" description="" contentClassName="sales-pos-shell" hideDescription hideHero>
        <p className={editHydrationError ? "state-message error-message" : "state-message"}>
          {editHydrationError || "Đang tải hóa đơn cần sửa..."}
        </p>
        {isEditHydrationRoute ? (
          <div className="row-actions">
            <button type="button" onClick={retryEditHydration}>
              Thử lại
            </button>
            <Link
              className="inventory-ghost-button"
              to={editInvoiceDraftState?.returnTo || "/sales/invoices"}
              state={editInvoiceDraftState?.detailState ?? undefined}
            >
              {editInvoiceDraftState?.returnLabel || "Quay lại"}
            </Link>
          </div>
        ) : null}
      </InventoryModuleShell>
    );
  }

  return (
    <InventoryModuleShell title="Bán hàng" description="" contentClassName="sales-pos-shell" hideDescription hideHero>
      <form
        className="sales-pos"
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={preventEnterSubmit}
        onKeyDownCapture={preventEnterSubmit}
      >
        <section className="sales-pos-main" aria-label="Khu vực lập hóa đơn">
          <div className="sales-pos-search-row">
            <div className="sales-product-search">
              {activeSaleDraft ? (
                <input
                  aria-label="Tìm hàng hóa"
                  placeholder="Tìm hàng hóa"
                  value={activeSaleDraft.productSearch}
                  onChange={(event) => updateSaleDraft((draft) => ({ ...draft, productSearch: event.target.value }))}
                />
              ) : activeReturnDraft?.type === "linked_return" ? (
                <input
                  aria-label="Nhập mã hóa đơn nguồn"
                  placeholder="Nhập mã hóa đơn nguồn"
                  value={activeReturnDraft.data.sourceInvoiceSearch}
                  onChange={(event) =>
                    updateReturnDraft((draft) => ({
                      ...draft,
                      data: { ...draft.data, sourceInvoiceSearch: event.target.value },
                    }))
                  }
                />
              ) : activeReturnDraft?.type === "quick_return" ? (
                <input
                  aria-label="Tìm theo tên hàng"
                  placeholder="Tìm theo tên hàng"
                  value={activeReturnDraft.data.productSearch}
                  onChange={(event) =>
                    updateReturnDraft((draft) => ({
                      ...draft,
                      data: { ...draft.data, productSearch: event.target.value },
                    }))
                  }
                />
              ) : activeOrderDraft ? (
                <input
                  aria-label="Tìm theo tên hàng"
                  placeholder="Tìm theo tên hàng"
                  value={activeOrderDraft.data.productSearch}
                  onChange={(event) =>
                    updateOrderDraft((draft) => ({
                      ...draft,
                      data: { ...draft.data, productSearch: event.target.value },
                    }))
                  }
                />
              ) : (
                <input aria-label="Tìm hàng hóa" placeholder="Tìm hàng hóa" value="" disabled />
              )}
              {visibleProducts.length > 0 ? (
                <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả hàng hóa">
                  {visibleProducts.map((product) => (
                    <button key={product.id} type="button" onClick={() => selectProduct(product)}>
                      <strong>{product.product_name}</strong>
                      <span>{product.product_code_base}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleSourceInvoices.length > 0 ? (
                <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả hóa đơn nguồn">
                  {visibleSourceInvoices.map((invoice) => (
                    <button key={invoice.id} type="button" onClick={() => selectSourceInvoice(invoice)}>
                      <strong>{invoice.invoice_code}</strong>
                      <span>{invoice.customer_snapshot_name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleReturnProducts.length > 0 ? (
                <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả hàng trả">
                  {visibleReturnProducts.map((product) => (
                    <button key={product.id} type="button" onClick={() => addQuickReturnProduct(product)}>
                      <strong>{product.product_name}</strong>
                      <span>{product.product_code_base}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleOrderProducts.length > 0 ? (
                <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả hàng đặt">
                  {visibleOrderProducts.map((product) => (
                    <button key={product.id} type="button" onClick={() => addOrderProduct(product)}>
                      <strong>{product.product_name}</strong>
                      <span>{product.product_code_base}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="sales-draft-tabs" aria-label="Tab POS">
              {drafts.map((draft) => {
                const label = draftLabel(draft, drafts);
                return (
                <div
                  className={
                    draft.id === activeDraft.id
                      ? isSaleDraft(draft) && draft.mode === "edit"
                        ? "sales-draft-tab sales-draft-tab--edit active"
                        : "sales-draft-tab active"
                      : isSaleDraft(draft) && draft.mode === "edit"
                        ? "sales-draft-tab sales-draft-tab--edit"
                        : "sales-draft-tab"
                  }
                  key={draft.id}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDraftId(draft.id);
                      resetErrors();
                    }}
                  >
                    {label}
                  </button>
                  {drafts.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Đóng tab ${label}`}
                      onClick={() => closeDraft(draft.id)}
                    >
                      x
                    </button>
                  ) : null}
                </div>
                );
              })}
              <div className="sales-draft-add-wrap">
                <button
                  className="sales-draft-add"
                  type="button"
                  aria-label="Thêm tab POS"
                  aria-expanded={isAddMenuOpen}
                  onClick={() => setIsAddMenuOpen((value) => !value)}
                >
                +
                </button>
                {isAddMenuOpen ? (
                  <div className="sales-draft-add-menu" role="menu" aria-label="Chọn loại tab POS">
                    <button type="button" role="menuitem" onClick={() => addDraft("sale")}>
                      Bán hàng
                    </button>
                    <button type="button" role="menuitem" onClick={() => addDraft("linked_return")}>
                      trả hàng theo hóa đơn
                    </button>
                    <button type="button" role="menuitem" onClick={() => addDraft("quick_return")}>
                      Trả hàng nhanh
                    </button>
                    <button type="button" role="menuitem" onClick={() => addDraft("order")}>
                      Đặt hàng
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {activeSaleDraft ? (
          <>
            <div className="sales-line-table-wrap">
            <div className="sales-line-grid" style={lineGridStyle} role="table" aria-label="Danh sách hàng hóa">
              <div className="sales-line-grid__row sales-line-grid__head" role="row">
                {lineColumnLabels.map((label, index) => (
                  <div className="sales-line-grid__cell" role="columnheader" key={`${label}-${index}`} aria-label={label || "Xóa dòng"}>
                    <span>{label}</span>
                    {index < lineColumnLabels.length - 1 ? (
                      <span
                        className="sales-column-resizer"
                        role="separator"
                        aria-label={`Kéo để đổi độ rộng cột ${label || "Xóa dòng"}`}
                        aria-orientation="vertical"
                        aria-valuenow={Math.round(lineColumnWidths[index])}
                        onPointerDown={(event) => startColumnResize(index, event)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              {activeSaleDraft.items.map((item, index) => {
                const product = productById.get(item.productId);
                const unitChoices = product ? enabledUnitsForProduct(product) : item.unitType ? [item.unitType] : [];
                const prefix = `items.${index}`;
                return (
                  <div className="sales-line-grid__row" role="row" key={item.rowId}>
                    <div className="sales-line-grid__cell" role="cell">{index + 1}</div>
                    <div className="sales-line-grid__cell" role="cell">
                      <button
                        className="sales-icon-button"
                        type="button"
                        aria-label={`Xóa dòng ${index + 1}`}
                        onClick={() => updateSaleDraft((draft) => ({ ...draft, items: draft.items.filter((row) => row.rowId !== item.rowId) }))}
                      >
                        x
                      </button>
                    </div>
                    <div className="sales-line-grid__cell" role="cell">{product?.product_code_base ?? item.productCodeSnapshot ?? "-"}</div>
                    <div className="sales-line-grid__cell" role="cell">
                      <strong>{product?.product_name ?? item.productNameSnapshot ?? "-"}</strong>
                      {fieldErrors[`${prefix}.productId`] ? <span className="field-error">{fieldErrors[`${prefix}.productId`]}</span> : null}
                    </div>
                    <div className="sales-line-grid__cell" role="cell">
                      {unitChoices.length > 1 ? (
                        <select value={item.unitType} onChange={(event) => updateItemUnit(item, event.target.value as UnitType)}>
                          {unitChoices.map((unitType) => (
                            <option key={unitType} value={unitType}>
                              {unitLabel(unitType)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{unitLabel(item.unitType)}</span>
                      )}
                      {fieldErrors[`${prefix}.unitType`] ? <span className="field-error">{fieldErrors[`${prefix}.unitType`]}</span> : null}
                    </div>
                    <div className="sales-line-grid__cell" role="cell">
                      <input
                        aria-label={`Số lượng dòng ${index + 1}`}
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.rowId, (current) => ({ ...current, quantity: event.target.value }))}
                      />
                      {fieldErrors[`${prefix}.quantity`] ? <span className="field-error">{fieldErrors[`${prefix}.quantity`]}</span> : null}
                    </div>
                    <div className="sales-line-grid__cell" role="cell">
                      <input
                        aria-label={`Đơn giá dòng ${index + 1}`}
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) => updateItem(item.rowId, (current) => ({ ...current, unitPrice: event.target.value }))}
                      />
                      {fieldErrors[`${prefix}.unitPrice`] ? <span className="field-error">{fieldErrors[`${prefix}.unitPrice`]}</span> : null}
                    </div>
                    <div className="sales-line-grid__cell" role="cell">
                      <strong>{lineTotalLabel(item)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
            {activeSaleDraft.items.length === 0 ? (
              <div className="sales-empty-lines">
                <p>Chưa có hàng hóa trong hóa đơn.</p>
                {fieldErrors.items ? <span className="field-error">{fieldErrors.items}</span> : null}
              </div>
            ) : null}
          </div>

          <label className="sales-note-field">
            Ghi chú bán hàng
            <textarea
              value={activeSaleDraft.note}
              onChange={(event) => updateSaleDraft((draft) => ({ ...draft, note: event.target.value }))}
              placeholder="Ghi chú bán hàng"
            />
          </label>
          </>
          ) : activeOrderDraft ? (
            <div className="sales-order-workspace" role="region" aria-label="Khu vực đặt hàng POS">
              <div className="sales-order-context">
                <strong>Đặt hàng</strong>
                <span>Tìm theo tên hàng, lưu số lượng cần làm mà không tác động tồn kho hay công nợ.</span>
              </div>
              <div className="sales-order-table" role="table" aria-label="Dòng đặt hàng">
                <div className="sales-order-table__row sales-order-table__head" role="row">
                  {["Tên hàng", "Đơn vị", "Số lượng", "Xóa"].map((label) => (
                    <div className="sales-order-table__cell" role="columnheader" key={label}>
                      {label}
                    </div>
                  ))}
                </div>
                {activeOrderDraft.data.lines.map((line, index) => {
                  const product = productById.get(line.productId);
                  const unitChoices = returnUnitChoices(product, line.unitType || undefined);
                  const prefix = `lines.${index}`;
                  return (
                    <div className="sales-order-table__row" role="row" key={line.rowId}>
                      <div className="sales-order-table__cell" role="cell">{product?.product_name ?? "-"}</div>
                      <div className="sales-order-table__cell" role="cell">
                        {unitChoices.length > 1 ? (
                          <select
                            aria-label={`Đơn vị đặt hàng dòng ${index + 1}`}
                            value={line.unitType}
                            onChange={(event) => updateOrderLine(line.rowId, (current) => ({ ...current, unitType: event.target.value as UnitType }))}
                          >
                            {unitChoices.map((unitType) => (
                              <option key={unitType} value={unitType}>
                                {unitLabel(unitType)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{line.unitType ? unitLabel(line.unitType) : "-"}</span>
                        )}
                        {activeOrderDraft.data.errors[`${prefix}.unitType`] ? (
                          <span className="field-error">{activeOrderDraft.data.errors[`${prefix}.unitType`]}</span>
                        ) : null}
                      </div>
                      <div className="sales-order-table__cell" role="cell">
                        <input
                          aria-label={`Số lượng đặt hàng dòng ${index + 1}`}
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) => updateOrderLine(line.rowId, (current) => ({ ...current, quantity: event.target.value }))}
                        />
                        {activeOrderDraft.data.errors[`${prefix}.quantity`] ? (
                          <span className="field-error">{activeOrderDraft.data.errors[`${prefix}.quantity`]}</span>
                        ) : null}
                      </div>
                      <div className="sales-order-table__cell" role="cell">
                        <button
                          className="sales-icon-button"
                          type="button"
                          aria-label={`Xóa dòng đặt hàng ${index + 1}`}
                          onClick={() =>
                            updateOrderDraft((draft) => ({
                              ...draft,
                              data: { ...draft.data, lines: draft.data.lines.filter((row) => row.rowId !== line.rowId) },
                            }))
                          }
                        >
                          x
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {activeOrderDraft.data.lines.length === 0 ? (
                <div className="sales-empty-lines">
                  <p>Chưa có hàng hóa trong đơn đặt hàng.</p>
                  {activeOrderDraft.data.errors.items ? <span className="field-error">{activeOrderDraft.data.errors.items}</span> : null}
                </div>
              ) : null}
              <label className="sales-note-field">
                Ghi chú đơn đặt hàng
                <textarea
                  value={activeOrderDraft.data.note}
                  onChange={(event) => updateOrderDraft((draft) => ({ ...draft, data: { ...draft.data, note: event.target.value } }))}
                  placeholder="Ghi chú đơn đặt hàng"
                />
              </label>
            </div>
          ) : (
            <div className="sales-return-workspace" role="region" aria-label="Khu vực trả hàng POS">
              {activeReturnDraft?.type === "linked_return" ? (
                <>
                  <div className="sales-return-context">
                    <strong>trả hàng theo hóa đơn</strong>
                    <span>
                      {activeSourceInvoice
                        ? `${activeSourceInvoice.invoice_code} - ${activeSourceInvoice.customer_snapshot_name}`
                        : "Chọn hóa đơn nguồn để tiếp tục dòng trả hàng."}
                    </span>
                    {activeReturnDraft.data.errors.sourceInvoiceId ? (
                      <span className="field-error">{activeReturnDraft.data.errors.sourceInvoiceId}</span>
                    ) : null}
                  </div>

                  <div className="sales-return-table" role="table" aria-label="Dòng trả hàng theo hóa đơn">
                    <div className="sales-return-table__row sales-return-table__head" role="row">
                      {["Mã hàng", "Tên hàng", "Đơn vị", "Đã mua", "Đã trả", "Còn lại", "Trả lần này", "Đơn giá", "Thành tiền"].map((label) => (
                        <div className="sales-return-table__cell" role="columnheader" key={label}>
                          {label}
                        </div>
                      ))}
                    </div>
                    {activeReturnDraft.data.lines.map((line, index) => {
                      const sourceItem = activeSourceInvoice?.items.find((item) => String(item.id) === line.sourceInvoiceItemId);
                      const returnedQuantity = sourceItem
                        ? returnedQuantityForItem(returns, activeReturnDraft.data.sourceInvoiceId, sourceItem.id)
                        : 0;
                      const remainingQuantity = sourceItem ? remainingQuantityForItem(sourceItem, returns, activeReturnDraft.data.sourceInvoiceId) : 0;
                      const prefix = `lines.${index}`;
                      return (
                        <div className="sales-return-table__row" role="row" key={line.rowId}>
                          <div className="sales-return-table__cell" role="cell">{sourceItem?.product_code_snapshot ?? "-"}</div>
                          <div className="sales-return-table__cell" role="cell">{sourceItem?.product_name_snapshot ?? "-"}</div>
                          <div className="sales-return-table__cell" role="cell">{line.unitType ? unitLabel(line.unitType) : "-"}</div>
                          <div className="sales-return-table__cell" role="cell">{sourceItem?.quantity ?? "-"}</div>
                          <div className="sales-return-table__cell" role="cell">{formatDecimal(returnedQuantity)}</div>
                          <div className="sales-return-table__cell" role="cell">{formatDecimal(remainingQuantity)}</div>
                          <div className="sales-return-table__cell" role="cell">
                            <input
                              aria-label={`Trả lần này dòng ${index + 1}`}
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(event) => updateReturnLine(line.rowId, (current) => ({ ...current, quantity: event.target.value }))}
                            />
                            {activeReturnDraft.data.errors[`${prefix}.quantity`] ? (
                              <span className="field-error">{activeReturnDraft.data.errors[`${prefix}.quantity`]}</span>
                            ) : null}
                          </div>
                          <div className="sales-return-table__cell" role="cell">{formatMoney(line.unitPrice || "0")}</div>
                          <div className="sales-return-table__cell" role="cell">
                            <strong>{returnLineTotalLabel(line)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {activeReturnDraft.data.errors.items ? <p className="field-error">{activeReturnDraft.data.errors.items}</p> : null}
                </>
              ) : null}

              {activeReturnDraft?.type === "quick_return" ? (
                <>
                  <div className="sales-return-context">
                    <strong>Trả hàng nhanh</strong>
                    <span>Tìm hàng theo tên, không áp trần số lượng theo hóa đơn nguồn.</span>
                  </div>
                  <div className="sales-return-table sales-return-table--quick" role="table" aria-label="Dòng trả hàng nhanh">
                    <div className="sales-return-table__row sales-return-table__head" role="row">
                      {["Tên hàng", "Đơn vị", "Số lượng", "Đơn giá", "Thành tiền", "Xóa"].map((label) => (
                        <div className="sales-return-table__cell" role="columnheader" key={label}>
                          {label}
                        </div>
                      ))}
                    </div>
                    {activeReturnDraft.data.lines.map((line, index) => {
                      const product = productById.get(line.productId);
                      const unitChoices = returnUnitChoices(product, line.unitType || undefined);
                      const prefix = `lines.${index}`;
                      return (
                        <div className="sales-return-table__row" role="row" key={line.rowId}>
                          <div className="sales-return-table__cell" role="cell">{product?.product_name ?? "-"}</div>
                          <div className="sales-return-table__cell" role="cell">
                            {unitChoices.length > 1 ? (
                              <select
                                aria-label={`Đơn vị trả nhanh dòng ${index + 1}`}
                                value={line.unitType}
                                onChange={(event) => updateReturnLineUnit(line, event.target.value as UnitType)}
                              >
                                {unitChoices.map((unitType) => (
                                  <option key={unitType} value={unitType}>
                                    {unitLabel(unitType)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{line.unitType ? unitLabel(line.unitType) : "-"}</span>
                            )}
                            {activeReturnDraft.data.errors[`${prefix}.unitType`] ? (
                              <span className="field-error">{activeReturnDraft.data.errors[`${prefix}.unitType`]}</span>
                            ) : null}
                          </div>
                          <div className="sales-return-table__cell" role="cell">
                            <input
                              aria-label={`Số lượng trả nhanh dòng ${index + 1}`}
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(event) => updateReturnLine(line.rowId, (current) => ({ ...current, quantity: event.target.value }))}
                            />
                            {activeReturnDraft.data.errors[`${prefix}.quantity`] ? (
                              <span className="field-error">{activeReturnDraft.data.errors[`${prefix}.quantity`]}</span>
                            ) : null}
                          </div>
                          <div className="sales-return-table__cell" role="cell">
                            <input
                              aria-label={`Đơn giá trả nhanh dòng ${index + 1}`}
                              inputMode="decimal"
                              value={line.unitPrice}
                              onChange={(event) => updateReturnLine(line.rowId, (current) => ({ ...current, unitPrice: event.target.value }))}
                            />
                            {activeReturnDraft.data.errors[`${prefix}.unitPrice`] ? (
                              <span className="field-error">{activeReturnDraft.data.errors[`${prefix}.unitPrice`]}</span>
                            ) : null}
                          </div>
                          <div className="sales-return-table__cell" role="cell">
                            <strong>{returnLineTotalLabel(line)}</strong>
                          </div>
                          <div className="sales-return-table__cell" role="cell">
                            <button
                              className="sales-icon-button"
                              type="button"
                              aria-label={`Xóa dòng trả nhanh ${index + 1}`}
                              onClick={() =>
                                updateReturnDraft((draft) => ({
                                  ...draft,
                                  data: { ...draft.data, lines: draft.data.lines.filter((row) => row.rowId !== line.rowId) },
                                }))
                              }
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {activeReturnDraft.data.lines.length === 0 ? (
                    <div className="sales-empty-lines">
                      <p>Chưa có hàng hóa trong phiếu trả.</p>
                      {activeReturnDraft.data.errors.items ? <span className="field-error">{activeReturnDraft.data.errors.items}</span> : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeReturnDraft ? (
                <label className="sales-note-field">
                  Ghi chú trả hàng
                  <textarea
                    value={activeReturnDraft.data.note}
                    onChange={(event) =>
                      updateReturnDraft((draft) => ({ ...draft, data: { ...draft.data, note: event.target.value } }))
                    }
                    placeholder="Ghi chú trả hàng"
                  />
                </label>
              ) : null}
            </div>
          )}
        </section>

        {activeSaleDraft ? (
        <aside className="sales-payment-panel" aria-label="Thanh toán">
          {activeSaleDraft.mode === "edit" ? (
            <div className="sales-edit-banner" aria-label="Trạng thái sửa hóa đơn">
              <span className="sales-edit-badge">Đang sửa hóa đơn</span>
              <strong>{activeSaleDraft.invoiceCode || `Hóa đơn #${activeSaleDraft.invoiceId}`}</strong>
              {activeSaleDraft.returnLabel ? <p>{activeSaleDraft.returnLabel}</p> : null}
            </div>
          ) : null}
          <div className="sales-customer-search">
            <label>
              Khách hàng
              <input
                aria-label="Tìm Khách hàng"
                placeholder="Tìm Khách hàng"
                value={activeSaleDraft.customerSearch}
                onChange={(event) => updateSaleDraft((draft) => ({ ...draft, customerSearch: event.target.value }))}
              />
            </label>
            {visibleCustomers.length > 0 ? (
              <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả Khách hàng">
                {visibleCustomers.map((customer) => (
                  <button key={customer.id} type="button" onClick={() => selectCustomer(customer)}>
                    <strong>{customer.customer_name}</strong>
                    <span>{customer.phone ?? "Không có SĐT"}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {selectedCustomer ? (
            <div className="sales-selected-customer">
              <div>
                <strong>{selectedCustomer.customer_name}</strong>
                <span>{selectedCustomer.phone ?? "Không có SĐT"}</span>
              </div>
              <button type="button" className="inventory-ghost-button" onClick={clearCustomer}>
                Bỏ chọn
              </button>
              <p>Công nợ hiện tại: {formatMoney(selectedCustomer.current_balance)}</p>
            </div>
          ) : (
            <p className="sales-walk-in-label">Khách lẻ</p>
          )}

          <label>
            Thời gian hóa đơn
            <input
              type="datetime-local"
              value={activeSaleDraft.invoice_datetime}
              onChange={(event) => updateSaleDraft((draft) => ({ ...draft, invoice_datetime: event.target.value }))}
            />
            {fieldErrors.invoice_datetime ? <span className="field-error">{fieldErrors.invoice_datetime}</span> : null}
          </label>

          <div className="sales-payment-summary">
            <div>
              <span>Tổng tiền hàng</span>
              <strong>{formatMoney(estimatedTotalText)}</strong>
            </div>
            <div>
              <span>Khách cần trả</span>
              <strong>{formatMoney(estimatedTotalText)}</strong>
            </div>
            <label>
              	Khách thanh toán
              <input
                aria-label="	Khách thanh toán"
                inputMode="decimal"
                value={activeSaleDraft.paid_amount}
                onChange={(event) => updateSaleDraft((draft) => ({ ...draft, paid_amount: event.target.value }))}
              />
              {fieldErrors.paid_amount ? <span className="field-error">{fieldErrors.paid_amount}</span> : null}
            </label>
            <div>
              <span>{selectedCustomer ? "Thanh toán thừa / ghi vào công nợ" : "Tiền thừa"}</span>
              <strong>{formatMoney(formatCents(paymentDelta))}</strong>
            </div>
          </div>

          {feedback ? <p className={feedback.type === "error" ? "form-error" : "state-message"}>{feedback.message}</p> : null}

          <button
            className="sales-pay-button"
            type="button"
            disabled={createInvoice.isPending || updateInvoice.isPending}
            onClick={() => void handlePayment()}
          >
            {activeSaleDraft.mode === "edit"
              ? updateInvoice.isPending
                ? "Đang cập nhật"
                : "Cập nhật hóa đơn"
              : createInvoice.isPending
                ? "Đang thanh toán"
                : "Thanh toán"}
          </button>
          {activeSaleDraft.mode === "edit" ? (
            <button className="inventory-ghost-button" type="button" onClick={() => cancelEditDraft(activeSaleDraft)}>
              Hủy sửa
            </button>
          ) : (
            <Link className="secondary-link" to="/sales/invoices">
              Xem danh sách hóa đơn
            </Link>
          )}
        </aside>
        ) : activeOrderDraft ? (
          <aside className="sales-payment-panel sales-return-side" aria-label="Thông tin đặt hàng">
            <strong>Đặt hàng</strong>
            <div className="sales-customer-search">
              <label>
                Khách hàng
                <input
                  aria-label="Tìm khách đặt hàng"
                  placeholder="Tìm Khách hàng"
                  value={activeOrderDraft.data.customerSearch}
                  onChange={(event) =>
                    updateOrderDraft((draft) => ({
                      ...draft,
                      data: { ...draft.data, customerSearch: event.target.value },
                    }))
                  }
                />
              </label>
              {visibleOrderCustomers.length > 0 ? (
                <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả khách đặt hàng">
                  {visibleOrderCustomers.map((customer) => (
                    <button key={customer.id} type="button" onClick={() => selectOrderCustomer(customer)}>
                      <strong>{customer.customer_name}</strong>
                      <span>{customer.phone ?? "Không có SĐT"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedOrderCustomer ? (
              <div className="sales-selected-customer">
                <div>
                  <strong>{selectedOrderCustomer.customer_name}</strong>
                  <span>{selectedOrderCustomer.phone ?? "Không có SĐT"}</span>
                </div>
                <button type="button" className="inventory-ghost-button" onClick={clearOrderCustomer}>
                  Bỏ chọn
                </button>
                <p>Công nợ hiện tại: {formatMoney(selectedOrderCustomer.current_balance)}</p>
              </div>
            ) : (
              <p className="sales-walk-in-label">Khách lẻ</p>
            )}

            <label>
              Thời gian đặt hàng
              <input
                type="datetime-local"
                value={activeOrderDraft.data.orderDatetime}
                onChange={(event) =>
                  updateOrderDraft((draft) => ({ ...draft, data: { ...draft.data, orderDatetime: event.target.value } }))
                }
              />
              {activeOrderDraft.data.errors.orderDatetime ? (
                <span className="field-error">{activeOrderDraft.data.errors.orderDatetime}</span>
              ) : null}
            </label>

            <label className="sales-inline-check">
              <input
                type="checkbox"
                checked={activeOrderDraft.data.hasRequiredDeliveryDate}
                onChange={(event) =>
                  updateOrderDraft((draft) => ({
                    ...draft,
                    data: { ...draft.data, hasRequiredDeliveryDate: event.target.checked },
                  }))
                }
              />
              Có ngày cần giao
            </label>

            {activeOrderDraft.data.hasRequiredDeliveryDate ? (
              <label>
                Ngày cần giao
                <input
                  type="datetime-local"
                  value={activeOrderDraft.data.requiredDeliveryDatetime}
                  onChange={(event) =>
                    updateOrderDraft((draft) => ({
                      ...draft,
                      data: { ...draft.data, requiredDeliveryDatetime: event.target.value },
                    }))
                  }
                />
                {activeOrderDraft.data.errors.requiredDeliveryDatetime ? (
                  <span className="field-error">{activeOrderDraft.data.errors.requiredDeliveryDatetime}</span>
                ) : null}
              </label>
            ) : null}

            {feedback ? <p className={feedback.type === "error" ? "form-error" : "state-message"}>{feedback.message}</p> : null}

            <button className="sales-pay-button" type="button" disabled={createOrder.isPending} onClick={() => void handleOrderSubmit()}>
              {createOrder.isPending ? "Đang lưu" : "Lưu đơn đặt hàng"}
            </button>
          </aside>
        ) : (
          <aside className="sales-payment-panel sales-return-side" aria-label="Thông tin trả hàng">
            {activeReturnDraft ? (
              <>
                <strong>{activeReturnDraft.type === "linked_return" ? "Trả hàng theo hóa đơn" : "Trả hàng nhanh"}</strong>

                {activeReturnDraft.type === "quick_return" ? (
                  <div className="sales-customer-search">
                    <label>
                      Khách hàng
                      <input
                        aria-label="Tìm khách trả hàng"
                        placeholder="Tìm Khách hàng"
                        value={activeReturnDraft.data.customerSearch}
                        onChange={(event) =>
                          updateReturnDraft((draft) => ({
                            ...draft,
                            data: { ...draft.data, customerSearch: event.target.value },
                          }))
                        }
                      />
                    </label>
                    {visibleReturnCustomers.length > 0 ? (
                      <div className="sales-search-dropdown" role="listbox" aria-label="Kết quả khách trả hàng">
                        {visibleReturnCustomers.map((customer) => (
                          <button key={customer.id} type="button" onClick={() => selectReturnCustomer(customer)}>
                            <strong>{customer.customer_name}</strong>
                            <span>{customer.phone ?? "Không có SĐT"}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeReturnDraft.type === "linked_return" ? (
                  <div className="sales-selected-customer">
                    <div>
                      <strong>{activeSourceInvoice?.customer_snapshot_name ?? "Chưa chọn hóa đơn nguồn"}</strong>
                      <span>{activeSourceInvoice ? `hóa đơn ${activeSourceInvoice.invoice_code}` : "Nhập mã hóa đơn nguồn"}</span>
                    </div>
                  </div>
                ) : selectedReturnCustomer ? (
                  <div className="sales-selected-customer">
                    <div>
                      <strong>{selectedReturnCustomer.customer_name}</strong>
                      <span>{selectedReturnCustomer.phone ?? "Không có SĐT"}</span>
                    </div>
                    <button type="button" className="inventory-ghost-button" onClick={clearReturnCustomer}>
                      Bỏ chọn
                    </button>
                    <p>Công nợ hiện tại: {formatMoney(selectedReturnCustomer.current_balance)}</p>
                  </div>
                ) : (
                  <p className="sales-walk-in-label">Khách lẻ</p>
                )}

                <label>
                  Thời gian trả hàng
                  <input
                    type="datetime-local"
                    value={activeReturnDraft.data.returnDatetime}
                    onChange={(event) =>
                      updateReturnDraft((draft) => ({ ...draft, data: { ...draft.data, returnDatetime: event.target.value } }))
                    }
                  />
                  {activeReturnDraft.data.errors.returnDatetime ? (
                    <span className="field-error">{activeReturnDraft.data.errors.returnDatetime}</span>
                  ) : null}
                </label>

                <label>
                  Cách xử lý
                  <select
                    value={activeReturnDraft.data.handlingMode}
                    onChange={(event) =>
                      updateReturnDraft((draft) => ({
                        ...draft,
                        data: { ...draft.data, handlingMode: event.target.value as ReturnHandlingMode },
                      }))
                    }
                  >
                    <option value="REFUND_NOW">Hoàn tiền ngay</option>
                    <option value="STORE_CREDIT" disabled={activeReturnDraft.type === "quick_return" && !activeReturnDraft.data.customerId}>
                      Trả công nợ
                    </option>
                  </select>
                  {activeReturnDraft.data.errors.handlingMode ? (
                    <span className="field-error">{activeReturnDraft.data.errors.handlingMode}</span>
                  ) : null}
                </label>

                <div className="sales-payment-summary">
                  <div>
                    <span>Tổng tiền trả</span>
                    <strong>{formatMoney(formatCents(estimateReturnLinesTotal(activeReturnDraft.data.lines)))}</strong>
                  </div>
                </div>

                {feedback ? <p className={feedback.type === "error" ? "form-error" : "state-message"}>{feedback.message}</p> : null}

                <button className="sales-pay-button" type="button" disabled={createReturn.isPending} onClick={() => void handleReturnSubmit()}>
                  {createReturn.isPending ? "Đang trả hàng" : "trả hàng"}
                </button>
                <Link className="secondary-link" to="/returns">
                  Xem danh sách trả hàng
                </Link>
              </>
            ) : null}
          </aside>
        )}
      </form>
    </InventoryModuleShell>
  );
}

