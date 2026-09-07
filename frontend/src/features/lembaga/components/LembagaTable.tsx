import { useState, useTransition } from "react";
import { DataTable } from "@/components/ui/data-table";
import type { Lembaga } from "@prisma/client";
import { useNavigate } from "react-router-dom";
import { getLembagaColumns } from "./lembaga-columns";
import { logger } from "@/lib/logger";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/stores/toast.store";
import { deleteLembagaAction, approveLembagaAction, rejectLembagaAction } from "../actions/lembaga.actions";
import { LembagaApprovalModal } from "./LembagaApprovalModal";

interface LembagaTableProps {
  lembagas: Lembaga[];
  search?: string;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
  };
}

export function LembagaTable({ lembagas, search, pagination }: LembagaTableProps) {
  logger.debug({ lembagasCount: lembagas.length, search, pagination }, "LembagaTable render props");
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; lembaga: Lembaga | null }>({
    isOpen: false,
    lembaga: null,
  });
  const [rejectState, setRejectState] = useState<{ isOpen: boolean; lembaga: Lembaga | null; reason: string }>({
    isOpen: false,
    lembaga: null,
    reason: "",
  });
  const [detailLembaga, setDetailLembaga] = useState<Lembaga | null>(null);

  const handleDelete = (lembaga: Lembaga) => {
    setConfirmState({ isOpen: true, lembaga });
  };

  const handleConfirmDelete = () => {
    if (!confirmState.lembaga) return;
    const id = confirmState.lembaga.id;
    const name = confirmState.lembaga.name;

    startTransition(async () => {
      const result = await deleteLembagaAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Berhasil menghapus data lembaga "${name}"`);
      window.location.reload();
      setConfirmState({ isOpen: false, lembaga: null });
    });
  };

  const handleApprove = (lembaga: Lembaga) => {
    startTransition(async () => {
      const result = await approveLembagaAction(lembaga.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Lembaga "${lembaga.name}" telah disetujui`);
        window.location.reload();
      }
    });
  };

  const handleReject = (lembaga: Lembaga) => {
    setRejectState({ isOpen: true, lembaga, reason: "" });
  };

  const handleConfirmReject = () => {
    if (!rejectState.lembaga || !rejectState.reason.trim()) return;
    const { lembaga, reason } = rejectState;
    startTransition(async () => {
      const result = await rejectLembagaAction(lembaga.id, reason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Lembaga "${lembaga.name}" telah ditolak`);
        window.location.reload();
      }
      setRejectState({ isOpen: false, lembaga: null, reason: "" });
    });
  };

  const columns = getLembagaColumns({
    onDelete: handleDelete,
    onView: (lembaga) => setDetailLembaga(lembaga),
    onApprove: handleApprove,
    onReject: handleReject,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={lembagas}
        pagination={pagination}
        emptyTitle="Tidak ada data lembaga ditemukan"
        emptyDescription="Daftar lembaga kosong atau tidak ada data yang sesuai."
      />

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ isOpen: false, lembaga: null })}
        onConfirm={handleConfirmDelete}
        title="Konfirmasi Hapus Lembaga"
        message={`Apakah Anda yakin ingin menghapus lembaga "${confirmState.lembaga?.name}"? Lembaga hanya dapat dihapus jika belum memiliki program, transaksi, atau aktivitas terkait.`}
        confirmText="Hapus"
        cancelText="Batal"
        intent="destructive"
        isLoading={isPending}
      />

      {rejectState.isOpen && rejectState.lembaga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-2xl shadow-xl border border-border/40 p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-primary">Tolak Pendaftaran Lembaga</h3>
            <p className="text-sm text-secondary">
              Berikan alasan penolakan untuk "{rejectState.lembaga.name}". Alasan ini akan ditampilkan kepada admin lembaga saat mereka mencoba login.
            </p>
            <textarea
              value={rejectState.reason}
              onChange={(e) => setRejectState((s) => ({ ...s, reason: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-border/60 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="Contoh: Dokumen legalitas tidak lengkap/tidak sesuai."
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectState({ isOpen: false, lembaga: null, reason: "" })}
                className="px-4 py-2 text-sm font-semibold text-secondary hover:text-primary transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectState.reason.trim() || isPending}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-destructive text-white hover:bg-destructive/90 transition disabled:opacity-50"
              >
                Tolak Pendaftaran
              </button>
            </div>
          </div>
        </div>
      )}

      {detailLembaga && (
        <LembagaApprovalModal
          lembaga={detailLembaga}
          onClose={() => setDetailLembaga(null)}
          onApprove={() => {
            handleApprove(detailLembaga);
            setDetailLembaga(null);
          }}
          onReject={() => {
            setDetailLembaga(null);
            handleReject(detailLembaga);
          }}
        />
      )}
    </>
  );
}
