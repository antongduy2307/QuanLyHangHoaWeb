const fallbackApiBaseUrl = "http://127.0.0.1:8000/api";
const testAuthBypassKey = "qlhh.authBypass";

export function normalizeApiBaseUrl(value: string | undefined) {
  const candidate = value?.trim() || fallbackApiBaseUrl;
  return candidate.replace(/\/+$/, "");
}

export function parseBooleanFlag(value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return value;
  }
  return value?.trim().toLowerCase() === "true";
}

export const env = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  authBypass: import.meta.env.MODE === "test" ? false : parseBooleanFlag(import.meta.env.VITE_AUTH_BYPASS),
};

export function isAuthBypassEnabled() {
  return env.authBypass || (import.meta.env.MODE === "test" && window.sessionStorage.getItem(testAuthBypassKey) === "true");
}

if (import.meta.env.DEV) {
  console.info(`[config] API base URL: ${env.apiBaseUrl}`);
  if (isAuthBypassEnabled()) {
    console.info("[config] Local auth bypass enabled.");
  }
}
