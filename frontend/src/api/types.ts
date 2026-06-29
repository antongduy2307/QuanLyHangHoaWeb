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
  source_order_id?: number | null;
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

export type OrderStatus = "OPEN" | "PREPARED" | "CONVERTED";

export type OrderItem = {
  id: number;
  product_id: number;
  product_name_snapshot: string;
  unit_type: UnitType;
  quantity: string;
  created_at: string;
};

export type Order = {
  id: number;
  order_code: string;
  customer_id: number | null;
  customer_name_snapshot: string;
  order_datetime: string;
  required_delivery_datetime: string | null;
  note: string | null;
  status: OrderStatus | string;
  source_invoice_id: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type OrderItemCreatePayload = {
  product_id: number;
  unit_type: UnitType;
  quantity: string;
};

export type OrderCreatePayload = {
  customer_id: number | null;
  customer_snapshot_name?: string | null;
  order_datetime: string;
  required_delivery_datetime?: string | null;
  items: OrderItemCreatePayload[];
  note?: string | null;
};

export type OrderQuantitySummaryRow = {
  product_id: number;
  product_name: string;
  unit_type: UnitType;
  quantity: string;
  stock_available: string | null;
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

export type DashboardOverview = {
  today_invoice_count: number;
  today_sales_total: string;
  today_return_count: number;
  today_return_total: string;
  this_month_sales_total: string;
  last_month_sales_total: string;
  last_7_days_sales_total: string;
  current_customer_debt: string;
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

export type SalesTimeseriesBucket = {
  label: string;
  start_datetime: string;
  end_datetime: string;
  sales_total: string;
  invoice_count: number;
};

export type SalesTimeseriesReport = {
  period: "today" | "yesterday" | "last_7_days" | "this_month" | "last_month";
  granularity: "hour" | "day";
  buckets: SalesTimeseriesBucket[];
};

export type TopProductReportRow = {
  product_id: number;
  product_code: string;
  product_name: string;
  unit_type: UnitType;
  total_quantity: string;
  total_revenue: string;
  invoice_count: number;
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

export type HistoryEventType =
  | "SALES_INVOICE"
  | "RETURN_INVOICE"
  | "DEBT_PAYMENT"
  | "BALANCE_ADJUSTMENT"
  | "STOCK_MOVEMENT"
  | "ORDER";

export type HistoryOpenTarget = {
  target_type: "invoice" | "return" | "customer" | "product" | "order" | string;
  target_id: number;
  route: string | null;
};

export type HistoryEvent = {
  event_type: HistoryEventType | string;
  event_id: number;
  event_datetime: string | null;
  display_order: number;
  code: string | null;
  customer_id: number | null;
  customer_name: string | null;
  product_id: number | null;
  product_name: string | null;
  amount: string | null;
  paid_amount: string | null;
  item_count: number | null;
  quantity: string | null;
  unit_type: UnitType | null;
  status: string | null;
  source_type: string | null;
  source_id: number | null;
  note: string | null;
  open_target: HistoryOpenTarget | null;
};

export type HistoryListResponse = {
  page: number;
  page_size: number;
  total: number;
  items: HistoryEvent[];
};

export type AttendanceTeam = "blow" | "cut";
export type AttendanceRecordStatus = "draft" | "done";
export type AttendanceUiStatus = "not_started" | "draft" | "done" | "absent";
export type AttendanceWorkInputType = "tick" | "quantity";
export type AttendanceWorkPricingRule = "flat_tick" | "quantity_full" | "quantity_excess_over_quota";

export type AttendanceEmployee = {
  id: number;
  display_name: string;
  team: AttendanceTeam;
  is_active: boolean;
  user_id: number | null;
  legacy_employee_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceEmployeeCreatePayload = {
  display_name: string;
  team: AttendanceTeam;
  is_active?: boolean;
  user_id?: number | null;
  legacy_employee_id?: number | null;
};

export type AttendanceEmployeeUpdatePayload = {
  display_name?: string;
  team?: AttendanceTeam;
  is_active?: boolean;
  user_id?: number | null;
  legacy_employee_id?: number | null;
};

export type AttendanceEmployeeDeleteResult = {
  employee_id: number;
  action: "hard_deleted" | "deactivated" | string;
};

export type AttendancePeriod = {
  id: number;
  start_date: string;
  end_date: string;
  locked: boolean;
  legacy_period_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceReference = {
  teams: AttendanceTeam[];
  record_statuses: AttendanceRecordStatus[];
};

export type AttendanceWorkType = {
  id: number;
  name: string;
  team: AttendanceTeam;
  input_type: AttendanceWorkInputType;
  pricing_rule: AttendanceWorkPricingRule;
  quota_quantity: string | null;
  unit_price: string;
  exclusive_group: string | null;
  is_active: boolean;
  legacy_work_type_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceWorkTypeCreatePayload = {
  name: string;
  input_type: AttendanceWorkInputType;
  pricing_rule: AttendanceWorkPricingRule;
  quota_quantity?: string | null;
  unit_price: string;
  exclusive_group?: string | null;
  is_active?: boolean;
  legacy_work_type_id?: number | null;
};

export type AttendanceWorkTypeUpdatePayload = {
  name: string;
  input_type: AttendanceWorkInputType;
  pricing_rule: AttendanceWorkPricingRule;
  quota_quantity?: string | null;
  unit_price: string;
  exclusive_group?: string | null;
  is_active: boolean;
};

export type AttendanceWorkTypeSeedResult = {
  created_count: number;
  skipped_count: number;
  created_names: string[];
  skipped_names: string[];
};

export type AttendanceInventoryDiagnosticIssue = {
  issue_type: string;
  daily_record_id: number;
  employee_id: number;
  work_date: string;
  message: string;
};

export type AttendanceBagType = {
  id: number;
  name: string;
  product_id: number | null;
  product_code_base: string | null;
  product_name: string | null;
  source_product_name_snapshot: string | null;
  quota_quantity: string;
  excess_unit_price: string;
  is_active: boolean;
  is_product_linked: boolean;
  is_excluded_from_attendance: boolean;
  is_legacy: boolean;
  legacy_bag_type_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceBagTypeCreatePayload = {
  name: string;
  quota_quantity: string;
  excess_unit_price: string;
  is_active?: boolean;
  is_product_linked: boolean;
  is_excluded_from_attendance?: boolean;
  is_legacy?: boolean;
  product_id?: number | null;
  source_product_name_snapshot?: string | null;
  legacy_bag_type_id?: number | null;
};

export type AttendanceBagTypeUpdatePayload = {
  name: string;
  quota_quantity: string;
  excess_unit_price: string;
  is_active: boolean;
  is_product_linked: boolean;
  is_excluded_from_attendance: boolean;
  is_legacy: boolean;
  product_id?: number | null;
  source_product_name_snapshot?: string | null;
};

export type AttendanceCutProductSearchResult = {
  product_id: number;
  product_code_base: string;
  product_name: string;
  unit_mode: UnitMode;
  linked_bag_type_id: number | null;
  linked_bag_type_name: string | null;
  quota_quantity: string | null;
  excess_unit_price: string | null;
  is_active: boolean;
  is_excluded_from_attendance: boolean;
  is_legacy: boolean;
  is_configured_for_attendance: boolean;
};

export type AttendanceBagTypeFromProductPayload = {
  product_id: number;
  quota_quantity?: string | null;
  excess_unit_price?: string | null;
};

export type AttendanceDayEntryStatusRow = {
  id: number;
  display_name: string;
  team: AttendanceTeam;
  is_active: boolean;
  status: AttendanceUiStatus;
  record_status: AttendanceRecordStatus | null;
  is_absent: boolean;
};

export type AttendanceWorkLogValue = {
  work_type_id: number;
  quantity: string;
  unit_price_snapshot: string;
  amount_snapshot: string;
};

export type AttendanceCutLogValue = {
  bag_type_id: number;
  quantity: string;
  quota_quantity_snapshot: string | null;
  excess_unit_price_snapshot: string;
  amount_snapshot: string;
};

export type AttendanceExtraCutLogValue = {
  bag_type_id: number;
  quantity: string;
  excess_unit_price_snapshot: string;
  amount_snapshot: string;
};

export type AttendanceDayEntryDetail = {
  employee_id: number;
  display_name: string;
  team: AttendanceTeam;
  selected_date: string;
  status: AttendanceUiStatus;
  record_status: AttendanceRecordStatus | null;
  is_absent: boolean;
  total_amount_snapshot: string;
  work_types: AttendanceWorkType[];
  bag_types: AttendanceBagType[];
  work_logs: AttendanceWorkLogValue[];
  cut_logs: AttendanceCutLogValue[];
  extra_cut_logs: AttendanceExtraCutLogValue[];
};

export type AttendanceWorkLogItemPayload = {
  work_type_id: number;
  quantity?: string | null;
};

export type AttendanceCutLogItemPayload = {
  bag_type_id: number;
  quantity: string;
};

export type AttendanceExtraCutLogItemPayload = {
  bag_type_id: number;
  quantity: string;
};

export type AttendanceDayEntrySavePayload = {
  is_absent: boolean;
  blow_work: AttendanceWorkLogItemPayload[];
  cut_work: AttendanceCutLogItemPayload[];
  extra_cut_work: AttendanceExtraCutLogItemPayload[];
};

export type AttendanceDayEntrySaveResult = {
  record_id: number;
  status: AttendanceRecordStatus;
  is_absent: boolean;
  total_amount_snapshot: string;
};

export type AttendancePeriodReportEmployeeValue = {
  employee_id: number;
  display_name: string;
  details: Record<string, string>;
  total_amount: string;
  is_absent: boolean;
  status: AttendanceRecordStatus | null;
};

export type AttendancePeriodReportRow = {
  work_date: string;
  employee_values: AttendancePeriodReportEmployeeValue[];
  day_total: string;
};

export type AttendancePeriodReportEmployeeSummary = {
  employee_id: number;
  display_name: string;
  total_amount: string;
  paid_workdays: number;
};

export type AttendancePeriodReport = {
  team: AttendanceTeam;
  period_id: number;
  start_date: string;
  end_date: string;
  detail_labels: string[];
  employee_summaries: AttendancePeriodReportEmployeeSummary[];
  rows: AttendancePeriodReportRow[];
  grand_total: string;
  total_paid_workdays: number;
};

export type AttendanceMonthlyReportRow = {
  employee_id: number;
  display_name: string;
  details: Record<string, string>;
  total_amount: string;
  paid_workdays: number;
};

export type AttendanceMonthlyReport = {
  team: AttendanceTeam;
  month: string;
  month_start: string;
  month_end: string;
  detail_labels: string[];
  rows: AttendanceMonthlyReportRow[];
  grand_total: string;
  total_paid_workdays: number;
};
