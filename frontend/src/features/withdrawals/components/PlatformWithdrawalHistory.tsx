import { useState } from "react";
import { Badge, Button, Card, CardContent, TableSkeleton } from "@/components/ui";
import { usePlatformWithdrawals, type Withdrawal } from "../api/withdrawals";
import { getBankLabel } from "../constants/banks";
import { formatCurrency } from "@/lib/utils";

const statuses: Record<Withdrawal["status"], { label: string; intent: "warning" | "info" | "success" | "destructive" }> = {
  PENDING: { label: "Menunggu persetujuan", intent: "warning" },
  APPROVED: { label: "Disetujui", intent: "info" },
  PROCESSING: { label: "Diproses", intent: "info" },
  COMPLETED: { label: "Selesai", intent: "success" },
  REJECTED: { label: "Ditolak", intent: "destructive" },
  FAILED: { label: "Gagal", intent: "destructive" },
  REVERSED: { label: "Dikembalikan", intent: "warning" },
};
const headers = ["Tanggal pengajuan", "Nominal", "Rekening tujuan", "Status"];
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function PlatformWithdrawalHistory() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const { data: result, isLoading, isError, isFetching, refetch } = usePlatformWithdrawals(page, limit);
  const rows = result?.data ?? [];
  const meta = result?.meta ?? { page, limit, total: 0, totalPages: 1 };

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-primary">Riwayat penarikan platform</h2>
          <p className="mt-1 text-sm text-secondary">Pantau status pengajuan penarikan dana platform.</p>
        </div>
        {isError ? (
          <div role="alert" className="space-y-3 text-sm text-secondary">
            <p>Riwayat penarikan belum dapat dimuat.</p>
            <Button intent="outline" onClick={() => void refetch()} isLoading={isFetching}>Coba lagi</Button>
          </div>
        ) : isLoading ? (
          <TableSkeleton headers={headers} rowCount={limit} columnTypes={["text", "text", "text", "text"]} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/40" aria-busy={isFetching}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Riwayat penarikan platform</caption>
              <thead className="bg-surface-soft text-xs uppercase text-secondary">
                <tr>{headers.map((header) => <th key={header} scope="col" className="px-4 py-3 font-semibold">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!rows.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-secondary">Belum ada riwayat penarikan.</td></tr>}
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-soft/50">
                    <td className="whitespace-nowrap px-4 py-4 text-secondary">{dateFormat.format(new Date(row.createdAt))}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-primary">{formatCurrency(Number(row.amount))}</td>
                    <td className="min-w-48 px-4 py-4">
                      <p className="font-medium text-primary">{getBankLabel(row.bankCode)}</p>
                      <p className="mt-1 break-all text-secondary">{row.accountNumber}</p>
                      <p className="text-secondary">a.n. {row.accountHolder}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge intent={statuses[row.status]?.intent ?? "muted"}>{statuses[row.status]?.label ?? row.status}</Badge>
                      {row.rejectionReason && <p className="mt-2 max-w-xs break-words text-xs text-secondary">{row.rejectionReason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Pagination riwayat penarikan" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary" aria-live="polite">Halaman {page} dari {Math.max(1, meta.totalPages)} · {meta.total} pengajuan · {limit} per halaman</p>
          <div className="flex gap-2">
            <Button intent="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((current) => current - 1)}>Sebelumnya</Button>
            <Button intent="outline" size="sm" disabled={isError || isFetching || page >= meta.totalPages} onClick={() => setPage((current) => current + 1)}>Selanjutnya</Button>
          </div>
        </nav>
      </CardContent>
    </Card>
  );
}
