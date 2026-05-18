import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { clearStoredTokens } from "../auth/tokenStore";

afterEach(() => {
  clearStoredTokens();
  window.sessionStorage.removeItem("qlhh.authBypass");
  vi.restoreAllMocks();
});
