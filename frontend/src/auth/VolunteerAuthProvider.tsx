import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, invalidateCsrfToken } from "@/lib/api-client";
import type { VolunteerSessionUser } from "@shared/types/volunteer";
import { clearSessionCache } from "./session-cache";

/**
 * VolunteerAuthProvider — principal terpisah dari AuthProvider (staff/RBAC).
 * Relawan tidak punya permissions[]/roleName, jadi tidak menumpang
 * useAuth()/usePermission() yang RBAC-shaped.
 */

interface VolunteerAuthContextValue {
  volunteer: VolunteerSessionUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const VolunteerAuthContext = createContext<VolunteerAuthContextValue | null>(null);

async function fetchMe(): Promise<VolunteerSessionUser | null> {
  try {
    const { data } = await api.get<VolunteerSessionUser>("/volunteers/me");
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function VolunteerAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["volunteer", "me"],
    queryFn: fetchMe,
    staleTime: 60 * 1000,
    retry: false,
  });

  const refresh = useCallback(async () => {
    invalidateCsrfToken();
    await queryClient.invalidateQueries({ queryKey: ["volunteer", "me"] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.post("/volunteers/logout");
    } finally {
      invalidateCsrfToken();
      await clearSessionCache(queryClient);
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ volunteer: data ?? null, isLoading, refresh, logout }),
    [data, isLoading, refresh, logout],
  );

  return <VolunteerAuthContext.Provider value={value}>{children}</VolunteerAuthContext.Provider>;
}

export function useVolunteerAuth(): VolunteerAuthContextValue {
  const ctx = useContext(VolunteerAuthContext);
  if (!ctx) throw new Error("useVolunteerAuth must be used within VolunteerAuthProvider");
  return ctx;
}
