import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { usePermission } from "@/hooks/usePermission";
import { PERMISSIONS } from "@shared/constants/permissions";
import { UserTable } from "@/features/users/components/UserTable";
import { PageHeader, Button, TableSkeleton } from "@/components/ui";
import { DataTableToolbar } from "@/components/ui/data-table";
import { UserLembagaFilter } from "@/features/users/components/UserLembagaFilter";
import { Link } from "react-router-dom";

export function UsersListPage() {
  const { user } = useAuth();
  const { can } = usePermission();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = user?.roleName === "SUPER_ADMIN";

  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 10);
  const search = searchParams.get("search") ?? undefined;
  const lembagaId = searchParams.get("lembagaId") ?? undefined;

  const { data: result, isLoading } = useQuery({
    queryKey: ["users", { page, limit, search, lembagaId }],
    queryFn: () => api.get<any[]>("/users", { page, limit, search, lembagaId }),
  });

  const { data: rolesResult } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<any[]>("/roles"),
  });

  const { data: lembagasResult } = useQuery({
    queryKey: ["lembaga", "options"],
    queryFn: () => api.get<any>("/lembaga/options"),
    enabled: isSuperAdmin,
  });

  const pagination = result?.meta
    ? { currentPage: result.meta.page, totalPages: result.meta.totalPages, totalCount: result.meta.total, pageSize: result.meta.limit }
    : { currentPage: 1, totalPages: 1, totalCount: 0, pageSize: limit };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Pengguna"
        description="Daftar semua pengguna platform"
        action={
          can(PERMISSIONS.USERS_CREATE) ? (
            <Link to="/dashboard/users/new">
              <Button size="md">Tambah Pengguna</Button>
            </Link>
          ) : undefined
        }
      />

      <DataTableToolbar
        searchValue={search}
        searchPlaceholder="Cari nama atau email..."
        filterSlot={
          isSuperAdmin && lembagasResult?.data?.length ? (
            <UserLembagaFilter lembagas={lembagasResult.data} />
          ) : undefined
        }
      />

      {isLoading ? (
        <TableSkeleton
          headers={isSuperAdmin ? ["Nama", "Email", "Status", "Role / Peran", "Lembaga", "Aksi"] : ["Nama", "Email", "Status", "Role / Peran", "Aksi"]}
          rowCount={limit}
          columnTypes={isSuperAdmin ? ["avatar", "text", "text", "text", "text", "action"] : ["avatar", "text", "text", "text", "action"]}
        />
      ) : (
        <UserTable
          users={(result?.data ?? []) as any}
          roles={rolesResult?.data ?? []}
          isSuperAdmin={isSuperAdmin}
          currentUserId={user?.id ?? ""}
          pagination={pagination}
        />
      )}
    </div>
  );
}
