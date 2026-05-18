import { apiRequest } from "./client";
import type { AuthTokenPair, AuthenticatedUser, LoginResponse } from "./types";

export function login(username: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify({ username, password }),
  });
}

export function refresh(refreshToken: string) {
  return apiRequest<AuthTokenPair>("/auth/refresh", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function logout(refreshToken: string) {
  return apiRequest<{ status: "ok" }>("/auth/logout", {
    method: "POST",
    skipRefresh: true,
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function me() {
  return apiRequest<AuthenticatedUser>("/auth/me");
}
