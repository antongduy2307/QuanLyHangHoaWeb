import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import * as authApi from "../api/auth";
import type { AuthenticatedUser } from "../api/types";
import { isAuthBypassEnabled } from "../config/env";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { clearStoredTokens, getRefreshToken, setAccessToken, setRefreshToken } from "./tokenStore";

const localBypassUser: AuthenticatedUser = {
  id: 0,
  username: "local-admin",
  display_name: "Local Admin",
  role: "owner",
  is_active: true,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const authBypass = isAuthBypassEnabled();
  const [user, setUser] = useState<AuthContextValue["user"]>(authBypass ? localBypassUser : null);
  const [isInitializing, setIsInitializing] = useState(!authBypass);
  const queryClient = useQueryClient();

  const clearAuthState = useCallback(() => {
    clearStoredTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (authBypass) {
        setUser(localBypassUser);
        setIsInitializing(false);
        return;
      }

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsInitializing(false);
        return;
      }

      try {
        const tokens = await authApi.refresh(refreshToken);
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
        const currentUser = await authApi.me();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          clearAuthState();
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, [authBypass, clearAuthState]);

  const login = useCallback(async (username: string, password: string) => {
    if (authBypass) {
      setUser(localBypassUser);
      return;
    }
    const result = await authApi.login(username, password);
    setAccessToken(result.access_token);
    setRefreshToken(result.refresh_token);
    setUser(result.user);
  }, [authBypass]);

  const logout = useCallback(async () => {
    if (authBypass) {
      setUser(localBypassUser);
      return;
    }
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      clearAuthState();
    }
  }, [authBypass, clearAuthState]);

  const value = useMemo(
    () => ({ user, isInitializing, login, logout }),
    [isInitializing, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
