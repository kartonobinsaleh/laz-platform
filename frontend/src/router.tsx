import { createBrowserRouter, Navigate } from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { VolunteerLayout } from "@/layouts/VolunteerLayout";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { VolunteerProtectedRoute } from "@/auth/VolunteerProtectedRoute";
import { RequirePermission } from "@/auth/RequirePermission";
import { PERMISSIONS } from "@shared/constants/permissions";

// Public pages
import { HomePage } from "@/pages/Home";
import { ProgramsPage } from "@/pages/Programs";
import { ProgramDetailPage } from "@/pages/ProgramDetail";
import { DonatePage } from "@/pages/Donate";
import { DonationHistoryPage } from "@/pages/DonationHistoryPage";
import { LembagaDirectoryPage } from "@/pages/LembagaDirectoryPage";
import { LembagaProfilePage } from "@/pages/LembagaProfilePage";
import { VolunteerLandingPage } from "@/pages/VolunteerLandingPage";
import { CalculatorPage } from "@/pages/CalculatorPage";
import { PublicReportsPage } from "@/pages/PublicReportsPage";
import { AboutPage } from "@/pages/AboutPage";

// Auth pages (staff/lembaga)
import { LoginPage } from "@/pages/auth/Login";
import { RegisterPage } from "@/pages/auth/Register";

// Lembaga registration (public, own chrome)
import { LembagaRegisterPage } from "@/pages/lembaga/LembagaRegisterPage";

// Volunteer pages (separate auth stack)
import { VolunteerRegisterPage } from "@/pages/volunteer/VolunteerRegisterPage";
import { VolunteerDashboardPage } from "@/pages/volunteer/VolunteerDashboardPage";
import { VolunteerActivitiesPage } from "@/pages/volunteer/VolunteerActivitiesPage";
import { VolunteerApplicationsPage as VolunteerOwnApplicationsPage } from "@/pages/volunteer/VolunteerApplicationsPage";
import { VolunteerMyActivitiesPage } from "@/pages/volunteer/VolunteerMyActivitiesPage";
import { VolunteerHistoryPage } from "@/pages/volunteer/VolunteerHistoryPage";
import { VolunteerProfilePage } from "@/pages/volunteer/VolunteerProfilePage";

// Dashboard pages
import { OverviewPage } from "@/pages/dashboard/Overview";
import { ProgramsListPage } from "@/pages/dashboard/programs/ProgramsListPage";
import { NewProgramPage } from "@/pages/dashboard/programs/NewProgramPage";
import { EditProgramPage } from "@/pages/dashboard/programs/EditProgramPage";
import { NewDistributionForProgramPage } from "@/pages/dashboard/programs/NewDistributionForProgramPage";
import { DonationsListPage } from "@/pages/dashboard/donations/DonationsListPage";
import { DistributionsListPage } from "@/pages/dashboard/distributions/DistributionsListPage";
import { PaymentsListPage } from "@/pages/dashboard/payments/PaymentsListPage";
import { UsersListPage } from "@/pages/dashboard/users/UsersListPage";
import { NewUserPage } from "@/pages/dashboard/users/NewUserPage";
import { EditUserPage } from "@/pages/dashboard/users/EditUserPage";
import { LembagaListPage } from "@/pages/dashboard/lembaga/LembagaListPage";
import { NewLembagaPage } from "@/pages/dashboard/lembaga/NewLembagaPage";
import { EditLembagaPage } from "@/pages/dashboard/lembaga/EditLembagaPage";
import { LembagaMyProfilePage } from "@/pages/dashboard/lembaga/LembagaMyProfilePage";
import { VolunteerApplicationsPage } from "@/pages/dashboard/volunteers/VolunteerApplicationsPage";
import { VolunteerActivitiesPage as VolunteerActivitiesManagementPage } from "@/pages/dashboard/volunteers/VolunteerActivitiesPage";
import { RbacPage } from "@/pages/dashboard/rbac/RbacPage";
import { ReportsPage } from "@/pages/dashboard/reports/ReportsPage";
import { SettingsPage } from "@/pages/dashboard/settings/SettingsPage";
import { AuditPage } from "@/pages/dashboard/audit/AuditPage";
import { CoaPage } from "@/pages/dashboard/coa/CoaPage";
import { JournalListPage } from "@/pages/dashboard/journal/JournalListPage";
import { NewJournalPage } from "@/pages/dashboard/journal/NewJournalPage";
import { JournalDetailPage } from "@/pages/dashboard/journal/JournalDetailPage";
import { LedgerPage } from "@/pages/dashboard/ledger/LedgerPage";
import { LembagaWithdrawalPage } from "@/features/withdrawals/pages/LembagaWithdrawalPage";
import { AdminWithdrawalPage } from "@/features/withdrawals/pages/AdminWithdrawalPage";
import { PlatformWithdrawalPage } from "@/features/withdrawals/pages/PlatformWithdrawalPage";
import { FinanceOverviewPage } from "@/pages/dashboard/finance/FinanceOverviewPage";
import { PayoutsListPage } from "@/pages/dashboard/finance/PayoutsListPage";
import { LembagaFinanceOverviewPage } from "@/pages/dashboard/lembaga/finance/LembagaFinanceOverviewPage";
import { LembagaBalancePage } from "@/pages/dashboard/lembaga/finance/LembagaBalancePage";
import { BankAccountPage } from "@/pages/dashboard/lembaga/finance/BankAccountPage";
import { GlobalAmilSettingsPage } from "@/pages/dashboard/amil/GlobalAmilSettingsPage";

export const router = createBrowserRouter([
  {
    // Shared root: resets scroll position on every route change (see ScrollToTop).
    element: <RootLayout />,
    children: [
      // Public routes
      {
        element: <PublicLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/programs", element: <ProgramsPage /> },
          { path: "/programs/:slug", element: <ProgramDetailPage /> },
          { path: "/donate/:slug", element: <DonatePage /> },
          { path: "/riwayat-donasi", element: <DonationHistoryPage /> },
          { path: "/lembaga", element: <LembagaDirectoryPage /> },
          { path: "/lembaga/:slug", element: <LembagaProfilePage /> },
          { path: "/relawan", element: <VolunteerLandingPage /> },
          { path: "/calculator", element: <CalculatorPage /> },
          { path: "/reports", element: <PublicReportsPage /> },
          { path: "/about", element: <AboutPage /> },
        ],
      },
      // Lembaga self-service registration (public, own chrome — multi-section form)
      { path: "/lembaga/register", element: <LembagaRegisterPage /> },
      // Auth routes (staff / lembaga admin)
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
        ],
      },
      // Volunteer auth routes (separate principal — own chrome)
      { path: "/volunteer/register", element: <VolunteerRegisterPage /> },
      // Volunteer dashboard
      {
        element: (
          <VolunteerProtectedRoute>
            <VolunteerLayout />
          </VolunteerProtectedRoute>
        ),
        children: [
          { path: "/volunteer/dashboard", element: <VolunteerDashboardPage /> },
          { path: "/volunteer/activities", element: <VolunteerActivitiesPage /> },
          { path: "/volunteer/applications", element: <VolunteerOwnApplicationsPage /> },
          { path: "/volunteer/my-activities", element: <VolunteerMyActivitiesPage /> },
          { path: "/volunteer/history", element: <VolunteerHistoryPage /> },
          { path: "/volunteer/profile", element: <VolunteerProfilePage /> },
        ],
      },
      // Protected dashboard routes (staff: SUPER_ADMIN / FINANCE_PLATFORM / LEMBAGA_ADMIN)
      {
        path: "/dashboard",
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <OverviewPage /> },
          // Programs
          {
            path: "programs",
            element: (
              <RequirePermission permission={PERMISSIONS.PROGRAMS_READ}>
                <ProgramsListPage />
              </RequirePermission>
            ),
          },
          {
            path: "programs/new",
            element: (
              <RequirePermission permission={PERMISSIONS.PROGRAMS_CREATE}>
                <NewProgramPage />
              </RequirePermission>
            ),
          },
          {
            path: "programs/:slug/edit",
            element: (
              <RequirePermission permission={PERMISSIONS.PROGRAMS_UPDATE}>
                <EditProgramPage />
              </RequirePermission>
            ),
          },
          {
            path: "programs/:slug/distributions/new",
            element: (
              <RequirePermission permission={PERMISSIONS.DISTRIBUTIONS_MANAGE}>
                <NewDistributionForProgramPage />
              </RequirePermission>
            ),
          },
          // Donations
          {
            path: "donations",
            element: (
              <RequirePermission permission={PERMISSIONS.DONATIONS_READ}>
                <DonationsListPage />
              </RequirePermission>
            ),
          },
          // Distributions
          {
            path: "distributions",
            element: (
              <RequirePermission permission={PERMISSIONS.DISTRIBUTIONS_READ}>
                <DistributionsListPage />
              </RequirePermission>
            ),
          },
          // Payments
          {
            path: "payments",
            element: (
              <RequirePermission permission={PERMISSIONS.PAYMENTS_READ}>
                <PaymentsListPage />
              </RequirePermission>
            ),
          },
          // Users
          {
            path: "users",
            element: (
              <RequirePermission permission={PERMISSIONS.USERS_READ}>
                <UsersListPage />
              </RequirePermission>
            ),
          },
          {
            path: "users/new",
            element: (
              <RequirePermission permission={PERMISSIONS.USERS_CREATE}>
                <NewUserPage />
              </RequirePermission>
            ),
          },
          {
            path: "users/:id/edit",
            element: (
              <RequirePermission permission={PERMISSIONS.USERS_UPDATE}>
                <EditUserPage />
              </RequirePermission>
            ),
          },
          // Lembaga
          {
            path: "lembaga",
            element: (
              <RequirePermission permission={PERMISSIONS.LEMBAGA_MANAGE}>
                <LembagaListPage />
              </RequirePermission>
            ),
          },
          {
            path: "lembaga/new",
            element: (
              <RequirePermission permission={PERMISSIONS.LEMBAGA_MANAGE}>
                <NewLembagaPage />
              </RequirePermission>
            ),
          },
          {
            path: "lembaga/:id/edit",
            element: (
              <RequirePermission permission={PERMISSIONS.LEMBAGA_MANAGE}>
                <EditLembagaPage />
              </RequirePermission>
            ),
          },
          // Profil Lembaga (self-service, LEMBAGA_ADMIN)
          {
            path: "lembaga/profil",
            element: (
              <RequirePermission permission={PERMISSIONS.LEMBAGA_READ}>
                <LembagaMyProfilePage />
              </RequirePermission>
            ),
          },
          // Pencairan Dana (Withdrawal)
          {
            path: "withdrawals/mine",
            element: (
              <RequirePermission permission={PERMISSIONS.WITHDRAWALS_CREATE as any}>
                <LembagaWithdrawalPage />
              </RequirePermission>
            ),
          },
          {
            path: "withdrawals",
            element: (
              <RequirePermission permission={PERMISSIONS.WITHDRAWALS_READ_ALL}>
                <AdminWithdrawalPage scope="lembaga" />
              </RequirePermission>
            ),
          },
          {
            path: "withdrawals/approvals/platform",
            element: (
              <RequirePermission permission={PERMISSIONS.WITHDRAWALS_READ_ALL}>
                <AdminWithdrawalPage scope="platform" />
              </RequirePermission>
            ),
          },
          {
            path: "withdrawals/platform",
            element: (
              <RequirePermission permission={PERMISSIONS.PLATFORM_WITHDRAWALS_CREATE} requiresPlatformFinance>
                <PlatformWithdrawalPage />
              </RequirePermission>
            ),
          },
          // Keuangan & Payouts
          {
            path: "finance/overview",
            element: (
              <RequirePermission permission={PERMISSIONS.PAYMENTS_READ}>
                <FinanceOverviewPage />
              </RequirePermission>
            ),
          },
          {
            path: "payouts",
            element: (
              <RequirePermission permission={PERMISSIONS.WITHDRAWALS_READ_ALL}>
                <PayoutsListPage />
              </RequirePermission>
            ),
          },
          {
            path: "amil-global",
            element: (
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <GlobalAmilSettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: "amil-platform-requests",
            element: <Navigate to="/dashboard/programs?status=PENDING_REVIEW" replace />,
          },
          {
            path: "lembaga/finance/overview",
            element: (
              <RequirePermission permission={PERMISSIONS.DONATIONS_READ}>
                <LembagaFinanceOverviewPage />
              </RequirePermission>
            ),
          },
          {
            path: "lembaga/finance/bank-account",
            element: (
              <RequirePermission permission={PERMISSIONS.LEMBAGA_READ}>
                <BankAccountPage />
              </RequirePermission>
            ),
          },
          {
            path: "lembaga/finance/amil",
            element: <Navigate to="/dashboard/programs/new" replace />,
          },
          {
            path: "lembaga/finance/amil-platform-request",
            element: <Navigate to="/dashboard/programs/new" replace />,
          },
          // Relawan (lembaga-admin: kegiatan + review pendaftaran)
          {
            path: "relawan/kegiatan",
            element: (
              <RequirePermission permission={PERMISSIONS.VOLUNTEERS_MANAGE}>
                <VolunteerActivitiesManagementPage />
              </RequirePermission>
            ),
          },
          {
            path: "relawan/pendaftaran",
            element: (
              <RequirePermission permission={PERMISSIONS.VOLUNTEERS_MANAGE}>
                <VolunteerApplicationsPage />
              </RequirePermission>
            ),
          },
          // RBAC
          {
            path: "rbac",
            element: (
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <RbacPage />
              </RequirePermission>
            ),
          },
          // Reports
          {
            path: "reports",
            element: (
              <RequirePermission permission={PERMISSIONS.REPORTS_READ}>
                <ReportsPage />
              </RequirePermission>
            ),
          },
          // Settings
          { path: "settings", element: <SettingsPage /> },
          // Audit
          {
            path: "audit",
            element: (
              <RequirePermission permission={PERMISSIONS.AUDIT_READ}>
                <AuditPage />
              </RequirePermission>
            ),
          },
          // Chart of Accounts (COA)
          {
            path: "coa",
            element: (
              <RequirePermission permission={PERMISSIONS.COA_READ}>
                <CoaPage />
              </RequirePermission>
            ),
          },
          // Jurnal Umum
          {
            path: "journal",
            element: (
              <RequirePermission permission={PERMISSIONS.JOURNAL_READ}>
                <JournalListPage />
              </RequirePermission>
            ),
          },
          {
            path: "journal/new",
            element: (
              <RequirePermission permission={PERMISSIONS.JOURNAL_CREATE}>
                <NewJournalPage />
              </RequirePermission>
            ),
          },
          {
            path: "journal/:id",
            element: (
              <RequirePermission permission={PERMISSIONS.JOURNAL_READ}>
                <JournalDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: "ledger",
            element: (
              <RequirePermission permission={PERMISSIONS.JOURNAL_READ}>
                <LedgerPage />
              </RequirePermission>
            ),
          },
        ],
      },
      // Catch-all
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
