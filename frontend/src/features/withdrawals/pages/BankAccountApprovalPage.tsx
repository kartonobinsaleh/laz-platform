import { useState } from "react";
import { Button, Card, CardContent, Dialog, PageHeader } from "@/components/ui";
import { toast } from "@/stores/toast.store";
import { useBankChanges, useReviewBankChange, type BankAccountChangeRequest } from "../api/withdrawals";
import { BankChangeComparison, BankChangeReason, BankChangeStatus } from "../components/BankChangeHistory";

export function BankAccountApprovalPage() {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<{ request: BankAccountChangeRequest; approve: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const query = useBankChanges("admin", page, status);
  const mutation = useReviewBankChange();
  const submit = async () => {
    if (!review || mutation.isPending || (!review.approve && !reason.trim())) return;
    try {
      await mutation.mutateAsync({ id: review.request.id, approve: review.approve, reason });
      toast.success(review.approve ? "Rekening baru disetujui dan langsung aktif." : "Pengajuan ditolak. Alasan dapat dibaca pemohon.");
      setReview(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Pengajuan gagal diproses."); }
  };
  return <div className="space-y-6">
    <PageHeader title="Approval Rekening" description="Tinjau pengubahan rekening utama Lembaga dan Finance Platform" />
    <div className="space-y-2">
      <p className="text-sm font-medium">Status pengajuan</p>
      <div className="flex flex-wrap gap-2" aria-label="Filter status pengajuan rekening">
        {[
          { value: "PENDING", label: "Pending" },
          { value: "APPROVED", label: "Disetujui" },
          { value: "REJECTED", label: "Ditolak" },
          { value: "", label: "Semua Status" },
        ].map((option) => (
          <Button
            key={option.value || "ALL"}
            intent={status === option.value ? "primary" : "outline"}
            aria-pressed={status === option.value}
            onClick={() => { setStatus(option.value); setPage(1); }}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
    {query.isLoading ? <p role="status">Memuat pengajuan…</p> : query.isError ? <div role="alert"><p>Pengajuan rekening belum dapat dimuat.</p><Button onClick={() => void query.refetch()}>Coba lagi</Button></div>
      : !query.data?.data.length ? <p className="text-secondary">Tidak ada pengajuan rekening untuk status ini.</p>
      : query.data.data.map((request) => <Card key={request.id}><CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-bold text-primary">{request.lembaga?.name ?? "Finance Platform"}</h2>
            <p className="text-sm text-secondary">{request.requestedBy?.name ?? "Pemohon"} · {new Date(request.createdAt).toLocaleString("id-ID")}</p>
          </div><BankChangeStatus status={request.status} />
        </div>
        <BankChangeComparison request={request} />
        <BankChangeReason reason={request.changeReason} />
        {request.rejectionReason && <p className="whitespace-pre-wrap break-words text-sm text-red-700">Alasan penolakan: {request.rejectionReason}</p>}
        {request.reviewedAt && <p className="text-sm text-secondary">Diproses oleh {request.reviewedBy?.name ?? "Super Admin"} · {new Date(request.reviewedAt).toLocaleString("id-ID")}</p>}
        {request.status === "PENDING" && <div className="flex justify-end gap-2">
          <Button intent="outline" onClick={() => { setReason(""); setReview({ request, approve: false }); }}>Tolak</Button>
          <Button onClick={() => { setReason(""); setReview({ request, approve: true }); }}>Setujui</Button>
        </div>}
      </CardContent></Card>)}
    <div className="flex items-center justify-end gap-3">
      <Button intent="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
      <span className="text-sm">Halaman {page}</span>
      <Button intent="outline" disabled={page >= (query.data?.meta?.totalPages ?? 1) || query.isFetching} onClick={() => setPage(page + 1)}>Berikutnya</Button>
    </div>
    <Dialog isOpen={!!review} onClose={() => { if (!mutation.isPending) setReview(null); }} title={review?.approve ? "Setujui pengubahan rekening" : "Tolak pengubahan rekening"}>
      {review && <div className="space-y-4">
        <BankChangeComparison request={review.request} />
        <BankChangeReason reason={review.request.changeReason} />
        {review.approve ? <p className="text-sm">Rekening yang diajukan akan menjadi rekening utama untuk pengajuan penarikan berikutnya.</p> : <div>
          <label htmlFor="bank-rejection-reason" className="mb-2 block text-sm font-medium">Alasan penolakan (wajib, dapat dibaca pemohon)</label>
          <textarea id="bank-rejection-reason" className="w-full rounded-xl border border-border bg-surface p-3" rows={4} maxLength={2000} required value={reason} onChange={(e) => setReason(e.target.value)} disabled={mutation.isPending} />
        </div>}
        <div className="flex justify-end gap-2"><Button intent="outline" disabled={mutation.isPending} onClick={() => setReview(null)}>Batal</Button>
          <Button isLoading={mutation.isPending} disabled={!review.approve && !reason.trim()} onClick={() => void submit()}>{review.approve ? "Setujui dan aktifkan" : "Tolak pengajuan"}</Button>
        </div>
      </div>}
    </Dialog>
  </div>;
}
