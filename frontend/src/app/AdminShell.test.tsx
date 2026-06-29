import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { adminRoutes } from "../domain/routes";
import {
  mockAttendanceSession,
  mockAuthenticatedSession,
  mockCustomerSession,
  mockInventorySession,
  mockReturnsSession,
  mockSalesSession,
} from "../tests/appTestHarness";
import { renderRoute } from "../tests/testUtils";

describe("admin shell", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("redirects anonymous users to login", async () => {
    renderRoute("/inventory/products");
    expect(await screen.findByRole("heading", { name: "Dang nhap" })).toBeInTheDocument();
  });

  it("renders current navigation links", async () => {
    mockAuthenticatedSession("admin");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("href", adminRoutes.dashboard);
    expect(screen.getByRole("link", { name: "Chấm công" })).toHaveAttribute("href", adminRoutes.attendance);
    expect(screen.getByRole("link", { name: "Hàng hóa" })).toHaveAttribute("href", adminRoutes.products);
    expect(screen.getByRole("link", { name: "Khách hàng" })).toHaveAttribute("href", adminRoutes.customers);
    expect(screen.getByRole("link", { name: "Lịch sử" })).toHaveAttribute("href", adminRoutes.history);
    expect(screen.getByRole("link", { name: "Bán hàng" })).toHaveAttribute("href", adminRoutes.invoices);
    expect(screen.getByRole("link", { name: "Đặt hàng" })).toHaveAttribute("href", adminRoutes.orders);
    expect(screen.getByRole("link", { name: "Báo cáo" })).toHaveAttribute("href", adminRoutes.reports);
    expect(screen.getByRole("link", { name: "Cài đặt" })).toHaveAttribute("href", adminRoutes.settings);
  });

  it("renders current pages for read_only", async () => {
    mockInventorySession("read_only");
    renderRoute("/inventory/products");
    expect(await screen.findByText("GAO-01")).toBeInTheDocument();

    mockCustomerSession("read_only");
    renderRoute("/customers");
    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();

    mockSalesSession("read_only");
    renderRoute("/sales/invoices");
    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();

    mockReturnsSession("read_only");
    renderRoute("/returns");
    expect(await screen.findByText("TR20260517-001")).toBeInTheDocument();
  });

  it("blocks forbidden shell roles", async () => {
    mockAuthenticatedSession("employee");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });

  it("allows attendance_manager into the attendance route without the full admin shell", async () => {
    mockAttendanceSession("attendance_manager");
    renderRoute("/attendance");

    expect(await screen.findByRole("heading", { name: "Chấm công" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chấm công" })).toHaveAttribute("href", adminRoutes.attendance);
  });
});
