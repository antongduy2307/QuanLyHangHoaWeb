import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockOrderSession } from "../../tests/appTestHarness";
import { renderRoute } from "../../tests/testUtils";

describe("orders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders order list and summary", async () => {
    mockOrderSession("read_only");
    renderRoute("/orders");

    expect(await screen.findByText("Cong ty Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("Can giao som")).toBeInTheDocument();
  });
});
