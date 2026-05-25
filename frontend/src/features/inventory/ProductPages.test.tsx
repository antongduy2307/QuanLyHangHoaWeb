import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockInventorySession } from "../../tests/appTestHarness";
import { renderRoute } from "../../tests/testUtils";

describe("inventory products", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders product list", async () => {
    mockInventorySession("owner");
    renderRoute("/inventory/products");

    expect(await screen.findByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByText("Gao Thom")).toBeInTheDocument();
  });

  it("renders product detail and stock movement links", async () => {
    mockInventorySession("owner");
    renderRoute("/inventory/products/10");

    expect(await screen.findByText("Lịch sử tồn kho")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hóa đơn #51" })).toHaveAttribute("href", "/sales/invoices/51");
  });

  it("blocks read_only product create route", async () => {
    mockInventorySession("read_only");
    renderRoute("/inventory/products/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });
});
