import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockReturnsSession } from "../../tests/appTestHarness";
import { renderRoute } from "../../tests/testUtils";

describe("returns", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders return list", async () => {
    mockReturnsSession("owner");
    renderRoute("/returns");

    expect(await screen.findByText("TR20260517-001")).toBeInTheDocument();
  });

  it("renders return detail", async () => {
    mockReturnsSession("read_only");
    renderRoute("/returns/71");

    expect(await screen.findByText("TR20260517-001")).toBeInTheDocument();
    expect(screen.getByText("Tra mot phan")).toBeInTheDocument();
    expect(screen.getByText("GAO-01")).toBeInTheDocument();
  });

  it("blocks read_only return create route", async () => {
    mockReturnsSession("read_only");
    renderRoute("/returns/new");

    expect(await screen.findByRole("heading", { name: "Khong co quyen truy cap" })).toBeInTheDocument();
  });
});
