import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { useBankChanges, type BankAccountChangeRequest } from "../api/withdrawals";
import { getBankLabel } from "../constants/banks";

export const BANK_CHANGE_WARNING = "Pengubahan rekening harus menunggu persetujuan dari platform Ruang Berbagi.";

export function BankChangeStatus({ status }: { status: BankAccountChangeRequest["status"] }) {
  return <Badge intent={status === "PENDING" ? "warning" : status === "APPROVED" ? "success" : "destructive"}>
    {status === "PENDING" ? "Pending — menunggu persetujuan" : status === "APPROVED" ? "Disetujui" : "Ditolak"}
  </Badge>;
}

export function BankChangeComparison({ request }: { request: BankAccountChangeRequest }) {
  return <div className="grid gap-4 text-sm sm:grid-cols-2">
    <div className="rounded-xl bg-surface-soft p-4">
      <p className="mb-2 font-semibold text-secondary">Rekening sebelumnya</p>
      <p>{getBankLabel(request.previousBankCode)}</p>
      <p className="break-all font-mono">{request.previousAccountNumber}</p>
      <p className="break-words">a.n. {request.previousAccountHolder}</p>
    </div>
    <div className="rounded-xl border border-border/50 p-4">
      <p className="mb-2 font-semibold text-primary">Rekening yang diajukan</p>
      <p>{getBankLabel(request.bankCode)}</p>
      <p className="break-all font-mono">{request.accountNumber}</p>
      <p className="break-words">a.n. {request.accountHolder}</p>
    </div>
  </div>;
}

export function BankChangeReason({ reason }: { reason: string }) {
  return <div className="min-w-0 rounded-xl border border-border/50 bg-surface-soft p-4">
    <p className="mb-2 text-sm font-semibold text-primary">Alasan pengubahan</p>
    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">{reason}</p>
  </div>;
}

export function BankChangeHistory({ scope }: { scope: "lembaga" | "platform" }) {
  const [page, setPage] = useState(1);
  const { data: result, isLoading, isError, refetch } = useBankChanges(scope, page);
  const requests = result?.data ?? [];
  return <Card><CardContent className="space-y-4">
    <h2 className="text-lg font-bold text-primary">Riwayat pengubahan rekening</h2>
    <p className="text-sm text-secondary">Rekening lama tetap digunakan selama pengajuan pending. Rekening baru aktif otomatis setelah disetujui. Penarikan yang sudah diajukan tetap menggunakan rekening saat pengajuan penarikan.</p>
    {isLoading ? <p role="status">Memuat pengajuan…</p> : isError ? <div role="alert">
      <p>Riwayat pengajuan belum dapat dimuat.</p><Button intent="outline" onClick={() => void refetch()}>Coba lagi</Button>
    </div> : requests.length === 0 ? <p className="text-sm text-secondary">Belum ada pengajuan perubahan rekening.</p> : requests.map((request) => <div key={request.id} className="space-y-3 rounded-xl border border-border/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">{new Date(request.createdAt).toLocaleString("id-ID")}</p>
        <BankChangeStatus status={request.status} />
      </div>
      <BankChangeComparison request={request} />
      <BankChangeReason reason={request.changeReason} />
      {request.status === "REJECTED" && <div role="status" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
        <p className="font-semibold">Alasan penolakan</p><p className="whitespace-pre-wrap break-words">{request.rejectionReason}</p>
        <p className="mt-2">Silakan perbaiki data dan ajukan kembali melalui tombol Ubah Rekening.</p>
      </div>}
      {request.reviewedAt && <p className="text-xs text-secondary">Diproses {new Date(request.reviewedAt).toLocaleString("id-ID")}</p>}
    </div>)}
    {(page > 1 || (result?.meta?.totalPages ?? 1) > 1) && <div className="flex items-center justify-end gap-3">
      <Button intent="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
      <span className="text-sm">Halaman {page}</span>
      <Button intent="outline" disabled={page >= (result?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Berikutnya</Button>
    </div>}
  </CardContent></Card>;
}
