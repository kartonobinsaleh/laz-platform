import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  Clock3,
  History,
  Landmark,
  Layers3,
  Wallet,
} from "lucide-react";
import {
  useGetMyWithdrawals,
  useCreateWithdrawal,
  useBankAccounts,
  useProgramWithdrawalBalances,
  type LembagaBankAccount,
  type ProgramWithdrawalBalance,
  type Withdrawal,
} from "../api/withdrawals";
import { api } from "@/lib/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  PageHeader,
  Select,
  TableSkeleton,
} from "@/components/ui";
import { toast } from "@/stores/toast.store";
import { formatCurrency } from "@/lib/utils";
import { formatIdrAmountInput } from "../utils/amount";

interface LembagaProfileWithBalance {
  balance?: {
    balance?: string | number;
    reservedBalance?: string | number;
  };
}

const statusConfig: Record<Withdrawal["status"], { label: string; intent: "success" | "warning" | "destructive" | "info" | "muted" }> = {
  PENDING: { label: "Menunggu", intent: "warning" },
  APPROVED: { label: "Disetujui", intent: "info" },
  PROCESSING: { label: "Diproses", intent: "warning" },
  COMPLETED: { label: "Selesai", intent: "success" },
  REJECTED: { label: "Ditolak", intent: "destructive" },
  FAILED: { label: "Gagal", intent: "destructive" },
  REVERSED: { label: "Dikembalikan", intent: "muted" },
};

const programStatusLabels: Record<string, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Aktif",
  CLOSED: "Ditutup",
  COMPLETED: "Selesai",
  ARCHIVED: "Diarsipkan",
};

export function LembagaWithdrawalPage() {
  const [page] = useState(1);
  const [amount, setAmount] = useState("");
  const [programId, setProgramId] = useState("");
  const formRef = useRef<HTMLElement>(null);

  const { data: myProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["lembaga-me"],
    queryFn: async () => {
      const { data } = await api.get<LembagaProfileWithBalance>("/lembaga/me");
      return data;
    },
  });

  const { data: withdrawals, isLoading, refetch: refetchWithdrawals } = useGetMyWithdrawals(page, 10);
  const createWithdrawal = useCreateWithdrawal();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: programBalances = [], refetch: refetchProgramBalances } = useProgramWithdrawalBalances();

  const balance = Number(myProfile?.balance?.balance ?? 0);
  const reservedBalance = Number(myProfile?.balance?.reservedBalance ?? 0);
  const selectedBank = bankAccounts.find((account) => account.isActive && account.isDefault) ?? bankAccounts.find((account) => account.isActive);
  const selectedProgram = programBalances.find((item) => item.programId === programId);
  const selectedProgramBalance = Number(selectedProgram?.balance ?? 0);
  const isBankConfigured = Boolean(selectedBank);
  const withdrawableProgramCount = programBalances.filter((item) => Number(item.balance) > 0).length;
  const numericAmount = Number(amount.replace(/\D/g, ""));
  const exceedsProgramBalance = Boolean(selectedProgram && numericAmount > selectedProgramBalance);

  const selectProgram = (item: ProgramWithdrawalBalance, scrollToForm = false) => {
    setProgramId(item.programId);
    setAmount("");
    if (scrollToForm) {
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const handleWithdraw = async () => {
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      toast.error("Masukkan nominal pencairan yang valid");
      return;
    }
    if (!selectedProgram) {
      toast.error("Pilih program sumber dana");
      return;
    }
    if (numericAmount > selectedProgramBalance) {
      toast.error("Saldo program tidak mencukupi");
      return;
    }
    if (!selectedBank) {
      toast.error("Rekening bank lembaga belum dikonfigurasi");
      return;
    }

    try {
      await createWithdrawal.mutateAsync({ amount: numericAmount, programId: selectedProgram.programId });
      toast.success("Pengajuan pencairan berhasil dibuat!");
      setAmount("");
      void refetchProfile();
      void refetchProgramBalances();
      void refetchWithdrawals();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Gagal membuat pengajuan pencairan");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      <PageHeader
        title="Pengajuan Penarikan"
        description="Pilih program, tentukan nominal, lalu ajukan pencairan ke rekening resmi lembaga."
        action={
          <Link
            to="/dashboard/lembaga/finance/overview"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
          >
            Ringkasan keuangan <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section ref={formRef} aria-label="Formulir dan ringkasan penarikan" className="scroll-mt-6">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <WithdrawalForm
            amount={amount}
            setAmount={setAmount}
            programId={programId}
            programBalances={programBalances}
            selectedProgram={selectedProgram}
            selectedProgramBalance={selectedProgramBalance}
            selectedBank={selectedBank}
            isBankConfigured={isBankConfigured}
            exceedsProgramBalance={exceedsProgramBalance}
            isPending={createWithdrawal.isPending}
            onProgramChange={(id) => {
              setProgramId(id);
              setAmount("");
            }}
            onSubmit={() => void handleWithdraw()}
          />

          <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1" aria-label="Ringkasan penarikan">
            <CompactBalanceSummary
              balance={balance}
              reservedBalance={reservedBalance}
              withdrawableProgramCount={withdrawableProgramCount}
              totalProgramCount={programBalances.length}
            />
            <BankDestinationCard selectedBank={selectedBank} />
          </aside>
        </div>
      </section>

      <ProgramBalanceSection
        programBalances={programBalances}
        selectedProgramId={programId}
        onSelect={(item) => selectProgram(item, true)}
      />

      <WithdrawalHistory withdrawals={withdrawals?.data ?? []} isLoading={isLoading} />
    </div>
  );
}

function WithdrawalForm({
  amount,
  setAmount,
  programId,
  programBalances,
  selectedProgram,
  selectedProgramBalance,
  selectedBank,
  isBankConfigured,
  exceedsProgramBalance,
  isPending,
  onProgramChange,
  onSubmit,
}: {
  amount: string;
  setAmount: (value: string) => void;
  programId: string;
  programBalances: ProgramWithdrawalBalance[];
  selectedProgram?: ProgramWithdrawalBalance;
  selectedProgramBalance: number;
  selectedBank?: LembagaBankAccount;
  isBankConfigured: boolean;
  exceedsProgramBalance: boolean;
  isPending: boolean;
  onProgramChange: (id: string) => void;
  onSubmit: () => void;
}) {
  const canSubmit = isBankConfigured && Boolean(selectedProgram) && selectedProgramBalance > 0 && Boolean(amount) && !exceedsProgramBalance && !isPending;

  return (
    <Card className="border-border/70 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-border/60 bg-gradient-to-r from-emerald-50/80 to-transparent p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-brand-primary p-2.5 text-white shadow-sm">
            <ArrowDownToLine className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-primary">Ajukan pencairan dana</h2>
            <p className="mt-1 text-sm text-secondary">Lengkapi dua langkah berikut untuk membuat pengajuan.</p>
          </div>
        </div>
        <Badge className="self-start" intent={isBankConfigured ? "success" : "warning"}>
          {isBankConfigured ? "Rekening siap" : "Rekening belum diatur"}
        </Badge>
      </div>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {!isBankConfigured && (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/20 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-sm text-warning">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Tambahkan rekening resmi sebelum mengajukan penarikan.</p>
            </div>
            <Link to="/dashboard/lembaga/finance/bank-account" className="shrink-0 text-sm font-semibold text-warning hover:underline">
              Atur rekening
            </Link>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="withdrawal-program" className="flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white">1</span>
              Program sumber dana
            </label>
            <Select
              id="withdrawal-program"
              value={programId}
              onChange={(event) => onProgramChange(event.target.value)}
              disabled={!isBankConfigured || isPending}
            >
              <option value="">Pilih program</option>
              {programBalances.map((item) => (
                <option key={item.programId} value={item.programId} disabled={Number(item.balance) <= 0}>
                  {item.program.title} — {formatCurrency(Number(item.balance))}
                </option>
              ))}
            </Select>
            <p className="text-xs text-secondary">Setiap program memiliki saldo penarikan terpisah.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="withdrawal-amount" className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white">2</span>
                Nominal pencairan
              </label>
              {selectedProgram && (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-primary hover:underline"
                  onClick={() => setAmount(formatIdrAmountInput(Math.floor(selectedProgramBalance)))}
                >
                  Gunakan maksimum
                </button>
              )}
            </div>
            <Input
              id="withdrawal-amount"
              type="text"
              inputMode="numeric"
              placeholder="Rp 0"
              value={amount ? `Rp ${amount}` : ""}
              onChange={(event) => setAmount(formatIdrAmountInput(event.target.value))}
              error={exceedsProgramBalance}
              disabled={!isBankConfigured || !selectedProgram || selectedProgramBalance <= 0 || isPending}
            />
            <p className={`text-xs ${exceedsProgramBalance ? "font-medium text-destructive" : "text-secondary"}`}>
              {selectedProgram
                ? exceedsProgramBalance
                  ? "Nominal melebihi saldo program."
                  : `Maksimum ${formatCurrency(selectedProgramBalance)}`
                : "Pilih program terlebih dahulu."}
            </p>
          </div>
        </div>

        {selectedProgram && (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Sumber dana terpilih</p>
              <p className="mt-1 truncate font-semibold text-primary">{selectedProgram.program.title}</p>
            </div>
            <p className="shrink-0 text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(selectedProgramBalance)}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-xs leading-relaxed text-secondary">
            Saldo akan dikunci setelah diajukan dan dikurangi permanen setelah transfer berhasil.
          </p>
          <Button
            className="min-w-48"
            onClick={onSubmit}
            disabled={!canSubmit}
            isLoading={isPending}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Ajukan penarikan
          </Button>
        </div>

        {selectedBank && (
          <p className="text-right text-xs text-secondary">
            Tujuan: {selectedBank.bankCode.replace(/^ID_/, "")} • {selectedBank.accountNumber} a.n. {selectedBank.accountHolder}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CompactBalanceSummary({
  balance,
  reservedBalance,
  withdrawableProgramCount,
  totalProgramCount,
}: {
  balance: number;
  reservedBalance: number;
  withdrawableProgramCount: number;
  totalProgramCount: number;
}) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Saldo dapat ditarik</p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-primary tabular-nums">
              {formatCurrency(balance)}
            </p>
          </div>
          <span className="rounded-xl bg-brand-primary/10 p-2.5 text-brand-primary">
            <Wallet className="h-5 w-5" />
          </span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-secondary"><Clock3 className="h-3.5 w-3.5" /> Diproses</dt>
            <dd className="mt-1.5 break-words text-sm font-bold text-primary tabular-nums">{formatCurrency(reservedBalance)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-secondary"><Layers3 className="h-3.5 w-3.5" /> Bisa ditarik</dt>
            <dd className="mt-1.5 text-sm font-bold text-primary">{withdrawableProgramCount} dari {totalProgramCount}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function BankDestinationCard({ selectedBank }: { selectedBank?: LembagaBankAccount }) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <span className={`rounded-xl p-2.5 ${selectedBank ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            {selectedBank ? <Landmark className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary">Rekening tujuan</p>
            {selectedBank ? (
              <>
                <p className="mt-2 font-bold text-primary">{selectedBank.bankCode.replace(/^ID_/, "")} • {selectedBank.accountNumber}</p>
                <p className="mt-0.5 truncate text-xs text-secondary">a.n. {selectedBank.accountHolder}</p>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-secondary">Belum ada rekening yang dapat digunakan.</p>
            )}
            <Link to="/dashboard/lembaga/finance/bank-account" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline">
              {selectedBank ? "Kelola rekening" : "Atur rekening"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgramBalanceSection({
  programBalances,
  selectedProgramId,
  onSelect,
}: {
  programBalances: ProgramWithdrawalBalance[];
  selectedProgramId: string;
  onSelect: (item: ProgramWithdrawalBalance) => void;
}) {
  return (
    <section aria-labelledby="program-balances-title" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">Rincian sumber dana</p>
        <h2 id="program-balances-title" className="mt-1 text-lg font-bold text-primary">Saldo per program</h2>
        <p className="mt-1 text-sm text-secondary">Pilih kartu untuk menggunakannya pada formulir penarikan di atas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {programBalances.map((item) => {
          const available = Number(item.balance);
          const reserved = Number(item.reservedBalance);
          const isSelected = selectedProgramId === item.programId;
          const canWithdraw = available > 0;

          return (
            <button
              key={item.programId}
              type="button"
              disabled={!canWithdraw}
              aria-pressed={isSelected}
              onClick={() => onSelect(item)}
              className={`group rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/15"
                  : canWithdraw
                    ? "border-border/70 bg-surface shadow-soft hover:border-emerald-400/60 hover:shadow-card"
                    : "cursor-not-allowed border-border/40 bg-surface-soft/60 opacity-65"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`rounded-lg p-2 ${isSelected ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}>
                    <Layers3 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-primary">{item.program.title}</p>
                    <p className="mt-0.5 text-[11px] text-secondary">
                      {programStatusLabels[item.program.status] ?? item.program.status.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                <Badge intent={isSelected || canWithdraw ? "success" : "muted"}>
                  {isSelected ? "Dipilih" : canWithdraw ? "Tersedia" : "Habis"}
                </Badge>
              </div>

              <div className="mt-4">
                <p className="text-xs text-secondary">Dapat ditarik</p>
                <p className="mt-1 break-words text-xl font-bold tracking-tight text-primary tabular-nums">{formatCurrency(available)}</p>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px]">
                <div>
                  <dt className="text-secondary">Program</dt>
                  <dd className="mt-1 break-words font-semibold text-primary tabular-nums">{formatCurrency(Number(item.mustahiqBalance))}</dd>
                </div>
                <div>
                  <dt className="text-secondary">Amil</dt>
                  <dd className="mt-1 break-words font-semibold text-primary tabular-nums">{formatCurrency(Number(item.amilBalance))}</dd>
                </div>
                <div>
                  <dt className="text-secondary">Diproses</dt>
                  <dd className="mt-1 break-words font-semibold text-warning tabular-nums">{formatCurrency(reserved)}</dd>
                </div>
              </dl>
            </button>
          );
        })}

        {!programBalances.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-surface-soft/50 p-8 text-center">
            <Layers3 className="mx-auto h-8 w-8 text-secondary/50" />
            <p className="mt-3 font-semibold text-primary">Belum ada saldo program</p>
            <p className="mt-1 text-sm text-secondary">Saldo akan muncul setelah program menerima donasi berhasil.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function WithdrawalHistory({ withdrawals, isLoading }: { withdrawals: Withdrawal[]; isLoading: boolean }) {
  return (
    <section aria-labelledby="withdrawal-history-title" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">Aktivitas terbaru</p>
        <h2 id="withdrawal-history-title" className="mt-1 text-lg font-bold text-primary">Riwayat penarikan</h2>
        <p className="mt-1 text-sm text-secondary">Pantau status pengajuan dan hasil transfer sebelumnya.</p>
      </div>

      {isLoading ? (
        <TableSkeleton
          headers={["Tanggal", "Program", "Nominal", "Bank tujuan", "Status", "Keterangan"]}
          rowCount={5}
          columnTypes={["text", "text", "text", "text", "text", "text"]}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-surface-soft/70 text-xs uppercase text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Program</th>
                  <th className="px-4 py-3 font-semibold">Nominal</th>
                  <th className="px-4 py-3 font-semibold">Bank tujuan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {!withdrawals.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <History className="mx-auto h-7 w-7 text-secondary/40" />
                      <p className="mt-3 font-medium text-primary">Belum ada riwayat penarikan</p>
                      <p className="mt-1 text-xs text-secondary">Pengajuan baru akan muncul di bagian ini.</p>
                    </td>
                  </tr>
                )}
                {withdrawals.map((withdrawal) => {
                  const status = statusConfig[withdrawal.status];
                  return (
                    <tr key={withdrawal.id} className="transition-colors hover:bg-surface-muted/50">
                      <td className="whitespace-nowrap px-4 py-3 text-secondary">
                        {new Date(withdrawal.createdAt).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-medium text-primary">{withdrawal.program?.title || "Data lama"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-primary tabular-nums">
                        {formatCurrency(Number(withdrawal.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap font-medium text-primary">{withdrawal.bankCode.replace(/^ID_/, "")} • {withdrawal.accountNumber}</p>
                        <p className="mt-0.5 text-xs text-secondary">a.n. {withdrawal.accountHolder}</p>
                      </td>
                      <td className="px-4 py-3"><Badge intent={status.intent}>{status.label}</Badge></td>
                      <td className="max-w-xs truncate px-4 py-3 text-secondary">{withdrawal.rejectionReason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
