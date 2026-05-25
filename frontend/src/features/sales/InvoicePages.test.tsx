import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockReturnsSession, mockSalesSession } from "../../tests/appTestHarness";
import { renderRoute } from "../../tests/testUtils";

describe("sales invoices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders invoice list", async () => {
    mockSalesSession("owner");
    renderRoute("/sales/invoices");

    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();
  });

  it("renders invoice detail in redesigned shell instead of old admin layout", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/51");

    expect(await screen.findByRole("heading", { name: "Chi ti\u1ebft h\u00f3a \u0111\u01a1n" })).toBeInTheDocument();
    expect(screen.queryByText("Admin web")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("\u0110i\u1ec1u h\u01b0\u1edbng ch\u00ednh")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Bán hàng" })).toHaveClass("active");
  });

  it("renders invoice detail summary fields and item table", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/51");

    expect(await screen.findByText("HD20260517-001")).toBeInTheDocument();
    expect(screen.getByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("Giao buoi sang")).toBeInTheDocument();
    expect(screen.getByText("GAO-01")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "M\u00e3 h\u00e0ng" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "T\u00ean h\u00e0ng" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "\u0110\u01a1n v\u1ecb" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "S\u1ed1 l\u01b0\u1ee3ng" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "\u0110\u01a1n gi\u00e1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Th\u00e0nh ti\u1ec1n" })).toBeInTheDocument();
    expect(screen.getByText("Tr\u1ea1ng th\u00e1i")).toBeInTheDocument();
    expect(screen.getByText("C\u00f2n l\u1ea1i")).toBeInTheDocument();
  });

  it("renders edit delete back actions for write roles", async () => {
    mockSalesSession("owner");
    renderRoute("/sales/invoices/51");

    expect(await screen.findByRole("link", { name: "S\u1eeda h\u00f3a \u0111\u01a1n" })).toHaveAttribute("href", "/sales/invoices/new");
    expect(screen.getByRole("button", { name: "X\u00f3a h\u00f3a \u0111\u01a1n" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay l\u1ea1i" })).toHaveAttribute("href", "/sales/invoices");
  });

  it("detail edit button opens the POS edit draft", async () => {
    mockReturnsSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51");

    await testUser.click(await screen.findByRole("link", { name: "S\u1eeda h\u00f3a \u0111\u01a1n" }));

    expect(await screen.findByRole("button", { name: /HD20260517-001/ })).toBeInTheDocument();
  });

  it("old edit route redirects into the POS edit draft", async () => {
    mockReturnsSession("owner");
    renderRoute("/sales/invoices/51/edit");

    expect(await screen.findByRole("button", { name: /HD20260517-001/ })).toBeInTheDocument();
  });

  it("renders only back action for read only roles", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/51");

    expect(await screen.findByRole("link", { name: "Quay l\u1ea1i" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "S\u1eeda h\u00f3a \u0111\u01a1n" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "X\u00f3a h\u00f3a \u0111\u01a1n" })).not.toBeInTheDocument();
  });

  it("keeps invoice delete confirm and redirect behavior", async () => {
    const fetchMock = mockSalesSession("owner");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const testUser = userEvent.setup();
    renderRoute("/sales/invoices/51");

    await testUser.click(await screen.findByRole("button", { name: "X\u00f3a h\u00f3a \u0111\u01a1n" }));

    expect(confirmSpy).toHaveBeenCalledWith("X\u00f3a h\u00f3a \u0111\u01a1n n\u00e0y?");
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/sales/invoices/51") && call[1]?.method === "DELETE"),
      ).toBe(true);
    });
    expect(await screen.findByRole("heading", { name: /Ba.n ha.ng/i })).toBeInTheDocument();
  });

  it("blocks read_only invoice create route", async () => {
    mockSalesSession("read_only");
    renderRoute("/sales/invoices/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });
});
