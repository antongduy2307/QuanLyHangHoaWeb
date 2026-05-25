import { useQuery } from "@tanstack/react-query";

import { listHistory } from "../../api/history";
import type { HistoryEventType } from "../../api/types";

export const historyKeys = {
  all: ["history"] as const,
  list: (
    search: string,
    dateFrom: string,
    dateTo: string,
    eventType: HistoryEventType | "",
    customerId?: number | null,
    productId?: number | null,
    page = 1,
    pageSize = 50,
  ) =>
    [
      ...historyKeys.all,
      "list",
      {
        search,
        dateFrom,
        dateTo,
        eventType,
        customerId: customerId ?? null,
        productId: productId ?? null,
        page,
        pageSize,
      },
    ] as const,
};

export function useHistory(
  search = "",
  dateFrom = "",
  dateTo = "",
  eventType: HistoryEventType | "" = "",
  customerId?: number | null,
  productId?: number | null,
  page = 1,
  pageSize = 50,
) {
  return useQuery({
    queryKey: historyKeys.list(search, dateFrom, dateTo, eventType, customerId, productId, page, pageSize),
    queryFn: () =>
      listHistory({
        search,
        dateFrom,
        dateTo,
        eventType,
        customerId: customerId ?? undefined,
        productId: productId ?? undefined,
        page,
        pageSize,
      }),
    placeholderData: (previousData) => previousData,
  });
}
