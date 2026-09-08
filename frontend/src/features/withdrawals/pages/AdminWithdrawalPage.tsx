import { useState } from "react";
import { useGetAllWithdrawals, useApproveWithdrawal, useRejectWithdrawal, useRetryPayout, Withdrawal } from "../api/withdrawals";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  ConfirmDialog,
  Textarea,
  Pagination,
} from "@/components/ui";
import { toast } from "@/stores/toast.store";
import { formatCurrency } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { PERMISSIONS } from "@shared/constants/permissions";
import { useTablePagination, useTablePaginationMeta } from "@/hooks/useTablePagination";

export function AdminWithdrawalPage() {
  const { can } = usePermission();
  const canManageWithdrawals = can(PERMISSIONS.WITHDRAWALS_MANAGE);
  const { page, limit, searchParams, setSearchParams } = useTablePagination(20);
  const statusFilter = searchParams.get("status") ?? "PENDING";
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  
  const [actionWithdrawalId, setActionWithdrawalId] = useState<string | null>(null);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [isRetryConfirmOpen, setIsRetryConfirmOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: withdrawals, isLoading } = useGetAllWithdrawals(statusFilter === "ALL" ? undefined : statusFilter, page, limit);
  const pagination = useTablePaginationMeta(withdrawals?.meta, page, limit);
  const approveWithdrawal = useApproveWithdrawal();
  const rejectWithdrawal = useRejectWithdrawal();
  const retryPayout = useRetryPayout();

  const openApproveConfirm = (id: string) => {
    setActionWithdrawalId(id);
    setIsApproveConfirmOpen(true);
  };

  const confirmApprove = async () => {
    if (!actionWithdrawalId) return;
    try {
      await approveWithdrawal.mutateAsync(actionWithdrawalId);
      toast.success("Pencairan disetujui, dana sedang diproses oleh gateway!");
      setIsApproveConfirmOpen(false);
      setActionWithdrawalId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Gagal menyetujui pencairan");
    }
  };

  const openRetryConfirm = (id: string) => {
    setActionWithdrawalId(id);
    setIsRetryConfirmOpen(true);
  };

  const confirmRetryPayout = async () => {
    if (!actionWithdrawalId) return;
    try {
      await retryPayout.mutateAsync(actionWithdrawalId);
      toast.success("Pencairan sedang dicoba kembali!");
      setIsRetryConfirmOpen(false);
      setActionWithdrawalId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Gagal mencoba ulang pencairan");
    }
  };

  const openRejectDialog = (id: string) => {
    setActionWithdrawalId(id);
    setRejectReason("");
    setIsRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!actionWithdrawalId || !rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    try {
      await rejectWithdrawal.mutateAsync({ id: actionWithdrawalId, reason: rejectReason });
      toast.success("Pencairan ditolak!");
      setIsRejectDialogOpen(false);
      setRejectReason("");
      setActionWithdrawalId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Gagal menolak pencairan");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge intent="warning">PENDING</Badge>;
      case "APPROVED":
        return <Badge intent="info">APPROVED</Badge>;
      case "PROCESSING":
        return <Badge intent="warning">PROCESSING</Badge>;
      case "COMPLETED":
        return <Badge intent="success">COMPLETED</Badge>;
      case "REJECTED":
      case "FAILED":
      case "REVERSED":
        return <Badge intent="destructive">{status}</Badge>;
      default:
        return <Badge intent="muted">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-surface-stronger">Antrean Pengajuan Penarikan</h1>
      </div>

      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((status) => (
          <Button
            key={status}
            intent={statusFilter === status ? "primary" : "outline"}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set("status", status);
              params.set("page", "1");
              setSearchParams(params);
            }}
          >
            {status}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengajuan Penarikan</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Memuat...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-surface-strong uppercase bg-surface-soft">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Lembaga</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Nominal</th>
                    <th className="px-4 py-3">Bank Tujuan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals?.data?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center text-surface-strong">
                        Tidak ada pengajuan pencairan
                      </td>
                    </tr>
                  )}
                  {withdrawals?.data?.map((w: Withdrawal) => (
                    <tr key={w.id} className="border-b border-surface-soft">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(w.createdAt).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {w.lembaga?.name}
                      </td>
                      <td className="px-4 py-3">{w.program?.title || (w.lembaga ? "Data lama" : "Platform")}</td>
                      <td className="px-4 py-3 font-medium text-primary">
                        {formatCurrency(Number(w.amount))}
                      </td>
                      <td className="px-4 py-3">
                        {w.bankCode} - {w.accountNumber} <br />
                        <span className="text-xs text-surface-strong">{w.accountHolder}</span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(w.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {w.status === "PENDING" && canManageWithdrawals && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              intent="outline"
                              onClick={() => setSelectedWithdrawal(w)}
                            >
                              Detail
                            </Button>
                            <Button
                              size="sm"
                              intent="primary"
                              onClick={() => openApproveConfirm(w.id)}
                              disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending || retryPayout.isPending}
                            >
                              Setuju
                            </Button>
                            <Button
                              size="sm"
                              intent="destructive"
                              onClick={() => openRejectDialog(w.id)}
                              disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending || retryPayout.isPending}
                            >
                              Tolak
                            </Button>
                          </div>
                        )}
                        {(w.status !== "PENDING" || !canManageWithdrawals) && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              intent="outline"
                              onClick={() => setSelectedWithdrawal(w)}
                            >
                              Detail
                            </Button>
                            {w.status === "APPROVED" && canManageWithdrawals && (
                              <Button
                                size="sm"
                                intent="outline"
                                onClick={() => openRetryConfirm(w.id)}
                                disabled={approveWithdrawal.isPending || rejectWithdrawal.isPending || retryPayout.isPending}
                              >
                                Coba Ulang Transfer
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && <Pagination {...pagination} />}
        </CardContent>
      </Card>
    </div>

      <Dialog
        isOpen={!!selectedWithdrawal}
        onClose={() => setSelectedWithdrawal(null)}
        title="Detail Pencairan Dana"
      >
        {selectedWithdrawal && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-secondary font-medium">Lembaga</p>
                <p className="font-bold text-primary">{selectedWithdrawal.lembaga?.name || "-"}</p>
              </div>
              <div>
                <p className="text-secondary font-medium">Nominal</p>
                <p className="font-bold text-primary">{formatCurrency(Number(selectedWithdrawal.amount))}</p>
              </div>
              <div>
                <p className="text-secondary font-medium">Program Sumber Dana</p>
                <p className="font-bold text-primary">
                  {selectedWithdrawal.program?.title || (selectedWithdrawal.lembaga ? "Data lama" : "Platform")}
                </p>
              </div>
              <div>
                <p className="text-secondary font-medium">Status</p>
                {getStatusBadge(selectedWithdrawal.status)}
              </div>
              <div>
                <p className="text-secondary font-medium">Tanggal Pengajuan</p>
                <p className="font-medium text-primary">{new Date(selectedWithdrawal.createdAt).toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="border-t border-border/40 pt-4 mt-4">
              <h4 className="font-bold text-primary mb-2">Informasi Bank Tujuan</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-secondary font-medium">Kode Bank</p>
                  <p className="font-bold text-primary">{selectedWithdrawal.bankCode}</p>
                </div>
                <div>
                  <p className="text-secondary font-medium">Nomor Rekening</p>
                  <p className="font-bold text-primary tracking-wider">{selectedWithdrawal.accountNumber}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-secondary font-medium">Nama Pemilik Rekening</p>
                  <p className="font-bold text-primary">{selectedWithdrawal.accountHolder}</p>
                </div>
              </div>
            </div>

            {(selectedWithdrawal.rejectionReason || selectedWithdrawal.approvedBy) && (
              <div className="border-t border-border/40 pt-4 mt-4">
                <h4 className="font-bold text-primary mb-2">Audit Status</h4>
                <div className="grid grid-cols-1 gap-4">
                  {selectedWithdrawal.status === "REJECTED" && selectedWithdrawal.rejectionReason && (
                    <div>
                      <p className="text-secondary font-medium">Alasan Penolakan</p>
                      <p className="font-medium text-destructive">{selectedWithdrawal.rejectionReason}</p>
                    </div>
                  )}
                  {selectedWithdrawal.approvedBy && (
                    <div>
                      <p className="text-secondary font-medium">Diproses Oleh</p>
                      <p className="font-medium text-primary">
                        {(selectedWithdrawal as any).approvedBy?.name || "Admin"} ({(selectedWithdrawal as any).approvedBy?.email || "-"})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        isOpen={isApproveConfirmOpen}
        onClose={() => setIsApproveConfirmOpen(false)}
        onConfirm={confirmApprove}
        title="Konfirmasi Penyetujuan"
        message="Apakah Anda yakin ingin menyetujui pencairan ini? Dana akan otomatis ditransfer ke rekening lembaga."
        confirmText={approveWithdrawal.isPending ? "Memproses..." : "Setujui"}
        cancelText="Batal"
        intent="primary"
      />

      <ConfirmDialog
        isOpen={isRetryConfirmOpen}
        onClose={() => setIsRetryConfirmOpen(false)}
        onConfirm={confirmRetryPayout}
        title="Konfirmasi Coba Ulang"
        message="Pencairan ini tertahan. Apakah Anda yakin ingin mencoba ulang proses transfer ke bank?"
        confirmText={retryPayout.isPending ? "Memproses..." : "Coba Ulang"}
        cancelText="Batal"
        intent="primary"
      />

      <Dialog
        isOpen={isRejectDialogOpen}
        onClose={() => setIsRejectDialogOpen(false)}
        title="Tolak Pencairan Dana"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-strong mb-1">
              Alasan Penolakan <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Masukkan alasan penolakan secara spesifik..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button intent="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              intent="destructive" 
              onClick={confirmReject}
              disabled={rejectWithdrawal.isPending || !rejectReason.trim()}
            >
              {rejectWithdrawal.isPending ? "Menolak..." : "Tolak Pencairan"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
