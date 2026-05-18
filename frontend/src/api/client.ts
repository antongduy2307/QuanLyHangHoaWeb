import { env, isAuthBypassEnabled } from "../config/env";
import { clearStoredTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "../auth/tokenStore";
import { ApiError } from "./errors";
import type { ApiErrorBody, AuthTokenPair } from "./types";

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

let refreshInFlight: Promise<AuthTokenPair> | null = null;

export function buildApiUrl(path: string) {
  return `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function jsonHeaders(options: ApiRequestOptions) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    const errorBody = data as ApiErrorBody | undefined;
    const code = errorBody?.error?.code || "http_error";
    const message = errorBody?.error?.message || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, code, message);
  }

  return data as T;
}

async function fetchApi(path: string, options: ApiRequestOptions) {
  const url = buildApiUrl(path);
  try {
    return await fetch(url, {
      ...options,
      headers: jsonHeaders(options),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[api] Request failed", {
        method: options.method || "GET",
        url,
        error,
      });
    }
    throw new ApiError(0, "network_error", `Khong the ket noi API tai ${env.apiBaseUrl}. Kiem tra backend, CORS va VITE_API_BASE_URL.`);
  }
}

async function throwAuthBypassMismatch(response: Response): Promise<never> {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? ((await response.json()) as ApiErrorBody) : undefined;
  const backendMessage = data?.error?.message;
  const message = backendMessage
    ? `${backendMessage} Frontend dang bat local auth bypass; hay chay backend voi APP_ENV=local va AUTH_BYPASS=true.`
    : "Frontend dang bat local auth bypass nhung backend tu choi request. Hay chay backend voi APP_ENV=local va AUTH_BYPASS=true.";
  if (import.meta.env.DEV) {
    console.error("[api] Local auth bypass rejected by backend", {
      status: response.status,
      message,
    });
  }
  throw new ApiError(response.status, data?.error?.code || "authentication_error", message);
}

async function refreshAccessToken(): Promise<AuthTokenPair> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, "authentication_error", "Missing refresh token.");
  }

  refreshInFlight = fetch(buildApiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then((response) => parseResponse<AuthTokenPair>(response))
    .then((tokens) => {
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      return tokens;
    })
    .catch((error) => {
      clearStoredTokens();
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetchApi(path, options);

  if (response.status === 401 && !options.skipRefresh) {
    if (isAuthBypassEnabled()) {
      await throwAuthBypassMismatch(response);
    }
    await refreshAccessToken();
    const retryResponse = await fetchApi(path, options);
    return parseResponse<T>(retryResponse);
  }

  return parseResponse<T>(response);
}

export function clearApiTokens() {
  clearStoredTokens();
}
