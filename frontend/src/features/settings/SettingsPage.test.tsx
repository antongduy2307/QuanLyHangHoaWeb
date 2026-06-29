import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockAttendanceCutLinkingSession } from "../../tests/attendanceHarness";
import { renderRoute } from "../../tests/testUtils";

describe("settings attendance editor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders the real attendance settings editor inside /settings", async () => {
    mockAttendanceCutLinkingSession("owner");
    renderRoute("/settings");

    expect(await screen.findByRole("heading", { name: "Cài đặt" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Chấm công" }));
    expect(await screen.findByRole("heading", { name: "Tổ thổi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tổ cắt" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Diagnostics" })).toBeInTheDocument();
  });

  it("seed defaults button works and attendance_manager can mutate", async () => {
    const fetchMock = mockAttendanceCutLinkingSession("attendance_manager", { noWorkTypesInitially: true });
    const testUser = userEvent.setup();
    renderRoute("/settings");

    expect(await screen.findByRole("heading", { name: "Cài đặt" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Tạo mặc định" })).toBeInTheDocument();
    await testUser.click(screen.getByRole("button", { name: "Tạo mặc định" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/attendance/work-types/seed-defaults"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("read_only cannot mutate attendance settings", async () => {
    mockAttendanceCutLinkingSession("read_only");
    renderRoute("/settings");

    expect(await screen.findByRole("heading", { name: "Cài đặt" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Chấm công" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo mặc định" })).not.toBeInTheDocument();
  });

  it("create, edit, and deactivate blow work type then attendance day-entry reflects the change", async () => {
    const testUser = userEvent.setup();
    mockAttendanceCutLinkingSession("owner");

    const view = renderRoute("/settings");
    expect(await screen.findByRole("heading", { name: "Cài đặt" })).toBeInTheDocument();
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.type(screen.getByLabelText("Tên công việc"), "Làm mẫu");
    await testUser.type(screen.getByLabelText("Đơn giá"), "60000");
    await testUser.click(screen.getByRole("button", { name: "Tạo công việc" }));

    await act(async () => {
      await view.router.navigate("/attendance");
    });
    await testUser.click(await screen.findByRole("tab", { name: "Chấm công" }));
    await testUser.click(await screen.findByText("Blow A"));
    expect(await screen.findByLabelText("Làm mẫu")).toBeInTheDocument();

    await act(async () => {
      await view.router.navigate("/settings");
    });
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.click(screen.getAllByRole("button", { name: "Sửa" })[0]);
    await testUser.clear(screen.getByLabelText("Tên công việc"));
    await testUser.type(screen.getByLabelText("Tên công việc"), "Làm mẫu mới");
    await testUser.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await act(async () => {
      await view.router.navigate("/attendance");
    });
    await testUser.click(await screen.findByRole("tab", { name: "Chấm công" }));
    await testUser.click(await screen.findByText("Blow A"));
    expect(await screen.findByLabelText("Làm mẫu mới")).toBeInTheDocument();

    await act(async () => {
      await view.router.navigate("/settings");
    });
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.click(screen.getAllByRole("button", { name: "Ngừng dùng" })[0]);

    await act(async () => {
      await view.router.navigate("/attendance");
    });
    await testUser.click(await screen.findByRole("tab", { name: "Chấm công" }));
    await testUser.click(await screen.findByText("Blow A"));
    expect(screen.queryByLabelText("Làm mẫu mới")).not.toBeInTheDocument();
  });

  it("create, edit, and exclude cut item then day-entry reflects future behavior while history keeps snapshot", async () => {
    const testUser = userEvent.setup();
    mockAttendanceCutLinkingSession("owner");

    const view = renderRoute("/settings");
    expect(await screen.findByRole("heading", { name: "Cài đặt" })).toBeInTheDocument();
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.type(screen.getByLabelText("Tìm sản phẩm để liên kết"), "BAO-NEW");
    await testUser.click(await screen.findByRole("button", { name: "Bao New Product (BAO-NEW) · Cần cấu hình" }));
    await testUser.type(screen.getByLabelText("Quota"), "20");
    await testUser.type(screen.getByLabelText("Đơn giá vượt"), "10000");
    await testUser.click(screen.getByRole("button", { name: "Lưu liên kết" }));

    await act(async () => {
      await view.router.navigate("/attendance");
    });
    await testUser.click(await screen.findByRole("tab", { name: "Chấm công" }));
    await testUser.click(await screen.findByText("Cut B"));
    await testUser.type(screen.getByLabelText("Tìm mặt hàng cắt"), "BAO-NEW");
    await testUser.click(await screen.findByRole("button", { name: "Bao New Product (BAO-NEW)" }));
    await testUser.type(screen.getByLabelText("Số lượng Bao New Product"), "25");
    await testUser.click(screen.getByRole("button", { name: "Lưu chính thức" }));
    await waitFor(() => {
      expect(screen.getAllByText("50.000").length).toBeGreaterThan(0);
    });

    await act(async () => {
      await view.router.navigate("/settings");
    });
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.click(screen.getAllByRole("button", { name: "Sửa" }).at(-1)!);
    await testUser.clear(screen.getByLabelText("Đơn giá vượt"));
    await testUser.type(screen.getByLabelText("Đơn giá vượt"), "12000");
    await testUser.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await act(async () => {
      await view.router.navigate("/attendance");
    });
    await testUser.click(await screen.findByRole("tab", { name: "Chấm công" }));
    await testUser.clear(screen.getByLabelText("Ngày chấm công"));
    await testUser.type(screen.getByLabelText("Ngày chấm công"), "2026-05-31");
    await testUser.click(await screen.findByText("Cut B"));
    await testUser.type(screen.getByLabelText("Tìm mặt hàng cắt"), "BAO-NEW");
    await testUser.click(await screen.findByRole("button", { name: "Bao New Product (BAO-NEW)" }));
    await testUser.clear(screen.getByLabelText("Số lượng Bao New Product"));
    await testUser.type(screen.getByLabelText("Số lượng Bao New Product"), "30");
    expect(screen.getByText("12.000")).toBeInTheDocument();

    await act(async () => {
      await view.router.navigate("/settings");
    });
    await testUser.click(screen.getByRole("tab", { name: "Chấm công" }));
    await testUser.click(screen.getAllByRole("button", { name: "Sửa" }).at(-1)!);
    await testUser.click(screen.getByLabelText("Loại khỏi chấm công mới"));
    await testUser.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await act(async () => {
      await view.router.navigate("/attendance");
    });
    await testUser.click(await screen.findByRole("tab", { name: "Chấm công" }));
    await testUser.clear(screen.getByLabelText("Ngày chấm công"));
    await testUser.type(screen.getByLabelText("Ngày chấm công"), "2026-05-31");
    await testUser.click(await screen.findByText("Cut B"));
    await testUser.type(screen.getByLabelText("Tìm mặt hàng cắt"), "BAO-NEW");
    expect(screen.queryByRole("button", { name: "Bao New Product (BAO-NEW)" })).not.toBeInTheDocument();

    await testUser.clear(screen.getByLabelText("Ngày chấm công"));
    await testUser.type(screen.getByLabelText("Ngày chấm công"), "2026-05-30");
    expect(await screen.findByText("10.000")).toBeInTheDocument();
  }, 15000);

  it("renders diagnostics summary", async () => {
    mockAttendanceCutLinkingSession("owner");
    renderRoute("/settings");

    expect(await screen.findByRole("heading", { name: "Cài đặt" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Chấm công" }));
    expect(await screen.findByText("Thiếu inventory effect")).toBeInTheDocument();
    expect(screen.getByText("Sai liên kết hàng hóa")).toBeInTheDocument();
  });
});
