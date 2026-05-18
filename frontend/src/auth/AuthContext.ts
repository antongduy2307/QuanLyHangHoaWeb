import { createContext } from "react";

import type { AuthenticatedUser } from "../api/types";

export type AuthContextValue = {
  user: AuthenticatedUser | null;
  isInitializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
