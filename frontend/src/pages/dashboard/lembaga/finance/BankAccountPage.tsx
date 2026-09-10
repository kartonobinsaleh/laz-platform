import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Building2, Pencil, Plus, ShieldCheck, Wifi } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader, Input, Select, Button, Card, CardContent } from "@/components/ui";
import { toast } from "@/stores/toast.store";
import {
  useBankAccounts,
  useBankChanges,
  useSaveBankAccount,
  type LembagaBankAccount,
} from "@/features/withdrawals/api/withdrawals";
import { BANK_OPTIONS, getBankLabel } from "@/features/withdrawals/constants/banks";
import { BANK_CHANGE_WARNING, BankChangeHistory } from "@/features/withdrawals/components/BankChangeHistory";

type FormState = {
  id?: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  changeReason: string;
};

const emptyForm: FormState = {
  bankCode: "", accountNumber: "", accountHolder: "", changeReason: "",
};

export function BankAccountPage() {
  const { user } = useAuth();
  const { data: accounts = [], isLoading, isError, refetch } = useBankAccounts();
  const changes = useBankChanges("lembaga");
  const pendingChange = changes.data?.data.some((request) => request.status === "PENDING");
  const save = useSaveBankAccount();
  const [form, setForm] = useState<FormState | null>(null);

  if (!user?.lembagaId) return <Navigate to="/dashboard" replace />;

  const edit = (account: LembagaBankAccount) => setForm({
    id: account.id,
    bankCode: account.bankCode,
    accountNumber: account.accountNumber,
    accountHolder: account.accountHolder,
    changeReason: "",
  });

  const submit = async () => {
    if (save.isPending || pendingChange) return;
    if (!form?.bankCode || !/^\d{5,30}$/.test(form.accountNumber) || !form.accountHolder.trim() || (form.id && !form.changeReason.trim())) {
      toast.error(form?.id ? "Lengkapi data rekening dan alasan pengubahan." : "Lengkapi Bank, nomor rekening 5-30 digit, dan nama pemilik.");
      return;
    }
    try {
      await save.mutateAsync(form);
      toast.success(form.id ? "Pengubahan rekening diajukan. Status pending menunggu persetujuan platform Ruang Berbagi." : "Rekening lembaga berhasil disimpan dan langsung dapat digunakan.");
      setForm(null);
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan rekening Bank");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Rekening Bank Lembaga"
        description="Satu rekening resmi digunakan untuk seluruh pencairan dana Lembaga." />

      {isError && <div role="alert"><p>Rekening belum dapat dimuat.</p><Button onClick={() => void refetch()}>Coba lagi</Button></div>}
      {pendingChange && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pengubahan rekening masih pending. Rekening lama tetap aktif sampai platform Ruang Berbagi menyetujui pengajuan.</p>}
      {!accounts.length && !isLoading && !isError && (
        <div className="flex justify-end">
          <Button onClick={() => setForm({ ...emptyForm })}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Rekening
          </Button>
        </div>
      )}

      {form && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-bold text-primary">{form.id ? "Ubah Rekening" : "Tambah Rekening"}</h2>
            <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{form.id ? BANK_CHANGE_WARNING : "Rekening pertama langsung aktif setelah disimpan. Perubahan berikutnya memerlukan persetujuan platform Ruang Berbagi."}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bank</label>
                <Select value={form.bankCode} onChange={(event) => setForm({ ...form, bankCode: event.target.value })}>
                  <option value="">Pilih Bank</option>
                  {BANK_OPTIONS.map((bank) => (
                    <option key={bank.value} value={bank.value}>{bank.label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nomor Rekening</label>
                <Input value={form.accountNumber} maxLength={30}
                  onChange={(event) => setForm({ ...form, accountNumber: event.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Atas Nama</label>
                <Input value={form.accountHolder}
                  onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} />
              </div>
              {form.id && <div className="space-y-2 md:col-span-2">
                <label htmlFor="lembaga-bank-change-reason" className="text-sm font-medium">Alasan pengubahan</label>
                <textarea id="lembaga-bank-change-reason" className="min-h-28 w-full resize-y rounded-xl border border-border bg-surface p-3 text-sm" maxLength={2000} required value={form.changeReason} onChange={(event) => setForm({ ...form, changeReason: event.target.value })} placeholder="Jelaskan alasan rekening utama perlu diubah" />
                <p className="text-xs text-secondary">Wajib diisi · maksimal 2.000 karakter ({form.changeReason.length}/2.000)</p>
              </div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button intent="outline" disabled={save.isPending} onClick={() => setForm(null)}>Batal</Button>
              <Button onClick={submit} isLoading={save.isPending} disabled={pendingChange || (Boolean(form.id) && (changes.isLoading || changes.isError))}>{form.id ? "Ajukan pengubahan rekening" : "Simpan rekening"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p className="text-secondary">Memuat rekening...</p> : (
        <div className="grid grid-cols-1 gap-6">
          {accounts.map((account) => (
            <Card key={account.id} className="border-0 bg-transparent overflow-visible">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,560px)_1fr] gap-5 items-stretch">
                  <div className="relative min-h-[290px] overflow-hidden rounded-[28px] bg-gradient-to-br from-zinc-950 via-zinc-900 to-slate-800 p-6 sm:p-8 text-white shadow-2xl shadow-black/20 ring-1 ring-white/10">
                    <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.03]" />
                    <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full border border-white/10 bg-white/[0.02]" />
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_25%,rgba(255,255,255,0.06)_48%,transparent_68%)]" />

                    <div className="relative flex h-full flex-col justify-between gap-8">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">Rekening Pencairan</p>
                          <p className="mt-1 text-lg font-bold tracking-wide">RUANG BERBAGI</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Rekening Utama
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="grid h-10 w-14 grid-cols-3 grid-rows-2 overflow-hidden rounded-lg border border-amber-200/40 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-inner">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <span key={index} className="border border-amber-900/20" />
                          ))}
                        </div>
                        <Wifi className="h-7 w-7 rotate-90 text-white/60" />
                      </div>

                      <div>
                        <p className="font-mono text-xl sm:text-2xl font-semibold tracking-[0.16em] sm:tracking-[0.22em] text-white break-all">
                          {account.accountNumber.replace(/(.{4})/g, "$1 ").trim()}
                        </p>
                        <div className="mt-6 flex items-end justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Pemilik Rekening</p>
                            <p className="mt-1 truncate text-sm font-semibold uppercase tracking-wider">{account.accountHolder}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Bank</p>
                            <p className="mt-1 text-lg font-black tracking-wider">{account.bankCode.replace(/^ID_/, "")}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-border/40 bg-surface p-5 sm:p-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-surface-soft p-2.5">
                          <Building2 className="h-5 w-5 text-primary" />
                        </span>
                        <div>
                          <p className="font-bold text-primary">Detail Rekening Utama</p>
                          <p className="text-sm text-secondary">{account.isActive ? "Digunakan otomatis untuk seluruh pencairan." : "Rekening tidak aktif. Ajukan perubahan untuk mengaktifkan rekening pengganti."}</p>
                        </div>
                      </div>
                      <dl className="mt-6 space-y-4 text-sm">
                        <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
                          <dt className="text-secondary">Bank</dt>
                          <dd className="text-right font-semibold text-primary">
                            {getBankLabel(account.bankCode)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
                          <dt className="text-secondary">Nomor rekening</dt>
                          <dd className="font-mono font-semibold text-primary">{account.accountNumber}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-secondary">Akun pencatatan</dt>
                          <dd className="text-right font-semibold text-primary">
                            {account.chartOfAccount.code} — {account.chartOfAccount.name}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button size="sm" intent="outline" disabled={pendingChange || changes.isLoading || changes.isError || save.isPending} onClick={() => edit(account)}>
                        <Pencil className="mr-1.5 h-4 w-4" /> Ubah Rekening
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!accounts.length && !isError && <p className="text-secondary">Belum ada rekening Bank. Tambahkan rekening pertama untuk mulai melakukan pencairan.</p>}
        </div>
      )}
      <BankChangeHistory scope="lembaga" />
    </div>
  );
}
