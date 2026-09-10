import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import type { PermissionKey } from "@shared/constants/permissions";
import { useAuth } from "@/auth/AuthProvider";
import { isPlatformFinance } from "@shared/lib/platform-finance";

/**
 * Guard permission level route — pengganti aturan src/proxy.ts.
 * Backend tetap menegakkan via @RequirePermission (batas keamanan asli).
 */
export function RequirePermission({
  permission,
  children,
  requiresPlatformFinance = false,
  requiresSuperAdmin = false,
}: {
  permission: PermissionKey;
  children: ReactNode;
  requiresPlatformFinance?: boolean;
  requiresSuperAdmin?: boolean;
}) {
  const { can, isLoading } = usePermission();
  const { user } = useAuth();

  if (isLoading) return null;
  if (!can(permission) || (requiresPlatformFinance && !isPlatformFinance(user)) || (requiresSuperAdmin && (user?.roleName !== "SUPER_ADMIN" || !!user.lembagaId))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
