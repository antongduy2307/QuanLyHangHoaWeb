import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockAttendanceCutLinkingSession } from "../../tests/attendanceHarness";
import { renderRoute } from "../../tests/testUtils";

describe("attendance page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders the attendance route shell", async () => {
    mockAttendanceCutLinkingSession("attendance_manager");
    renderRoute("/attendance");

    expect(await screen.findByRole("heading", { name: "Chấm công" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chấm công" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Báo cáo" })).toBeInTheDocument();
  });

  it("cut search finds configured cut items and inventory products, then adds a row", async () => {
    const fetchMock = mockAttendanceCutLinkingSession("attendance_manager");
    const testUser = userEvent.setup();
    renderRoute("/attendance");

    expect(await screen.findByRole("heading", { name: "Chấm công" })).toBeInTheDocument();
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.click(await screen.findByText("Cut B"));

    const searchInput = await screen.findByLabelText("Tìm mặt hàng cắt");
    await testUser.type(searchInput, "BAO");

    expect(await screen.findByRole("button", { name: "Bao 25kg (BAO-25)" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Bao New Product (BAO-NEW) · Cần cấu hình" })).toBeInTheDocument();

    await testUser.click(screen.getByRole("button", { name: "Bao 25kg (BAO-25)" }));
    expect(await screen.findByLabelText("Số lượng Bao 25kg")).toBeInTheDocument();

    await testUser.clear(searchInput);
    await testUser.type(searchInput, "NEW");
    await testUser.click(await screen.findByRole("button", { name: "Bao New Product (BAO-NEW) · Cần cấu hình" }));
    await testUser.type(screen.getByLabelText("Cấu hình mặt hàng cắt định mức"), "20");
    await testUser.type(screen.getByLabelText("Cấu hình mặt hàng cắt đơn giá vượt"), "10000");
    await testUser.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/attendance/cut-work-items/from-product"),
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByLabelText("Số lượng Bao New Product")).toBeInTheDocument();
  });

  it("blow form shows VK section and total preview includes VK", async () => {
    const fetchMock = mockAttendanceCutLinkingSession("attendance_manager");
    const testUser = userEvent.setup();
    renderRoute("/attendance");

    expect(await screen.findByRole("heading", { name: "Chấm công" })).toBeInTheDocument();
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.click(await screen.findByText("Blow A"));

    expect(await screen.findByText("Làm thêm cắt / VK")).toBeInTheDocument();
    await testUser.click(screen.getByLabelText("Có làm thêm cắt"));
    await testUser.click(screen.getByRole("button", { name: "VK Bich (VK-BICH)" }));
    await testUser.type(screen.getByLabelText("Số lượng VK VK Bich"), "2");

    expect(screen.getByText("10.000")).toBeInTheDocument();

    await testUser.click(screen.getByRole("button", { name: "Lưu chính thức" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/attendance/day-entry/1?"),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("\"extra_cut_work\":[{\"bag_type_id\":13,\"quantity\":\"2\"}]"),
        }),
      );
    });
  });
});
