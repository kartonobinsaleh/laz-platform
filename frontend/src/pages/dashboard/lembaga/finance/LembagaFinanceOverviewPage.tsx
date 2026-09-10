import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpenText,
  CircleDollarSign,
  HandCoins,
  HeartHandshake,
  Info,
  Landmark,
  RefreshCcw,
  Truck,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader, TableSkeleton } from "@/components/ui";
import { JournalTable } from "@/features/journal/components/JournalTable";
import { ReportingBalanceSummary } from "./ReportingBalanceSummary";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);

interface LembagaFinanceMetrics {
  mustahiqBalance?: number;
  amilBalance?: number;
  availableBalance?: number;
  reservedBalance?: number;
  totalReceived?: number;
  totalDistributed?: number;
  totalWithdrawn?: number;
}

interface DashboardOverviewData {
  metrics?: LembagaFinanceMetrics;
}

export function LembagaFinanceOverviewPage() {
  const { user } = useAuth();
  const lembagaId = user?.lembagaId;

  const {
    data: result,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["dashboard", "overview", lembagaId],
    queryFn: () => api.get<DashboardOverviewData>("/dashboard/overview"),
    enabled: Boolean(lembagaId),
  });

  const {
    data: journalResult,
    isLoading: isJournalLoading,
    isError: isJournalError,
    refetch: refetchJournal,
  } = useQuery({
    queryKey: ["journal", { page: 1, limit: 10, lembagaId }],
    queryFn: () => api.get<any[]>("/journal", { page: 1, limit: 10, lembagaId }),
    enabled: Boolean(lembagaId),
  });

  if (!lembagaId) {
    return <Navigate to="/dashboard" replace />;
  }

  const metrics = result?.data?.metrics;
  const journals = journalResult?.data ?? [];
  const mustahiqBalance = Number(metrics?.mustahiqBalance ?? 0);
  const amilBalance = Number(metrics?.amilBalance ?? 0);
  const availableGateway = Number(metrics?.availableBalance ?? 0);
  const reservedGateway = Number(metrics?.reservedBalance ?? 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      <PageHeader
        title="Ringkasan Keuangan"
        description="Pantau dana yang perlu disalurkan, saldo yang dapat ditarik, dan riwayat keuangan lembaga dalam satu halaman."
        action={
          <Link
            to="/dashboard/journal"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-primary shadow-soft transition hover:border-brand-primary/30 hover:text-brand-primary"
          >
            <BookOpenText className="h-4 w-4" />
            Lihat jurnal
          </Link>
        }
      />

      <BalanceGuide />

      {isOverviewLoading ? (
        <FinanceOverviewSkeleton />
      ) : isOverviewError || !metrics ? (
        <ErrorState
          title="Ringkasan saldo belum dapat dimuat"
          description="Coba muat ulang untuk mengambil data keuangan terbaru."
          onRetry={() => void refetchOverview()}
        />
      ) : (
        <>
          <section aria-label="Saldo lembaga" className="grid gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ReportingBalanceSummary
                mustahiqBalance={mustahiqBalance}
                amilBalance={amilBalance}
              />
            </div>

            <div className="xl:col-span-5">
              <GatewayBalanceSummary
                available={availableGateway}
                reserved={reservedGateway}
              />
            </div>
          </section>

          <ActivitySummary metrics={metrics} />
        </>
      )}

      <section aria-labelledby="recent-journals-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">Aktivitas terbaru</p>
            <h2 id="recent-journals-title" className="mt-1 text-lg font-bold text-primary">
              Mutasi jurnal
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Sepuluh transaksi terakhir yang tercatat dalam pembukuan lembaga.
            </p>
          </div>
          <Link
            to="/dashboard/journal"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
          >
            Lihat semua jurnal
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {isJournalLoading ? (
          <TableSkeleton
            headers={["No. jurnal & tanggal", "Deskripsi", "Total", "Status", "Aksi"]}
            rowCount={5}
            columnTypes={["text", "text", "text", "text", "action"]}
          />
        ) : isJournalError ? (
          <ErrorState
            title="Mutasi jurnal belum dapat dimuat"
            description="Data saldo tetap tersedia. Coba muat ulang bagian jurnal ini."
            onRetry={() => void refetchJournal()}
          />
        ) : (
          <JournalTable
            journals={journals}
            pagination={{ currentPage: 1, totalPages: 1, totalCount: journals.length, pageSize: 10 }}
          />
        )}
      </section>
    </div>
  );
}

function BalanceGuide() {
  return (
    <aside
      aria-label="Panduan membaca saldo"
      className="grid overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft lg:grid-cols-[auto_1fr_1fr]"
    >
      <div className="flex items-center gap-3 border-b border-border/60 bg-surface-muted/70 px-5 py-4 lg:border-b-0 lg:border-r">
        <span className="rounded-lg bg-brand-primary/10 p-2 text-brand-primary">
          <Info className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Panduan</p>
          <p className="text-sm font-bold text-primary">Dua saldo, dua kegunaan</p>
        </div>
      </div>

      <GuideItem
        number="1"
        title="Saldo pelaporan"
        description="Berkurang saat penyaluran dana dicatat."
      />
      <GuideItem
        number="2"
        title="Saldo Rekening"
        description="Berkurang saat penarikan dana diproses."
        withBorder
      />
    </aside>
  );
}

function GuideItem({
  number,
  title,
  description,
  withBorder = false,
}: {
  number: string;
  title: string;
  description: string;
  withBorder?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 px-5 py-4 ${withBorder ? "border-t border-border/60 lg:border-l lg:border-t-0" : ""}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold text-primary">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-secondary">{description}</p>
      </div>
    </div>
  );
}

function GatewayBalanceSummary({ available, reserved }: { available: number; reserved: number }) {
  const total = available + reserved;

  return (
    <section
      aria-labelledby="gateway-balance-title"
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft"
    >
      <div className="border-b border-border/60 bg-gradient-to-r from-sky-50/80 to-transparent p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="shrink-0 rounded-xl bg-sky-100 p-2.5 text-sky-700">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="gateway-balance-title" className="text-base font-bold text-primary sm:text-lg">
                Saldo Rekening
              </h2>
              <span className="rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                Untuk penarikan
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              Dana aktual yang tersedia untuk dicairkan ke rekening lembaga.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Dapat ditarik sekarang</p>
          <p className="mt-2 break-words text-3xl font-bold tracking-tight text-primary tabular-nums sm:text-4xl">
            {formatCurrency(available)}
          </p>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <GatewayMetric label="Sedang diproses" value={reserved} Icon={Truck} tone="warning" />
          <GatewayMetric label="Total di gateway" value={total} Icon={Landmark} tone="info" />
        </dl>

        <div className="mt-auto flex flex-col gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch 2xl:flex-row 2xl:items-center">
          <p className="text-xs leading-relaxed text-secondary">
            Penyaluran dana tidak mengubah saldo rekening.
          </p>
          <Link
            to="/dashboard/withdrawals/mine"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-secondary"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Ajukan penarikan
          </Link>
        </div>
      </div>
    </section>
  );
}

function GatewayMetric({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: number;
  Icon: LucideIcon;
  tone: "warning" | "info";
}) {
  const colorClass = tone === "warning"
    ? "bg-warning/10 text-warning"
    : "bg-info-token/10 text-info-token";

  return (
    <div className="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
      <dt className="flex items-center gap-2 text-xs font-medium text-secondary">
        <span className={`rounded-lg p-1.5 ${colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </dt>
      <dd className="mt-3 break-words text-base font-bold text-primary tabular-nums">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function ActivitySummary({ metrics }: { metrics: LembagaFinanceMetrics }) {
  return (
    <section aria-labelledby="activity-summary-title" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">Rekap historis</p>
        <h2 id="activity-summary-title" className="mt-1 text-lg font-bold text-primary">Aktivitas keuangan</h2>
        <p className="mt-1 text-sm text-secondary">
          Akumulasi transaksi lembaga yang sudah berhasil atau selesai diproses.
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ActivityCard
          label="Donasi diterima"
          value={Number(metrics.totalReceived ?? 0)}
          description="Dana bersih lembaga dari donasi berhasil."
          Icon={HeartHandshake}
          tone="success"
        />
        <ActivityCard
          label="Dana disalurkan"
          value={Number(metrics.totalDistributed ?? 0)}
          description="Total penyaluran yang sudah selesai."
          Icon={HandCoins}
          tone="brand"
        />
        <ActivityCard
          label="Dana ditarik"
          value={Number(metrics.totalWithdrawn ?? 0)}
          description="Total pencairan yang sudah selesai."
          Icon={CircleDollarSign}
          tone="info"
        />
      </dl>
    </section>
  );
}

function ActivityCard({
  label,
  value,
  description,
  Icon,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  Icon: LucideIcon;
  tone: "success" | "brand" | "info";
}) {
  const colorClass = {
    success: "bg-success/10 text-success",
    brand: "bg-brand-primary/10 text-brand-primary",
    info: "bg-info-token/10 text-info-token",
  }[tone];

  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-5 shadow-soft transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <dt className="text-sm font-semibold text-secondary">{label}</dt>
          <dd className="mt-2 break-words text-2xl font-bold tracking-tight text-primary tabular-nums">
            {formatCurrency(value)}
          </dd>
        </div>
        <span className={`shrink-0 rounded-xl p-2.5 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-secondary">{description}</p>
    </div>
  );
}

function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-surface px-6 py-12 text-center shadow-soft">
      <span className="rounded-xl bg-warning/10 p-3 text-warning">
        <RefreshCcw className="h-5 w-5" />
      </span>
      <p className="mt-4 font-semibold text-primary">{title}</p>
      <p className="mt-1 max-w-md text-sm text-secondary">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface-muted"
      >
        <RefreshCcw className="h-4 w-4" />
        Muat ulang
      </button>
    </div>
  );
}

function FinanceOverviewSkeleton() {
  return (
    <div className="space-y-8" aria-label="Memuat ringkasan keuangan">
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="h-[420px] animate-pulse rounded-2xl border border-border/40 bg-surface xl:col-span-7" />
        <div className="h-[420px] animate-pulse rounded-2xl border border-border/40 bg-surface xl:col-span-5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-border/40 bg-surface" />
        ))}
      </div>
    </div>
  );
}
