import { PERMISSIONS, type PermissionKey } from "@/constants/permissions";

/**
 * Sidebar navigation items.
 *
 * Each item declares the permission required to be visible.
 * The Sidebar component filters items based on the current user's permissions.
 * This ensures RBAC is data-driven, not scattered if/else role checks.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name — resolved in Sidebar component
  permission?: PermissionKey;
  /**
   * Item hanya relevan untuk staff yang terikat ke satu lembaga (mis. profil
   * lembaga sendiri). SUPER_ADMIN lolos setiap permission check secara
   * otomatis (lihat hasPermission) walau lembagaId-nya null, jadi item ini
   * perlu difilter terpisah berdasarkan lembagaId, bukan permission saja.
   */
  requiresLembaga?: boolean;
  requiresPlatformFinance?: boolean;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    permission: PERMISSIONS.DONATIONS_READ,
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "PieChart",
    permission: PERMISSIONS.REPORTS_READ,
  },
  {
    label: "Operasional",
    href: "#operasional",
    icon: "Briefcase",
    children: [
      {
        label: "Programs",
        href: "/dashboard/programs",
        icon: "Layers",
        permission: PERMISSIONS.PROGRAMS_READ,
      },
      {
        label: "Payments",
        href: "/dashboard/payments",
        icon: "HandCoins",
        permission: PERMISSIONS.PAYMENTS_READ,
      },
      {
        label: "Distributions",
        href: "/dashboard/distributions",
        icon: "Truck",
        permission: PERMISSIONS.DISTRIBUTIONS_READ,
      },
    ],
  },
  {
    label: "Keuangan",
    href: "#keuangan-platform",
    icon: "Landmark",
    children: [
      {
        label: "Ringkasan Platform",
        href: "/dashboard/finance/overview",
        icon: "TrendingUp",
        permission: PERMISSIONS.PLATFORM_FINANCE_READ,
      },
      {
        label: "Pengajuan Penarikan",
        href: "/dashboard/withdrawals",
        icon: "Banknote",
        permission: PERMISSIONS.WITHDRAWALS_READ_ALL,
      },
      {
        label: "Riwayat Penarikan",
        href: "/dashboard/payouts",
        icon: "History",
        permission: PERMISSIONS.WITHDRAWALS_READ_ALL,
      },
      {
        label: "Tarik Amil Platform",
        href: "/dashboard/withdrawals/platform",
        icon: "ArrowUpFromLine",
        permission: PERMISSIONS.PLATFORM_WITHDRAWALS_CREATE,
        requiresPlatformFinance: true,
      },
      {
        label: "Porsi Amil",
        href: "/dashboard/amil-global",
        icon: "Coins",
        permission: PERMISSIONS.SETTINGS_MANAGE,
      },
    ],
  },
  {
    label: "Keuangan",
    href: "#keuangan",
    icon: "Wallet",
    requiresLembaga: true,
    children: [
      {
        label: "Overview",
        href: "/dashboard/lembaga/finance/overview",
        icon: "TrendingUp",
        permission: PERMISSIONS.PAYMENTS_READ,
        requiresLembaga: true,
      },
      {
        label: "Penarikan",
        href: "/dashboard/withdrawals/mine",
        icon: "ArrowDownToLine",
        permission: PERMISSIONS.WITHDRAWALS_CREATE as any,
        requiresLembaga: true,
      },
      {
        label: "Bank Account",
        href: "/dashboard/lembaga/finance/bank-account",
        icon: "CreditCard",
        permission: PERMISSIONS.LEMBAGA_READ,
        requiresLembaga: true,
      },
    ],
  },
  {
    label: "Akuntansi",
    href: "#akuntansi",
    icon: "BookA",
    children: [
      {
        label: "Chart of Accounts",
        href: "/dashboard/coa",
        icon: "Network",
        permission: PERMISSIONS.COA_READ,
      },
      {
        label: "Jurnal Umum",
        href: "/dashboard/journal",
        icon: "BookCopy",
        permission: PERMISSIONS.JOURNAL_READ,
      },
      {
        label: "Buku Besar",
        href: "/dashboard/ledger",
        icon: "Library",
        permission: PERMISSIONS.JOURNAL_READ,
      },
    ],
  },
  {
    label: "Relawan",
    href: "#relawan",
    icon: "UsersRound",
    children: [
      {
        label: "Kegiatan Relawan",
        href: "/dashboard/relawan/kegiatan",
        icon: "CalendarDays",
        permission: PERMISSIONS.VOLUNTEERS_MANAGE,
      },
      {
        label: "Pendaftaran Relawan",
        href: "/dashboard/relawan/pendaftaran",
        icon: "UserPlus",
        permission: PERMISSIONS.VOLUNTEERS_MANAGE,
      },
    ],
  },
  {
    label: "Lembaga",
    href: "#lembaga",
    icon: "Building2",
    children: [
      {
        label: "Manajemen Lembaga",
        href: "/dashboard/lembaga",
        icon: "Building",
        permission: PERMISSIONS.LEMBAGA_MANAGE,
      },
      {
        label: "Profil Lembaga",
        href: "/dashboard/lembaga/profil",
        icon: "Contact",
        permission: PERMISSIONS.LEMBAGA_READ,
        requiresLembaga: true,
      },
      {
        label: "Manajemen User",
        href: "/dashboard/users",
        icon: "Users",
        permission: PERMISSIONS.USERS_READ,
      },
    ],
  },
  {
    label: "Administrasi",
    href: "#administrasi",
    icon: "ShieldCheck",
    children: [
      {
        label: "Hak Akses",
        href: "/dashboard/rbac",
        icon: "Key",
        permission: PERMISSIONS.ROLES_MANAGE,
      },
      {
        label: "Audit Logs",
        href: "/dashboard/audit",
        icon: "ScrollText",
        permission: PERMISSIONS.AUDIT_READ,
      },
    ],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "Settings",
  },
];
