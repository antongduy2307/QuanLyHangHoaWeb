import type { HistoryEvent } from "../../api/types";
import { adminRoutes } from "../../domain/routes";
import { formatMoney } from "../../domain/money";

export const historyEventTypeOptions = [
  { value: "", label: "Tất cả giao dịch", chip: "Tất cả" },
  { value: "SALES_INVOICE", label: "Hóa đơn bán hàng", chip: "Bán hàng" },
  { value: "RETURN_INVOICE", label: "Phiếu trả hàng", chip: "Trả hàng" },
  { value: "DEBT_PAYMENT", label: "Thanh toán công nợ", chip: "Công nợ" },
  { value: "BALANCE_ADJUSTMENT", label: "Điều chỉnh công nợ", chip: "Điều chỉnh" },
  { value: "STOCK_MOVEMENT", label: "Biến động tồn kho", chip: "Tồn kho" },
  { value: "ORDER", label: "Đặt hàng", chip: "Đặt hàng" },
] as const;

const eventTypeLabelMap = new Map<string, string>(historyEventTypeOptions.map((option) => [option.value, option.label]));
const eventTypeChipMap = new Map<string, string>(historyEventTypeOptions.map((option) => [option.value, option.chip]));

export function historyEventTypeLabel(value: string) {
  return eventTypeLabelMap.get(value) ?? value;
}

export function historyEventTypeChip(value: string) {
  return eventTypeChipMap.get(value) ?? value;
}

export function historyStatusLabel(event: HistoryEvent) {
  if (!event.status) {
    return "-";
  }
  if (event.event_type === "ORDER") {
    if (event.status === "OPEN") return "Đang mở";
    if (event.status === "PREPARED") return "Đã hoàn thành";
    if (event.status === "CONVERTED") return "Đã chuyển bán";
  }
  if (event.event_type === "STOCK_MOVEMENT") {
    if (event.status === "SALE") return "Xuất bán";
    if (event.status === "RETURN") return "Nhập trả";
    if (event.status === "STOCK_INCREASE") return "Tăng tồn";
    if (event.status === "STOCK_DECREASE") return "Giảm tồn";
    if (event.status === "STOCK_SET") return "Đặt tồn";
  }
  if (event.event_type === "RETURN_INVOICE") {
    if (event.status === "REFUND_NOW") return "Hoàn tiền";
    if (event.status === "STORE_CREDIT") return "Cấn công nợ";
  }
  return event.status;
}

export function historyValueSummary(event: HistoryEvent) {
  const lines: string[] = [];
  if (event.event_type === "SALES_INVOICE") {
    if (event.amount !== null) {
      lines.push(`Tổng tiền ${formatMoney(event.amount)}`);
    }
    if (event.paid_amount !== null) {
      lines.push(`Đã thanh toán ${formatMoney(event.paid_amount)}`);
    }
    if (event.item_count !== null) {
      lines.push(`${event.item_count} mặt hàng`);
    }
    return lines.length > 0 ? lines : ["-"];
  }
  if (event.event_type === "RETURN_INVOICE") {
    if (event.amount !== null) {
      lines.push(`Tổng trả ${formatMoney(event.amount)}`);
    }
    if (event.item_count !== null) {
      lines.push(`${event.item_count} mặt hàng`);
    }
    return lines.length > 0 ? lines : ["-"];
  }
  if (event.amount !== null) {
    lines.push(`Giá trị ${formatMoney(event.amount)}`);
  }
  if (event.quantity !== null) {
    lines.push(
      `Số lượng ${Number(event.quantity).toLocaleString("vi-VN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      })}${event.unit_type ? ` ${event.unit_type}` : ""}`,
    );
  }
  return lines.length > 0 ? lines : ["-"];
}

export function resolveHistoryOpenLink(event: HistoryEvent) {
  const target = event.open_target;
  if (!target || target.target_type === "order") {
    return null;
  }
  if (target.route) {
    return target.route;
  }
  if (target.target_type === "invoice") {
    return `${adminRoutes.invoiceHistory}/${target.target_id}`;
  }
  if (target.target_type === "return") {
    return `${adminRoutes.returns}/${target.target_id}`;
  }
  if (target.target_type === "customer") {
    return `${adminRoutes.customers}/${target.target_id}`;
  }
  if (target.target_type === "product") {
    return `${adminRoutes.products}/${target.target_id}`;
  }
  return null;
}
