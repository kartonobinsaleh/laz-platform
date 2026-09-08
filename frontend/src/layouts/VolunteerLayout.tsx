import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, ClipboardList, ListChecks, Award, Settings, LogOut, Menu, X, ChevronRight } from "lucide-react";
import { useVolunteerAuth } from "@/auth/VolunteerAuthProvider";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/stores/toast.store";

function VolunteerAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 ring-2 ring-white">
      {photoUrl && photoUrl !== failedUrl ? (
        <img src={photoUrl} alt={`Foto profil ${name}`} className="h-full w-full object-cover" onError={() => setFailedUrl(photoUrl)} />
      ) : (
        <span aria-label={`Profil ${name}`}>{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "R"}</span>
      )}
    </span>
  );
}

const NAV = [
  { label: "Dashboard", href: "/volunteer/dashboard", icon: LayoutDashboard },
  { label: "Cari Kegiatan", href: "/volunteer/activities", icon: Search },
  { label: "Pendaftaran Saya", href: "/volunteer/applications", icon: ClipboardList },
  { label: "Kegiatan Saya", href: "/volunteer/my-activities", icon: ListChecks },
  { label: "Riwayat & Kontribusi", href: "/volunteer/history", icon: Award },
  { label: "Pengaturan Profil", href: "/volunteer/profile", icon: Settings },
];

export function VolunteerLayout() {
  const { volunteer, logout } = useVolunteerAuth();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const name = volunteer?.name || "Relawan";
  const currentPage = NAV.find((item) => location.pathname.startsWith(item.href))?.label || "Portal Relawan";

  async function confirmLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Gagal keluar. Silakan coba lagi.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-muted">
      {/* Mobile overlay backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/30 lg:hidden transition-opacity duration-300 ease-in-out z-30",
          isNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setIsNavOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="volunteer-navigation"
        className={cn(
          "w-72 max-w-[85vw] bg-surface border-r border-border/40 flex flex-col shrink-0",
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out",
          isNavOpen ? "translate-x-0 visible" : "-translate-x-full invisible",
          "lg:static lg:translate-x-0 lg:visible",
        )}
        aria-label="Navigasi relawan"
      >
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Ruang Berbagi" className="h-8 w-auto object-contain" />
            <div>
              <p className="font-black text-lg text-emerald-950">ruang <span className="text-emerald-600">berbagi</span></p>
              <p className="text-xs text-secondary mt-0.5">Portal Relawan</p>
            </div>
          </div>
          <button
            onClick={() => setIsNavOpen(false)}
            aria-label="Tutup navigasi"
            className="p-2 rounded-xl text-secondary hover:bg-surface-muted lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav aria-label="Menu relawan" className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 pb-3 pt-2 text-[11px] font-bold uppercase tracking-widest text-secondary">Ruang Relawan</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition",
                  active ? "bg-emerald-600 text-white shadow-sm" : "text-secondary hover:bg-emerald-50 hover:text-emerald-800",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {active && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border/40">
          <Link to="/volunteer/profile" onClick={() => setIsNavOpen(false)} className="mb-3 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 hover:bg-emerald-100/70" aria-label="Lihat dan edit profil relawan">
            <VolunteerAvatar name={name} photoUrl={volunteer?.photoUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-primary">{name}</p>
              <p className="truncate text-xs text-secondary">{volunteer?.email}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">Lihat profil</p>
            </div>
          </Link>
          <button
            onClick={() => { setIsNavOpen(false); setIsLogoutOpen(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-20 bg-surface border-b border-border/40 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 shrink-0">
          <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setIsNavOpen(true)}
            aria-label="Buka navigasi"
            aria-expanded={isNavOpen}
            aria-controls="volunteer-navigation"
            className="p-2 rounded-xl text-secondary hover:bg-surface-muted lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-secondary">Portal Relawan</p>
            <h1 className="truncate text-sm font-bold text-primary sm:text-lg">{currentPage}</h1>
          </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <NotificationBell principal="volunteer" />
          <Link to="/volunteer/profile" className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-surface-muted" aria-label="Buka profil relawan">
            <span className="hidden max-w-40 text-right md:block">
              <span className="block truncate text-sm font-bold text-primary">{name}</span>
              <span className="block text-xs text-secondary">Relawan</span>
            </span>
            <VolunteerAvatar name={name} photoUrl={volunteer?.photoUrl} />
          </Link>
          <button onClick={() => setIsLogoutOpen(true)} aria-label="Keluar dari akun" title="Keluar" className="rounded-xl p-2 text-secondary transition hover:bg-red-50 hover:text-destructive">
            <LogOut className="h-5 w-5" />
          </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <ConfirmDialog
        isOpen={isLogoutOpen}
        onClose={() => { if (!isLoggingOut) setIsLogoutOpen(false); }}
        onConfirm={confirmLogout}
        title="Keluar dari akun relawan?"
        message="Anda perlu masuk kembali untuk mengakses pendaftaran dan kegiatan Anda. Yakin ingin keluar?"
        confirmText="Ya, keluar"
        cancelText="Batal"
        intent="destructive"
        isLoading={isLoggingOut}
      />
    </div>
  );
}
