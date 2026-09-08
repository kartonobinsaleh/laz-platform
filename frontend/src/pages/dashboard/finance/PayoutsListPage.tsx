import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api-client";
import { PageHeader, TableSkeleton, Badge } from "@/components/ui";
import { DataTableToolbar } from "@/components/ui/data-table";

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const fmtDt = (d: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));

const getStatusBadge = (status: string) => {
  switch (status) {
    case "REQUESTED":
    case "ACCEPTED":
    case "PROCESSING":
      return <Badge intent="warning">{status}</Badge>;
    case "SUCCEEDED":
    case "COMPLETED":
      return <Badge intent="success">{status}</Badge>;
    case "FAILED":
    case "REVERSED":
    case "CANCELLED":
    case "REJECTED":
      return <Badge intent="destructive">{status}</Badge>;
    default:
      return <Badge intent="muted">{status}</Badge>;
  }
};

export function PayoutsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 10);
  const status = searchParams.get("status") ?? undefined;

  const { data: result, isLoading } = useQuery({
    queryKey: ["payouts", { page, limit, status }],
    queryFn: () => api.get<any>("/withdrawals/payouts", { page, limit, status }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const payouts = result?.data ?? [];
  const meta = result?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Penarikan"
        description="Daftar riwayat penarikan dana ke rekening bank. Status transaksi akan diperbarui secara otomatis."
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          {["SEMUA", "REQUESTED", "PROCESSING", "SUCCEEDED", "FAILED"].map((s) => {
            const isActive = (s === "SEMUA" && !status) || status === s;
            return (
              <button
                key={s}
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  if (s === "SEMUA") newParams.delete("status");
                  else newParams.set("status", s);
                  newParams.set("page", "1");
                  setSearchParams(newParams);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                  isActive
                    ? "bg-brand-primary text-white"
                    : "bg-surface-soft text-surface-strong hover:bg-surface-muted"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      {isLoading ? (
        <TableSkeleton
          headers={["ID Referensi", "Lembaga", "Nominal", "Bank Tujuan", "Status", "Dibuat Pada", "Selesai Pada"]}
          rowCount={limit}
          columnTypes={["text", "text", "text", "text", "text", "text", "text"]}
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-surface-strong uppercase bg-surface-soft border-b border-border/40">
                <tr>
                  <th className="px-6 py-4 font-semibold">ID Referensi</th>
                  <th className="px-6 py-4 font-semibold">Lembaga</th>
                  <th className="px-6 py-4 font-semibold">Nominal</th>
                  <th className="px-6 py-4 font-semibold">Bank Tujuan</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Dibuat Pada</th>
                  <th className="px-6 py-4 font-semibold">Update Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-secondary">
                      Tidak ada riwayat penarikan yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout: any) => (
                    <tr key={payout.id} className="hover:bg-surface-soft/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-primary">{payout.referenceId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-primary">
                          {payout.withdrawal?.lembaga?.name || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-primary">
                        {fmt(Number(payout.amount))}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-primary">{payout.channelCode} - {payout.accountNumber}</div>
                        <div className="text-xs text-secondary mt-0.5">{payout.accountHolder}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(payout.status)}
                      </td>
                      <td className="px-6 py-4 text-secondary whitespace-nowrap">
                        {fmtDt(payout.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-secondary whitespace-nowrap">
                        {fmtDt(payout.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Simple Pagination - normally you'd use a shared component here */}
          {meta && meta.totalPages > 1 && (
            <div className="p-4 border-t border-border/40 flex justify-between items-center bg-surface-soft/30">
              <span className="text-sm text-secondary">
                Halaman {meta.page} dari {meta.totalPages} (Total: {meta.total} Transaksi)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set("page", String(meta.page - 1));
                    setSearchParams(newParams);
                  }}
                  className="px-3 py-1 text-sm bg-surface text-primary border border-border/40 rounded hover:bg-surface-muted disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set("page", String(meta.page + 1));
                    setSearchParams(newParams);
                  }}
                  className="px-3 py-1 text-sm bg-surface text-primary border border-border/40 rounded hover:bg-surface-muted disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
