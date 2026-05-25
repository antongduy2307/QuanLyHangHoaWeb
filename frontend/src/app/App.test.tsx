import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { login as loginRequest } from "../api/auth";
import { ApiError } from "../api/errors";
import { apiRequest, buildApiUrl } from "../api/client";
import { setRefreshToken } from "../auth/tokenStore";
import { normalizeApiBaseUrl, parseBooleanFlag } from "../config/env";
import { mockAuthenticatedSession, jsonResponse, productFixture, user } from "../tests/appTestHarness";
import { renderRoute } from "../tests/testUtils";

describe("app boot and auth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("renders login page", async () => {
    renderRoute("/login");

    expect(await screen.findByRole("heading", { name: "Dang nhap" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ten dang nhap")).toBeInTheDocument();
    expect(screen.getByLabelText("Mat khau")).toBeInTheDocument();
  });

  it("builds auth login URL under the configured API base without malformed slashes", () => {
    expect(normalizeApiBaseUrl(" http://localhost:8000/api/ ")).toBe("http://localhost:8000/api");
    expect(normalizeApiBaseUrl("")).toBe("http://127.0.0.1:8000/api");
    expect(parseBooleanFlag("true")).toBe(true);
    expect(parseBooleanFlag("false")).toBe(false);
    expect(buildApiUrl("/auth/login")).toBe("http://127.0.0.1:8000/api/auth/login");
  });

  it("opens the admin shell directly when local auth bypass is enabled", async () => {
    window.sessionStorage.setItem("qlhh.authBypass", "true");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Người dùng hiện tại")).toHaveTextContent("Local Admin");
  });

  it("treats local auth bypass user as owner for role-gated screens", async () => {
    window.sessionStorage.setItem("qlhh.authBypass", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/inventory/products")) {
          return Promise.resolve(jsonResponse([productFixture()]));
        }
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
      }),
    );

    renderRoute("/inventory/products");
    expect(await screen.findByText("GAO-01")).toBeInTheDocument();
  });

  it("login request uses the API base URL and sends the backend JSON schema", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return (
      Promise.resolve(
        jsonResponse({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "bearer",
          expires_in: 1800,
          user: user("owner"),
        }),
      )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await loginRequest("admin", "ChangeMe12345!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:8000/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "admin", password: "ChangeMe12345!" });
  });

  it("successful login redirects to the app", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        return Promise.resolve(
          jsonResponse({
            access_token: "access",
            refresh_token: "refresh",
            token_type: "bearer",
            expires_in: 1800,
            user: user("owner"),
          }),
        );
      }
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const testUser = userEvent.setup();
    renderRoute("/login");

    await testUser.type(screen.getByLabelText("Ten dang nhap"), "admin");
    await testUser.type(screen.getByLabelText("Mat khau"), "strong-password");
    await testUser.click(screen.getByRole("button", { name: "Dang nhap" }));

    expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("qlhh.refreshToken")).toBe("refresh");
  });

  it("displays backend login error clearly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/login")) {
          return Promise.resolve(jsonResponse({ error: { code: "authentication_error", message: "Invalid username or password" } }, 401));
        }
        return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404));
      }),
    );
    const testUser = userEvent.setup();
    renderRoute("/login");

    await testUser.type(screen.getByLabelText("Ten dang nhap"), "admin");
    await testUser.type(screen.getByLabelText("Mat khau"), "bad-password");
    await testUser.click(screen.getByRole("button", { name: "Dang nhap" }));

    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
  });

  it("logout clears the stored session", async () => {
    mockAuthenticatedSession("owner");
    const testUser = userEvent.setup();
    renderRoute("/");

    await screen.findByRole("heading", { name: "Tổng quan" });
    await testUser.click(screen.getByRole("button", { name: "Đăng xuất" }));

    expect(await screen.findByRole("heading", { name: "Dang nhap" })).toBeInTheDocument();
  });

  it("restores a session with refresh token flow", async () => {
    const fetchMock = mockAuthenticatedSession("admin");
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("parses backend API error shape", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "validation_error", message: "Bad input" } }, 422))));
    await expect(apiRequest("/example", { skipAuth: true, skipRefresh: true })).rejects.toEqual(
      new ApiError(422, "validation_error", "Bad input"),
    );
  });

  it("reports HTTP 500 as a backend error instead of a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("Internal Server Error", { status: 500 }))));

    await expect(apiRequest("/reports/dashboard-summary", { skipAuth: true, skipRefresh: true })).rejects.toEqual(
      new ApiError(500, "http_error", "Backend tra ve loi HTTP 500."),
    );
  });

  it("reports network and CORS-style fetch failures with the resolved API base", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(apiRequest("/inventory/products", { skipAuth: true, skipRefresh: true })).rejects.toEqual(
      new ApiError(
        0,
        "network_error",
        "Khong the ket noi API tai http://127.0.0.1:8000/api. Kiem tra backend, CORS va VITE_API_BASE_URL.",
      ),
    );
  });

  it("reports backend bypass mismatch clearly when frontend bypass receives 401", async () => {
    window.sessionStorage.setItem("qlhh.authBypass", "true");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "authentication_error", message: "Missing bearer token." } }, 401))));

    await expect(apiRequest("/inventory/products")).rejects.toEqual(
      new ApiError(
        401,
        "authentication_error",
        "Missing bearer token. Frontend dang bat local auth bypass; hay chay backend voi APP_ENV=local va AUTH_BYPASS=true.",
      ),
    );
  });

  it("refreshes once after a protected request returns 401", async () => {
    setRefreshToken("stored-refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "authentication_error", message: "Expired" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "refreshed-access", refresh_token: "rotated-refresh", token_type: "bearer", expires_in: 1800 }))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ status: string }>("/protected")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
