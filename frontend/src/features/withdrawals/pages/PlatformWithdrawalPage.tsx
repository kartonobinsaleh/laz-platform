import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCreatePlatformWithdrawal, usePlatformBalance, useSavePlatformBankAccount, type Withdrawal } from "../api/withdrawals";
import { Badge, Button, Card, CardContent, Dialog, PageHeader, Input, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/stores/toast.store";
import { ArrowRight, CheckCircle2, Clock3, Info, Landmark, Pencil, Plus, Wallet } from "lucide-react";
import { BANK_OPTIONS, getBankLabel } from "../constants/banks";
import { formatIdrAmountInput } from "../utils/amount";
import { PlatformWithdrawalHistory } from "../components/PlatformWithdrawalHistory";

export function PlatformWithdrawalPage() {
  const { data: platformBalance, isLoading, isError, isFetching, refetch } = usePlatformBalance();
  const saveBank = useSavePlatformBankAccount();
  const createWithdrawal = useCreatePlatformWithdrawal();
  const submitting = useRef(false);
  const [amount, setAmount] = useState("");
  const [editingBank, setEditingBank] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankError, setBankError] = useState("");
  const [submitted, setSubmitted] = useState<Withdrawal | null>(null);

  const availableBalance = Number(platformBalance?.balance ?? 0);
  const reservedBalance = Number(platformBalance?.reservedBalance ?? 0);
  const isBankConfigured = Boolean(platformBalance?.bankCode && platformBalance.accountNumber && platformBalance.accountHolder);
  const parsedAmount = Number(amount.replace(/\D/g, ""));
  const amountError = amount && (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0)
    ? "Masukkan nominal lebih dari Rp0."
    : parsedAmount > availableBalance ? "Nominal melebihi saldo yang tersedia." : "";
  const canWithdraw = isBankConfigured && !editingBank && parsedAmount > 0 && !amountError && !isFetching && !isError && !createWithdrawal.isPending;

  const startEditBank = () => {
    setBankCode(platformBalance?.bankCode ?? "");
    setAccountNumber(platformBalance?.accountNumber ?? "");
    setAccountHolder(platformBalance?.accountHolder ?? "");
    setBankError("");
    setEditingBank(true);
  };

  const handleSaveBank = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saveBank.isPending) return;
    if (!bankCode || !/^\d{5,30}$/.test(accountNumber) || !accountHolder.trim()) {
      setBankError("Pilih bank, isi nomor rekening 5–30 digit, dan nama pemilik rekening.");
      return;
    }
    setBankError("");
    try {
      await saveBank.mutateAsync({ bankCode, accountNumber, accountHolder: accountHolder.trim() });
      setEditingBank(false);
      toast.success("Rekening tujuan berhasil disimpan");
    } catch (error: unknown) {
      setBankError(error instanceof Error ? error.message : "Rekening gagal disimpan. Silakan coba lagi.");
    }
  };

  const handleWithdraw = async () => {
    if (!canWithdraw || submitting.current) return;
    submitting.current = true;
    try {
      const withdrawal = await createWithdrawal.mutateAsync(parsedAmount);
      setAmount("");
      setSubmitted(withdrawal);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Pengajuan gagal dibuat. Silakan coba lagi.");
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <Dialog isOpen={Boolean(submitted)} onClose={() => setSubmitted(null)} title="Pengajuan berhasil">
        {submitted && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
              </div>
              <h4 className="text-xl font-bold text-primary">Pengajuan penarikan berhasil dibuat</h4>
              <p className="mt-2 text-sm leading-relaxed text-secondary">Pengajuan menunggu persetujuan sebelum dana dikirim.</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-surface-soft p-5">
              <p className="text-sm text-secondary">Nominal penarikan</p>
              <p className="mt-1 break-words text-3xl font-bold tracking-tight text-primary">{formatCurrency(Number(submitted.amount))}</p>
              <div className="mt-4 flex items-start gap-3 border-t border-border/50 pt-4">
                <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-primary">{getBankLabel(submitted.bankCode)}</p>
                  <p className="mt-1 break-all text-secondary">{submitted.accountNumber}</p>
                  <p className="mt-1 break-words text-secondary">a.n. {submitted.accountHolder}</p>
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={() => setSubmitted(null)} autoFocus>Mengerti</Button>
          </div>
        )}
      </Dialog>
      <PageHeader title="Penarikan Platform" description="Kelola rekening tujuan dan ajukan penarikan saldo porsi amil platform."
        action={<Link to="/dashboard/withdrawals" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Antrean penarikan <ArrowRight className="h-4 w-4" />
        </Link>} />

      {isLoading ? (
        <div role="status" className="space-y-5">
          <p className="text-sm text-secondary">Memuat saldo dan rekening tujuan…</p>
          <div className="h-44 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
      ) : isError || !platformBalance ? (
        <Card>
          <CardContent>
            <div role="alert" className="space-y-3">
              <h2 className="font-semibold text-primary">Saldo dan rekening belum dapat dimuat</h2>
              <p className="text-sm text-secondary">Coba muat ulang untuk melanjutkan penarikan.</p>
              <Button onClick={() => void refetch()} isLoading={isFetching}>Coba lagi</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-950 to-teal-800 p-4 text-white sm:p-5 md:col-span-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                <Wallet className="h-5 w-5" /> Saldo tersedia untuk ditarik</div>
              <p className="mt-2 break-words text-2xl font-bold tracking-tight">{formatCurrency(availableBalance)}</p>
            </div>
            <Card className="md:col-span-2">
              <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                  <Clock3 className="h-5 w-5 text-amber-600" /> Saldo di proses</div>
                <p className="mt-2 break-words text-2xl font-bold text-primary">{formatCurrency(reservedBalance)}</p>
              </div>
            </Card>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <CardContent className="space-y-6">
                <div className="flex items-start gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-primary">Rekening tujuan</h2>
                    <p className="mt-1 text-sm text-secondary">Dana akan dikirim ke rekening yang tersimpan di sini.</p>
                  </div>
                </div>
                {editingBank ? (
                  <form onSubmit={handleSaveBank} className="space-y-4">
                    <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Perubahan rekening perlu disimpan sebelum Anda mengajukan penarikan.</div>
                    <fieldset disabled={saveBank.isPending} className="space-y-4">
                      <div>
                        <label htmlFor="platform-bank" className="mb-1.5 block text-sm font-medium text-primary">Bank tujuan</label>
                        <Select id="platform-bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} required autoFocus>
                          <option value="">Pilih bank</option>{bankCode && !BANK_OPTIONS.some((bank) => bank.value === bankCode) && <option value={bankCode}>{getBankLabel(bankCode)}</option>}{BANK_OPTIONS.map((bank) => <option key={bank.value} value={bank.value}>{bank.label}</option>)}</Select>
                      </div>
                      <div>
                        <label htmlFor="platform-account-number" className="mb-1.5 block text-sm font-medium text-primary">Nomor rekening</label>
                        <Input id="platform-account-number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={30} pattern="[0-9]{5,30}" required placeholder="Masukkan nomor rekening" aria-describedby="account-number-help" />
                        <p id="account-number-help" className="mt-1.5 text-xs text-secondary">5–30 digit angka, tanpa spasi atau tanda hubung.</p>
                      </div>
                      <div>
                        <label htmlFor="platform-account-holder" className="mb-1.5 block text-sm font-medium text-primary">Nama pemilik rekening</label>
                        <Input id="platform-account-holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required placeholder="Sesuai nama pada rekening bank" />
                      </div>
                    </fieldset>
                    {bankError && <p role="alert" className="text-sm text-destructive">{bankError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" isLoading={saveBank.isPending}>Simpan rekening</Button>
                      <Button intent="ghost" onClick={() => setEditingBank(false)} disabled={saveBank.isPending}>Batal</Button>
                    </div>
                  </form>
                ) : isBankConfigured ? (
                  <>
                    <div className="rounded-xl border border-border/50 bg-surface-soft p-5">
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <Landmark className="h-6 w-6 text-primary" />
                        <Badge intent="success">Rekening tersimpan</Badge>
                      </div>
                      <p className="font-semibold text-primary">{getBankLabel(platformBalance.bankCode!)}</p>
                      <p className="mt-3 break-all text-2xl font-bold tracking-wide text-primary">{platformBalance.accountNumber}</p>
                      <p className="mt-2 break-words text-sm text-secondary">a.n. <span className="font-medium text-primary">{platformBalance.accountHolder}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-secondary">Pastikan data rekening sudah benar.</p>
                      <Button intent="outline" size="sm" onClick={startEditBank} disabled={createWithdrawal.isPending}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Ubah rekening</Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-surface-soft p-6 text-center">
                    <Landmark className="mx-auto mb-3 h-8 w-8 text-secondary" />
                    <h3 className="font-semibold text-primary">Belum ada rekening tujuan</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary">Tambahkan rekening bank platform agar penarikan dapat diajukan.</p>
                    <Button className="mt-5" onClick={startEditBank}>
                      <Plus className="mr-2 h-4 w-4" /> Tambah rekening</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-3">
              <CardContent className="space-y-6">
                <div className="flex items-start gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-primary">Ajukan penarikan (WD)</h2>
                    <p className="mt-1 text-sm text-secondary">Tentukan nominal untuk diajukan ke rekening tujuan.</p>
                  </div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); void handleWithdraw(); }} className="space-y-5">
                  {(!isBankConfigured || editingBank || availableBalance <= 0) && <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{editingBank ? "Simpan atau batalkan perubahan rekening untuk melanjutkan penarikan." : !isBankConfigured ? "Tambahkan rekening tujuan terlebih dahulu." : "Belum ada saldo tersedia yang dapat ditarik."}</p>
                  </div>}
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="platform-withdrawal-amount" className="text-sm font-medium text-primary">Nominal penarikan</label>
                      <Button intent="ghost" size="sm" disabled={!isBankConfigured || editingBank || availableBalance < 1 || isFetching || createWithdrawal.isPending} onClick={() => setAmount(formatIdrAmountInput(Math.floor(availableBalance)))}>Tarik semua saldo</Button>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center font-semibold text-secondary">Rp</span>
                      <Input id="platform-withdrawal-amount" className="py-4 pl-12 text-xl font-semibold sm:text-xl" value={amount} onChange={(e) => setAmount(formatIdrAmountInput(e.target.value))} placeholder="0" inputMode="numeric" disabled={!isBankConfigured || editingBank || availableBalance <= 0 || createWithdrawal.isPending} error={Boolean(amountError)} aria-describedby="withdrawal-amount-help" />
                    </div>
                    <p id="withdrawal-amount-help" aria-live="polite" className={`mt-2 text-sm ${amountError ? "text-destructive" : "text-secondary"}`}>{amountError || `Maksimum penarikan ${formatCurrency(availableBalance)}.`}</p>
                  </div>
                  <Button type="submit" className="w-full gap-2" size="lg" disabled={!canWithdraw} isLoading={createWithdrawal.isPending}>Ajukan penarikan <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          <PlatformWithdrawalHistory />
        </>
      )}
    </div>
  );
}
