import { useAuth } from "@/auth/AuthProvider";
import { SettingsForm } from "@/features/settings/components/SettingsForm";
import { PageHeader } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function SettingsPage() {
  // Selalu pakai useAuth() (AuthProvider), JANGAN buat useQuery(["auth","me"])
  // terpisah di sini — key yang sama dengan bentuk data berbeda akan saling
  // menimpa cache React Query dan merusak permissions di seluruh sidebar.
  const { user, isLoading } = useAuth();
  
  if (!isLoading && !user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pengaturan Akun"
          description="Kelola informasi profil Anda, ubah kata sandi, dan atur preferensi notifikasi di sini."
        />
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          Gagal memuat profil pengguna. Silakan muat ulang halaman.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Akun"
        description="Kelola informasi profil Anda, ubah kata sandi, dan atur preferensi notifikasi di sini."
      />
      {isLoading || !user ? (
        <div className="flex justify-center py-20"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-8">
          <SettingsForm
            user={{
              id: user.id,
              name: user.name ?? null,
              email: user.email,
              phoneNumber: user.phoneNumber ?? null,
              avatarUrl: user.avatarUrl ?? null,
              avatarPublicId: user.avatarPublicId ?? null,
              emailNotifications: user.emailNotifications ?? true,
              waNotifications: user.waNotifications ?? true,
            }}
          />
        </div>
      )}
    </div>
  );
}
