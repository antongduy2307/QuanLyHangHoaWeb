import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockCustomerSession } from "../../tests/appTestHarness";
import { renderRoute } from "../../tests/testUtils";

describe("customers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders customer list", async () => {
    mockCustomerSession("owner");
    renderRoute("/customers");

    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
  });

  it("renders customer detail and debt payment table", async () => {
    mockCustomerSession("owner");
    renderRoute("/customers/21");

    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("Tien mat")).toBeInTheDocument();
  });

  it("renders grouped customer trade history and opens document detail", async () => {
    mockCustomerSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/customers");

    await testUser.click(await screen.findByText("0909000000"));
    await testUser.click(screen.getByRole("tab", { name: /Lịch sử bán\/trả hàng/i }));

    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();
    expect(screen.getAllByText("Gao Thom").length).toBeGreaterThan(0);

    await testUser.click(screen.getByText("HD20260517-001"));
    expect(await screen.findByRole("heading", { name: "Hóa đơn bán hàng" })).toBeInTheDocument();
    expect(screen.getByText("Bao")).toBeInTheDocument();
  });

  it("customer history invoice detail returns to customer context", async () => {
    mockCustomerSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/customers");

    await testUser.click(await screen.findByText("0909000000"));
    await testUser.click(screen.getByRole("tab", { name: /Lịch sử bán\/trả hàng/i }));
    await testUser.click(screen.getByText("HD20260517-001"));
    await testUser.click(await screen.findByRole("link", { name: "Mở chi tiết" }));

    expect(await screen.findByRole("heading", { name: "Chi tiết hóa đơn" })).toBeInTheDocument();
    await testUser.click(screen.getByRole("link", { name: "Quay lại khách hàng" }));
    expect(await screen.findByRole("heading", { name: "Khách hàng" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Lịch sử bán\/trả hàng/i })).toHaveAttribute("aria-selected", "true");
  });

  it("blocks read_only create route", async () => {
    mockCustomerSession("read_only");
    renderRoute("/customers/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });
});
