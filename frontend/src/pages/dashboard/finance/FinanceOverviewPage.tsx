import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { usePermission } from "@/hooks/usePermission";
import { PERMISSIONS } from "@shared/constants/permissions";
import { PageHeader } from "@/components/ui";
import { Link } from "react-router-dom";
import { LembagaFinanceOverviewPage } from "@/pages/dashboard/lembaga/finance/LembagaFinanceOverviewPage";
import {
  Wallet,
  Landmark,
  Truck,
  Banknote,
  ArrowRight,
  Coins,
} from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);

interface PlatformFinanceOverviewData {
  totalMoneyIn: number;
  successfulPayments: number;
  platformBalance: { available: number; reserved: number; total: number };
  institutionBalance: { available: number; reserved: number; total: number };
}

/* ─────────────────────────── Skeleton ─────────────────────────── */
function StatSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-surface rounded-2xl h-32 border border-border/40"
        />
      ))}
    </div>
  );
}

/* ─────────────────────────── Stat Card ─────────────────────────── */
function StatCard({
  label,
  value,
  Icon,
  colorClass,
  sub,
}: {
  label: string;
  value: string | number;
  Icon: React.ElementType;
  colorClass: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface px-4 pb-10 pt-5 sm:px-6 sm:pt-6 border border-border/40 hover:shadow-md transition-shadow">
      <dt>
        <div className={`absolute rounded-xl p-3 ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <p className="ml-16 truncate text-sm font-medium text-secondary">
          {label}
        </p>
      </dt>
      <dd className="ml-16 flex flex-col pb-4 sm:pb-5">
        <p className="text-2xl font-semibold text-primary mt-1">{value}</p>
        {sub && <p className="text-xs text-secondary mt-1">{sub}</p>}
      </dd>
    </div>
  );
}

/* ═══════════════════════ PLATFORM FINANCE VIEW ═════════════════════ */
function PlatformFinanceOverview() {
  const { can } = usePermission();
  const canManageWithdrawals = can(PERMISSIONS.WITHDRAWALS_MANAGE);
  const { data: result, isLoading } = useQuery({
    queryKey: ["dashboard", "platform-overview"],
    queryFn: () => api.get<PlatformFinanceOverviewData>("/dashboard/platform-overview"),
  });

  const p = result?.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ringkasan Keuangan Platform"
        description="Saldo aktual dari transaksi donasi berhasil dan saldo payment gateway Platform serta seluruh Lembaga."
      />

      {isLoading ? (
        <StatSkeleton count={3} />
      ) : p ? (
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Uang Masuk"
            value={fmt(p.totalMoneyIn ?? 0)}
            Icon={Wallet}
            colorClass="bg-brand-primary/10 text-brand-primary"
            sub={`${p.successfulPayments ?? 0} transaksi donasi berhasil`}
          />
          <StatCard
            label="Saldo Amil Platform"
            value={fmt(p.platformBalance?.total ?? 0)}
            Icon={Coins}
            colorClass="bg-info-token/10 text-info-token"
            sub={`Tersedia ${fmt(p.platformBalance?.available ?? 0)} · Diproses ${fmt(p.platformBalance?.reserved ?? 0)}`}
          />
          <StatCard
            label="Saldo Seluruh Lembaga"
            value={fmt(p.institutionBalance?.total ?? 0)}
            Icon={Landmark}
            colorClass="bg-success/10 text-success"
            sub={`Tersedia ${fmt(p.institutionBalance?.available ?? 0)} · Diproses ${fmt(p.institutionBalance?.reserved ?? 0)}`}
          />
        </dl>
      ) : (
        <div className="text-center py-10 text-secondary">
          Gagal memuat data keuangan.
        </div>
      )}

      {/* Quick links */}
      {!isLoading && p && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: canManageWithdrawals ? "Approval Penarikan" : "Lihat Penarikan", to: "/dashboard/withdrawals", icon: Truck },
            { label: "Lihat Payouts", to: "/dashboard/payouts", icon: Banknote },
          ].map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-border/40 hover:border-brand-primary/40 hover:shadow-sm transition group"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-2 bg-brand-primary/10">
                  <Icon className="w-5 h-5 text-brand-primary" />
                </div>
                <span className="text-sm font-semibold text-primary">{label}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-secondary group-hover:text-brand-primary transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ MAIN EXPORT ══════════════════════════ */
export function FinanceOverviewPage() {
  const { can } = usePermission();
  const hasPlatformFinanceAccess = can(PERMISSIONS.PLATFORM_FINANCE_READ);

  return hasPlatformFinanceAccess ? <PlatformFinanceOverview /> : <LembagaFinanceOverviewPage />;
}
