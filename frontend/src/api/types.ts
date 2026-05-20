import type { UserRole } from "../domain/roles";

export type AuthenticatedUser = {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
};

export type AuthTokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type LoginResponse = AuthTokenPair & {
  user: AuthenticatedUser;
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type UnitMode = "BAO_KG" | "BICH";

export type UnitType = "BAO" | "KG" | "BICH";

export type ProductPrice = {
  unit_type: UnitType;
  price: string;
  is_enabled: boolean;
};

export type InventoryBalance = {
  product_id: number;
  on_hand_bao_decimal: string | null;
  on_hand_bich_integer: string | null;
  derived_kg_balance: string | null;
  updated_at: string | null;
};

export type Product = {
  id: number;
  product_code_base: string;
  product_name: string;
  unit_mode: UnitMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prices: ProductPrice[];
  balance: InventoryBalance | null;
};

export type ProductCreatePayload = {
  product_code_base: string;
  product_name: string;
  unit_mode: UnitMode;
  prices: ProductPrice[];
};

export type ProductUpdatePayload = {
  product_name: string;
  prices: ProductPrice[];
};

export type ProductDeleteResult = {
  product_id: number;
  action: "hard_deleted" | "deactivated" | string;
};

export type StockAdjustmentPayload = {
  unit_type: UnitType;
  quantity: string;
  note?: string | null;
};

export type StockSetPayload = {
  unit_type: UnitType;
  target_quantity: string;
  note?: string | null;
  adjustment_datetime?: string | null;
};

export type InventoryMovement = {
  movement_id: number;
  movement_datetime: string;
  movement_type: "SALE" | "RETURN" | "STOCK_INCREASE" | "STOCK_DECREASE" | "STOCK_SET" | "IMPORT" | "MANUAL" | string;
  quantity_delta: string;
  unit_type: UnitType;
  balance_after: string | null;
  source_type: "invoice" | "return" | "stock_adjustment" | string;
  source_id: number;
  note: string | null;
  actor: string | null;
  created_at: string;
};

export type Customer = {
  id: number;
  customer_name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  current_balance: string;
  total_sales: string;
  is_walk_in: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerLedgerRow = {
  id: number;
  customer_id: number;
  event_type: string;
  ref_type: string;
  ref_id: number;
  amount_delta: string;
  balance_after: string;
  transaction_datetime: string | null;
  display_order: number;
  note: string | null;
};

export type DebtPayment = {
  id: number;
  customer_id: number;
  amount: string;
  payment_datetime: string;
  note: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type DebtPaymentPayload = {
  amount: string;
  payment_datetime?: string | null;
  note?: string | null;
};

export type DebtPaymentResult = {
  payment: DebtPayment;
  ledger: CustomerLedgerRow | null;
  current_balance: string;
};

export type BalanceAdjustmentPayload = {
  target_balance: string;
  adjustment_datetime?: string | null;
  note?: string | null;
};

export type BalanceAdjustmentResult = {
  customer: Customer;
  ledger: CustomerLedgerRow;
};

export type CustomerCreatePayload = {
  customer_name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  opening_balance: string;
  total_sales: string;
};

export type CustomerUpdatePayload = {
  customer_name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
};

export type CustomerDeleteResult = {
  customer_id: number;
  action: "hard_deleted" | "deactivated" | string;
};

export type InvoiceItem = {
  id: number;
  product_id: number;
  unit_type: UnitType;
  quantity: string;
  unit_price: string;
  line_total: string;
  product_code_snapshot: string;
  product_name_snapshot: string;
};

export type Invoice = {
  id: number;
  invoice_code: string;
  customer_id: number | null;
  customer_snapshot_name: string;
  invoice_datetime: string;
  total_amount: string;
  paid_amount: string;
  payment_method: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
};

export type InvoiceItemCreatePayload = {
  product_id: number;
  unit_type: UnitType;
  quantity: string;
  unit_price: string;
};

export type InvoiceCreatePayload = {
  customer_id: number | null;
  customer_snapshot_name?: string | null;
  invoice_datetime: string;
  items: InvoiceItemCreatePayload[];
  paid_amount: string;
  payment_method?: string | null;
  note?: string | null;
};

export type ReturnInvoiceItem = {
  id: number;
  source_invoice_item_id: number | null;
  product_id: number;
  unit_type: UnitType;
  quantity: string;
  unit_price: string;
  line_total: string;
  product_code_snapshot: string;
  product_name_snapshot: string;
};

export type ReturnInvoice = {
  id: number;
  return_code: string;
  source_invoice_id: number | null;
  customer_id: number | null;
  customer_snapshot_name: string;
  is_quick_return: boolean;
  return_datetime: string;
  total_amount: string;
  handling_mode: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  items: ReturnInvoiceItem[];
};

export type ReturnHandlingMode = "REFUND_NOW" | "STORE_CREDIT";

export type ReturnInvoiceItemCreatePayload = {
  product_id: number;
  unit_type: UnitType;
  quantity: string;
  unit_price: string;
  source_invoice_item_id?: number | null;
};

export type ReturnInvoiceCreatePayload = {
  source_invoice_id?: number | null;
  customer_id?: number | null;
  customer_snapshot_name?: string | null;
  return_datetime: string;
  handling_mode: ReturnHandlingMode;
  items: ReturnInvoiceItemCreatePayload[];
  note?: string | null;
};

export type DashboardSummary = {
  total_products: number;
  total_customers: number;
  total_customer_debt: string;
  total_inventory_items: number;
  today_sales_total: string;
  month_sales_total: string;
  today_return_total: string;
  month_return_total: string;
  invoice_count_today: number;
  positive_debt_customer_count: number;
};

export type CustomerDebtReportRow = {
  customer_id: number;
  customer_name: string;
  phone: string | null;
  current_balance: string;
  total_sales: string;
  is_active: boolean;
};

export type InventorySummaryRow = {
  product_id: number;
  product_code_base: string;
  product_name: string;
  unit_mode: UnitMode;
  is_active: boolean;
  balance_value: string | null;
  balance_unit: UnitType | null;
  prices: ProductPrice[];
};

export type SalesSummaryDayRow = {
  date: string;
  invoice_count: number;
  total_sales: string;
  total_paid: string;
};

export type SalesSummaryReport = {
  total_sales: string;
  total_paid: string;
  invoice_count: number;
  average_invoice_total: string;
  by_day: SalesSummaryDayRow[];
};

export type ReturnsSummaryDayRow = {
  date: string;
  return_count: number;
  total_returns: string;
};

export type ReturnsSummaryReport = {
  total_returns: string;
  return_count: number;
  by_day: ReturnsSummaryDayRow[];
};
