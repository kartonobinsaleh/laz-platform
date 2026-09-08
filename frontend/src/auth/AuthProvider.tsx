import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, invalidateCsrfToken } from "@/lib/api-client";
import type { RBACSessionUser } from "@shared/types/rbac";
import { clearSessionCache } from "./session-cache";

/**
 * AuthProvider berbasis useQuery(['auth','me']).
 * Pengganti SessionProvider NextAuth — expose { user, isLoading, refresh, logout }.
 */

interface AuthContextValue {
  user: RBACSessionUser | null;
  isLoading: boolean;
  /** Refetch /auth/me (dipanggil setelah login). */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<RBACSessionUser | null> {
  try {
    const { data } = await api.get<RBACSessionUser>("/auth/me");
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 60 * 1000,
    retry: false,
  });

  const refresh = useCallback(async () => {
    invalidateCsrfToken();
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      invalidateCsrfToken();
      await clearSessionCache(queryClient);
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user: data ?? null, isLoading, refresh, logout }),
    [data, isLoading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
