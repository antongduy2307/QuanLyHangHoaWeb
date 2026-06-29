import { vi } from "vitest";

import { setRefreshToken } from "../auth/tokenStore";
import type { UserRole } from "../domain/roles";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function user(role: UserRole) {
  return {
    id: 1,
    username: `${role}_user`,
    display_name: `${role} user`,
    role,
    is_active: true,
  };
}

type MockOptions = {
  noWorkTypesInitially?: boolean;
};

type WorkType = {
  id: number;
  name: string;
  team: "blow";
  input_type: "tick" | "quantity";
  pricing_rule: "flat_tick" | "quantity_full" | "quantity_excess_over_quota";
  quota_quantity: string | null;
  unit_price: string;
  exclusive_group: string | null;
  is_active: boolean;
  legacy_work_type_id: number | null;
  created_at: string;
  updated_at: string;
};

type BagType = {
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

type DailyRecord = {
  record_id: number;
  employee_id: number;
  selected_date: string;
  status: "draft" | "done";
  is_absent: boolean;
  total_amount_snapshot: string;
  blow_work: Array<{ work_type_id: number; quantity: string | null; unit_price_snapshot: string; amount_snapshot: string }>;
  cut_work: Array<{
    bag_type_id: number;
    quantity: string;
    quota_quantity_snapshot: string | null;
    excess_unit_price_snapshot: string;
    amount_snapshot: string;
  }>;
  extra_cut_work: Array<{ bag_type_id: number; quantity: string; excess_unit_price_snapshot: string; amount_snapshot: string }>;
};

export function mockAttendanceCutLinkingSession(role: UserRole, options: MockOptions = {}) {
  setRefreshToken("stored-refresh");

  let nextWorkTypeId = 20;
  let nextBagTypeId = 40;
  let nextRecordId = 1;

  const employees = [
    {
      id: 1,
      display_name: "Blow A",
      team: "blow",
      is_active: true,
      user_id: null,
      legacy_employee_id: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
    },
    {
      id: 2,
      display_name: "Cut B",
      team: "cut",
      is_active: true,
      user_id: null,
      legacy_employee_id: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
    },
  ];

  let workTypes: WorkType[] = options.noWorkTypesInitially ? [] : [
    { id: 1, name: "Thừa máy", team: "blow", input_type: "quantity", pricing_rule: "quantity_excess_over_quota", quota_quantity: "3", unit_price: "80000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 2, name: "Máy nhỏ", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "30000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 3, name: "Máy to", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "40000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 4, name: "Phụ cắt", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "50000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 5, name: "Phụ găng 1 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "30000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 6, name: "Phụ găng 2 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "50000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];

  const products = [
    { id: 101, product_code_base: "BAO-25", product_name: "Bao 25kg Product", unit_mode: "BAO_KG", is_active: true },
    { id: 102, product_code_base: "BAO-50", product_name: "Bao 50kg Product", unit_mode: "BAO_KG", is_active: true },
    { id: 103, product_code_base: "VK-BICH", product_name: "VK Bich Product", unit_mode: "BICH", is_active: true },
    { id: 104, product_code_base: "BAO-NEW", product_name: "Bao New Product", unit_mode: "BAO_KG", is_active: true },
  ];

  let bagTypes: BagType[] = [
    { id: 11, name: "Bao 25kg", product_id: 101, product_code_base: "BAO-25", product_name: "Bao 25kg Product", source_product_name_snapshot: "Bao 25kg Product", quota_quantity: "25", excess_unit_price: "3500", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 12, name: "Bao 50kg", product_id: 102, product_code_base: "BAO-50", product_name: "Bao 50kg Product", source_product_name_snapshot: "Bao 50kg Product", quota_quantity: "30", excess_unit_price: "4200", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
    { id: 13, name: "VK Bich", product_id: 103, product_code_base: "VK-BICH", product_name: "VK Bich Product", source_product_name_snapshot: "VK Bich Product", quota_quantity: "20", excess_unit_price: "5000", is_active: true, is_product_linked: true, is_excluded_from_attendance: false, is_legacy: false, legacy_bag_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
  ];

  const records = new Map<string, DailyRecord>();

  function key(employeeId: number, selectedDate: string) {
    return `${employeeId}:${selectedDate}`;
  }

  function roundMoney(value: number) {
    return String(Math.round(value));
  }

  function quantity(value: string | number) {
    return Number(value).toFixed(3);
  }

  function activeBlowWorkTypes() {
    return workTypes.filter((item) => item.is_active);
  }

  function selectableBagTypes() {
    return bagTypes.filter((item) => item.is_active && item.is_product_linked && !item.is_excluded_from_attendance && !item.is_legacy);
  }

  function findBagType(bagTypeId: number) {
    return bagTypes.find((item) => item.id === bagTypeId);
  }

  function computeBlowSnapshots(blowWork: Array<{ work_type_id: number; quantity: string | null }>) {
    return blowWork.flatMap((item) => {
      const workType = workTypes.find((row) => row.id === item.work_type_id);
      if (!workType) {
        return [];
      }
      if (workType.input_type === "tick") {
        return [{
          work_type_id: item.work_type_id,
          quantity: "1.000",
          unit_price_snapshot: workType.unit_price,
          amount_snapshot: Number(item.quantity ?? "1") > 0 ? workType.unit_price : "0",
        }];
      }
      const qty = Number(item.quantity ?? "0");
      const amount = workType.pricing_rule === "quantity_excess_over_quota"
        ? roundMoney(Math.max(0, qty - Number(workType.quota_quantity ?? "0")) * Number(workType.unit_price))
        : roundMoney(qty * Number(workType.unit_price));
      if (qty <= 0) {
        return [];
      }
      return [{
        work_type_id: item.work_type_id,
        quantity: quantity(qty),
        unit_price_snapshot: workType.unit_price,
        amount_snapshot: amount,
      }];
    });
  }

  function computeCutSnapshots(cutWork: Array<{ bag_type_id: number; quantity: string }>) {
    const activeRows = cutWork
      .map((item) => ({ item, bagType: findBagType(item.bag_type_id) }))
      .filter((row): row is { item: { bag_type_id: number; quantity: string }; bagType: BagType } => Boolean(row.bagType))
      .map(({ item, bagType }) => ({
        bag_type_id: item.bag_type_id,
        quantity: Number(item.quantity),
        quota: Number(bagType.quota_quantity),
        price: Number(bagType.excess_unit_price),
      }))
      .filter((row) => row.quantity > 0);

    const snapshots: DailyRecord["cut_work"] = [];
    if (activeRows.length === 0) {
      return { total: "0", snapshots };
    }

    const totalQuantity = activeRows.reduce((sum, row) => sum + row.quantity, 0);
    const quotaAverage = activeRows.reduce((sum, row) => sum + row.quota, 0) / activeRows.length;
    if (totalQuantity <= quotaAverage) {
      for (const row of activeRows) {
        snapshots.push({
          bag_type_id: row.bag_type_id,
          quantity: quantity(row.quantity),
          quota_quantity_snapshot: String(row.quota),
          excess_unit_price_snapshot: String(row.price),
          amount_snapshot: "0",
        });
      }
      return { total: "0", snapshots };
    }

    if (activeRows.some((row) => row.quantity >= row.quota)) {
      let total = 0;
      for (const row of activeRows) {
        const lineAmount = row.quantity >= row.quota ? Math.max(0, row.quantity - row.quota) * row.price : row.quantity * row.price;
        const rounded = Math.round(lineAmount);
        total += rounded;
        snapshots.push({
          bag_type_id: row.bag_type_id,
          quantity: quantity(row.quantity),
          quota_quantity_snapshot: String(row.quota),
          excess_unit_price_snapshot: String(row.price),
          amount_snapshot: String(rounded),
        });
      }
      return { total: String(total), snapshots };
    }

    let total = 0;
    for (const row of activeRows) {
      const lineAmount = Math.max(0, row.quantity - (row.quota / activeRows.length)) * row.price;
      const rounded = Math.round(lineAmount);
      total += rounded;
      snapshots.push({
        bag_type_id: row.bag_type_id,
        quantity: quantity(row.quantity),
        quota_quantity_snapshot: String(row.quota),
        excess_unit_price_snapshot: String(row.price),
        amount_snapshot: String(rounded),
      });
    }
    return { total: String(total), snapshots };
  }

  function computeExtraCutSnapshots(extraCutWork: Array<{ bag_type_id: number; quantity: string }>) {
    const snapshots = extraCutWork.flatMap((item) => {
      const bagType = findBagType(item.bag_type_id);
      if (!bagType || Number(item.quantity) <= 0) {
        return [];
      }
      return [{
        bag_type_id: item.bag_type_id,
        quantity: quantity(item.quantity),
        excess_unit_price_snapshot: bagType.excess_unit_price,
        amount_snapshot: roundMoney(Number(item.quantity) * Number(bagType.excess_unit_price)),
      }];
    });
    const total = snapshots.reduce((sum, item) => sum + Number(item.amount_snapshot), 0);
    return { total: String(total), snapshots };
  }

  function buildStatusRow(employee: (typeof employees)[number], selectedDate: string) {
    const record = records.get(key(employee.id, selectedDate));
    const status = !record ? "not_started" : record.is_absent ? "absent" : record.status === "done" ? "done" : "draft";
    return {
      id: employee.id,
      display_name: employee.display_name,
      team: employee.team,
      is_active: employee.is_active,
      status,
      record_status: record?.status ?? null,
      is_absent: record?.is_absent ?? false,
    };
  }

  function buildDetail(employeeId: number, selectedDate: string) {
    const employee = employees.find((row) => row.id === employeeId)!;
    const record = records.get(key(employeeId, selectedDate));
    return {
      employee_id: employee.id,
      display_name: employee.display_name,
      team: employee.team,
      selected_date: selectedDate,
      status: buildStatusRow(employee, selectedDate).status,
      record_status: record?.status ?? null,
      is_absent: record?.is_absent ?? false,
      total_amount_snapshot: record?.total_amount_snapshot ?? "0",
      work_types: employee.team === "blow" ? activeBlowWorkTypes() : [],
      bag_types: employee.team === "blow" ? selectableBagTypes() : selectableBagTypes(),
      work_logs: record?.blow_work ?? [],
      cut_logs: record?.cut_work ?? [],
      extra_cut_logs: record?.extra_cut_work ?? [],
    };
  }

  function makeDiagnostics() {
    return [
      {
        issue_type: "finalized_record_missing_inventory_effect",
        daily_record_id: 99,
        employee_id: 2,
        work_date: "2026-05-08",
        message: "Missing inventory effect for finalized record.",
      },
      {
        issue_type: "effect_product_mismatch",
        daily_record_id: 100,
        employee_id: 2,
        work_date: "2026-05-09",
        message: "Inventory effect product does not match linked CUT item.",
      },
    ];
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/auth/refresh")) {
      return jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", token_type: "bearer", expires_in: 1800 });
    }
    if (url.endsWith("/auth/me")) {
      return jsonResponse(user(role));
    }
    if (url.endsWith("/auth/logout")) {
      return jsonResponse({ status: "ok" });
    }

    if (url.endsWith("/attendance/reference")) {
      return jsonResponse({ teams: ["blow", "cut"], record_statuses: ["draft", "done"] });
    }

    if (url.includes("/attendance/work-types/seed-defaults") && method === "POST") {
      const defaults: WorkType[] = [
        { id: 1, name: "Thừa máy", team: "blow", input_type: "quantity", pricing_rule: "quantity_excess_over_quota", quota_quantity: "3", unit_price: "80000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
        { id: 2, name: "Máy nhỏ", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "30000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
        { id: 3, name: "Máy to", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "40000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
        { id: 4, name: "Phụ cắt", team: "blow", input_type: "quantity", pricing_rule: "quantity_full", quota_quantity: null, unit_price: "50000", exclusive_group: null, is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
        { id: 5, name: "Phụ găng 1 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "30000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
        { id: 6, name: "Phụ găng 2 máy", team: "blow", input_type: "tick", pricing_rule: "flat_tick", quota_quantity: null, unit_price: "50000", exclusive_group: "glove", is_active: true, legacy_work_type_id: null, created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z" },
      ];
      if (workTypes.length === 0) {
        workTypes = defaults;
        return jsonResponse({ created_count: 6, skipped_count: 0, created_names: defaults.map((item) => item.name), skipped_names: [] });
      }
      return jsonResponse({ created_count: 0, skipped_count: defaults.length, created_names: [], skipped_names: defaults.map((item) => item.name) });
    }

    if (url.endsWith("/attendance/work-types") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const workType: WorkType = {
        id: nextWorkTypeId++,
        name: payload.name,
        team: "blow",
        input_type: payload.input_type,
        pricing_rule: payload.pricing_rule,
        quota_quantity: payload.quota_quantity,
        unit_price: String(payload.unit_price),
        exclusive_group: payload.exclusive_group ?? null,
        is_active: payload.is_active ?? true,
        legacy_work_type_id: payload.legacy_work_type_id ?? null,
        created_at: "2026-05-17T00:00:00Z",
        updated_at: "2026-05-17T00:00:00Z",
      };
      workTypes = [...workTypes, workType];
      return jsonResponse(workType, 201);
    }

    if (/\/attendance\/work-types\/\d+$/.test(url) && method === "PATCH") {
      const workTypeId = Number(url.split("/").pop());
      const payload = JSON.parse(String(init?.body ?? "{}"));
      workTypes = workTypes.map((item) => item.id === workTypeId ? { ...item, ...payload, unit_price: String(payload.unit_price), quota_quantity: payload.quota_quantity, exclusive_group: payload.exclusive_group ?? null, updated_at: "2026-05-18T00:00:00Z" } : item);
      return jsonResponse(workTypes.find((item) => item.id === workTypeId));
    }

    if (url.includes("/attendance/work-types")) {
      const parsed = new URL(url);
      const includeInactive = parsed.searchParams.get("include_inactive") === "true";
      return jsonResponse(includeInactive ? workTypes : activeBlowWorkTypes());
    }

    if (url.includes("/attendance/cut-work-items/from-product") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const product = products.find((item) => item.id === payload.product_id);
      if (!product) {
        return jsonResponse({ error: { code: "not_found", message: "Product not found." } }, 404);
      }
      if ((payload.quota_quantity ?? null) === null || (payload.excess_unit_price ?? null) === null) {
        return jsonResponse({ error: { code: "validation_error", message: "Selected product is not configured for attendance. Enter quota and excess price." } }, 422);
      }
      const existing = bagTypes.find((item) => item.product_id === product.id);
      const nextBagType: BagType = {
        id: existing?.id ?? nextBagTypeId++,
        name: product.product_name,
        product_id: product.id,
        product_code_base: product.product_code_base,
        product_name: product.product_name,
        source_product_name_snapshot: product.product_name,
        quota_quantity: String(payload.quota_quantity),
        excess_unit_price: String(payload.excess_unit_price),
        is_active: true,
        is_product_linked: true,
        is_excluded_from_attendance: false,
        is_legacy: false,
        legacy_bag_type_id: null,
        created_at: existing?.created_at ?? "2026-05-17T00:00:00Z",
        updated_at: "2026-05-17T00:00:00Z",
      };
      bagTypes = [...bagTypes.filter((item) => item.id !== nextBagType.id), nextBagType];
      return jsonResponse(nextBagType);
    }

    if (url.endsWith("/attendance/cut-work-items") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const nextBagType: BagType = {
        id: nextBagTypeId++,
        name: payload.name,
        product_id: payload.product_id ?? null,
        product_code_base: products.find((item) => item.id === payload.product_id)?.product_code_base ?? null,
        product_name: products.find((item) => item.id === payload.product_id)?.product_name ?? null,
        source_product_name_snapshot: payload.source_product_name_snapshot ?? null,
        quota_quantity: String(payload.quota_quantity),
        excess_unit_price: String(payload.excess_unit_price),
        is_active: payload.is_active ?? true,
        is_product_linked: payload.is_product_linked,
        is_excluded_from_attendance: payload.is_excluded_from_attendance ?? false,
        is_legacy: payload.is_legacy ?? false,
        legacy_bag_type_id: null,
        created_at: "2026-05-17T00:00:00Z",
        updated_at: "2026-05-17T00:00:00Z",
      };
      bagTypes = [...bagTypes, nextBagType];
      return jsonResponse(nextBagType, 201);
    }

    if (/\/attendance\/cut-work-items\/\d+$/.test(url) && method === "PATCH") {
      const bagTypeId = Number(url.split("/").pop());
      const payload = JSON.parse(String(init?.body ?? "{}"));
      bagTypes = bagTypes.map((item) => item.id === bagTypeId ? {
        ...item,
        ...payload,
        quota_quantity: String(payload.quota_quantity),
        excess_unit_price: String(payload.excess_unit_price),
        product_code_base: products.find((product) => product.id === payload.product_id)?.product_code_base ?? item.product_code_base,
        product_name: products.find((product) => product.id === payload.product_id)?.product_name ?? item.product_name,
        updated_at: "2026-05-18T00:00:00Z",
      } : item);
      return jsonResponse(bagTypes.find((item) => item.id === bagTypeId));
    }

    if (url.includes("/attendance/cut-work-items")) {
      const parsedUrl = new URL(url);
      const search = (parsedUrl.searchParams.get("search") ?? "").trim().toLowerCase();
      const includeInactive = parsedUrl.searchParams.get("include_inactive") === "true";
      const baseItems = includeInactive ? bagTypes : bagTypes.filter((item) => item.is_active);
      const filtered = search
        ? baseItems.filter((item) => [item.name, item.product_name ?? "", item.product_code_base ?? ""].join(" ").toLowerCase().includes(search))
        : baseItems;
      return jsonResponse(filtered);
    }

    if (url.includes("/attendance/cut-products/search")) {
      const parsedUrl = new URL(url);
      const search = (parsedUrl.searchParams.get("search") ?? "").trim().toLowerCase();
      const filtered = products.filter((item) => [item.product_name, item.product_code_base].join(" ").toLowerCase().includes(search));
      return jsonResponse(filtered.map((product) => {
        const linked = bagTypes.find((item) => item.product_id === product.id) ?? null;
        return {
          product_id: product.id,
          product_code_base: product.product_code_base,
          product_name: product.product_name,
          unit_mode: product.unit_mode,
          linked_bag_type_id: linked?.id ?? null,
          linked_bag_type_name: linked?.name ?? null,
          quota_quantity: linked?.quota_quantity ?? null,
          excess_unit_price: linked?.excess_unit_price ?? null,
          is_active: linked?.is_active ?? false,
          is_excluded_from_attendance: linked?.is_excluded_from_attendance ?? false,
          is_legacy: linked?.is_legacy ?? false,
          is_configured_for_attendance: Boolean(linked && linked.is_active && !linked.is_excluded_from_attendance && !linked.is_legacy),
        };
      }));
    }

    if (url.includes("/attendance/inventory-diagnostics")) {
      return jsonResponse(makeDiagnostics());
    }

    if (url.includes("/attendance/employees") && method === "GET") {
      return jsonResponse(employees);
    }

    if (url.includes("/attendance/day-entry?") && method === "GET") {
      const parsedUrl = new URL(url);
      const selectedDate = parsedUrl.searchParams.get("date") ?? "";
      return jsonResponse(employees.map((employee) => buildStatusRow(employee, selectedDate)));
    }

    if (/\/attendance\/day-entry\/\d+\?/.test(url) && method === "GET") {
      const parsedUrl = new URL(url);
      const employeeId = Number(parsedUrl.pathname.split("/").pop());
      const selectedDate = parsedUrl.searchParams.get("date") ?? "";
      return jsonResponse(buildDetail(employeeId, selectedDate));
    }

    if (/\/attendance\/day-entry\/\d+\?/.test(url) && method === "PUT") {
      const parsedUrl = new URL(url);
      const employeeId = Number(parsedUrl.pathname.split("/").pop());
      const selectedDate = parsedUrl.searchParams.get("date") ?? "";
      const finalize = parsedUrl.searchParams.get("finalize") === "true";
      const payload = JSON.parse(String(init?.body ?? "{}"));
      const employee = employees.find((row) => row.id === employeeId)!;

      if (payload.is_absent) {
        const absentRecord: DailyRecord = {
          record_id: records.get(key(employeeId, selectedDate))?.record_id ?? nextRecordId++,
          employee_id: employeeId,
          selected_date: selectedDate,
          status: finalize ? "done" : "draft",
          is_absent: true,
          total_amount_snapshot: "0",
          blow_work: [],
          cut_work: [],
          extra_cut_work: [],
        };
        records.set(key(employeeId, selectedDate), absentRecord);
        return jsonResponse({ record_id: absentRecord.record_id, status: absentRecord.status, is_absent: true, total_amount_snapshot: "0" });
      }

      const blowSnapshots = computeBlowSnapshots(payload.blow_work ?? []);
      const cutSnapshots = computeCutSnapshots(payload.cut_work ?? []);
      const extraCutSnapshots = computeExtraCutSnapshots(payload.extra_cut_work ?? []);
      const total = employee.team === "blow"
        ? String(blowSnapshots.reduce((sum, item) => sum + Number(item.amount_snapshot), 0) + Number(extraCutSnapshots.total))
        : cutSnapshots.total;

      const nextRecord: DailyRecord = {
        record_id: records.get(key(employeeId, selectedDate))?.record_id ?? nextRecordId++,
        employee_id: employeeId,
        selected_date: selectedDate,
        status: finalize ? "done" : "draft",
        is_absent: false,
        total_amount_snapshot: total,
        blow_work: blowSnapshots,
        cut_work: cutSnapshots.snapshots,
        extra_cut_work: extraCutSnapshots.snapshots,
      };
      records.set(key(employeeId, selectedDate), nextRecord);
      return jsonResponse({
        record_id: nextRecord.record_id,
        status: nextRecord.status,
        is_absent: false,
        total_amount_snapshot: nextRecord.total_amount_snapshot,
      });
    }

    if (url.includes("/attendance/reports/period")) {
      return jsonResponse({ team: "blow", period_id: 1, start_date: "2026-05-01", end_date: "2026-05-10", detail_labels: ["Máy nhỏ"], employee_summaries: [], rows: [], grand_total: "0", total_paid_workdays: 0 });
    }
    if (url.includes("/attendance/reports/monthly")) {
      return jsonResponse({ team: "blow", month: "2026-05", month_start: "2026-05-01", month_end: "2026-05-31", detail_labels: ["Máy nhỏ"], rows: [], grand_total: "0", total_paid_workdays: 0 });
    }

    return jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
