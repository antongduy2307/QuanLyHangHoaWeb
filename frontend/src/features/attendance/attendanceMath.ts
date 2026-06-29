import type { AttendanceBagType, AttendanceWorkType } from "../../api/types";

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round(value);
}

export function computeBlowPreviewTotal(
  workTypes: AttendanceWorkType[],
  quantityValues: Record<number, string>,
  tickValues: Record<number, boolean>,
  extraCutRows: Array<{ bag_type_id: number; quantity: string }>,
  bagTypes: AttendanceBagType[],
) {
  let total = 0;

  for (const workType of workTypes) {
    if (workType.input_type === "tick") {
      if (tickValues[workType.id]) {
        total += roundMoney(toNumber(workType.unit_price));
      }
      continue;
    }

    const quantity = toNumber(quantityValues[workType.id]);
    if (quantity <= 0) {
      continue;
    }

    if (workType.pricing_rule === "quantity_excess_over_quota") {
      total += roundMoney(Math.max(0, quantity - toNumber(workType.quota_quantity)) * toNumber(workType.unit_price));
      continue;
    }

    total += roundMoney(quantity * toNumber(workType.unit_price));
  }

  for (const row of extraCutRows) {
    const bagType = bagTypes.find((item) => item.id === row.bag_type_id);
    if (!bagType) {
      continue;
    }
    const quantity = toNumber(row.quantity);
    if (quantity <= 0) {
      continue;
    }
    total += roundMoney(quantity * toNumber(bagType.excess_unit_price));
  }

  return total;
}

export function computeCutPreviewTotal(
  cutRows: Array<{ bag_type_id: number; quantity: string }>,
  bagTypes: AttendanceBagType[],
) {
  const activeRows = cutRows
    .map((row) => ({ row, bagType: bagTypes.find((item) => item.id === row.bag_type_id) }))
    .filter((item): item is { row: { bag_type_id: number; quantity: string }; bagType: AttendanceBagType } => Boolean(item.bagType))
    .map(({ row, bagType }) => ({
      bag_type_id: row.bag_type_id,
      quantity: toNumber(row.quantity),
      quota: toNumber(bagType.quota_quantity),
      price: toNumber(bagType.excess_unit_price),
    }))
    .filter((item) => item.quantity > 0);

  if (activeRows.length === 0) {
    return 0;
  }

  const totalQuantity = activeRows.reduce((sum, item) => sum + item.quantity, 0);
  const quotaAverage = activeRows.reduce((sum, item) => sum + item.quota, 0) / activeRows.length;
  if (totalQuantity <= quotaAverage) {
    return 0;
  }

  if (activeRows.some((item) => item.quantity >= item.quota)) {
    return activeRows.reduce((sum, item) => {
      const lineAmount = item.quantity >= item.quota
        ? Math.max(0, item.quantity - item.quota) * item.price
        : item.quantity * item.price;
      return sum + roundMoney(lineAmount);
    }, 0);
  }

  return activeRows.reduce((sum, item) => {
    const lineAmount = Math.max(0, item.quantity - (item.quota / activeRows.length)) * item.price;
    return sum + roundMoney(lineAmount);
  }, 0);
}
