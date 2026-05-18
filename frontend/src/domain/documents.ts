export function formatQuantity(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(numericValue);
}

export function unitLabel(unitType: string) {
  const labels: Record<string, string> = {
    BAO: "Bao",
    KG: "Kg",
    BICH: "Bich",
  };
  return labels[unitType] || unitType;
}

export function invoiceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    COMPLETED: "Hoan tat",
  };
  return labels[status] || status;
}

export function returnHandlingModeLabel(mode: string) {
  const labels: Record<string, string> = {
    REFUND_NOW: "Hoan tien",
    STORE_CREDIT: "Tru cong no",
  };
  return labels[mode] || mode;
}
