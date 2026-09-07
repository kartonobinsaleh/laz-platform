"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
} from "@/components/ui";
import { toast } from "@/stores/toast.store";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { updateProfileAction } from "../actions/settings.actions";
import { updateProfileSchema } from "../validations/settings.schema";
import { updateAvatarAction } from "../actions/avatar.actions";
import { Pencil } from "lucide-react";

interface ProfileCardProps {
  user: {
    name: string | null;
    email: string;
    phoneNumber: string | null;
    avatarUrl?: string | null;
    avatarPublicId?: string | null;
  };
}

export function ProfileCard({ user }: ProfileCardProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(user.name || "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const avatarInput = useRef<HTMLInputElement>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  useEffect(() => {
    setAvatarUrl(user.avatarUrl || "");
  }, [user.avatarUrl]);

  const handleAvatarUpload = async (payload: { url: string; publicId: string }) => {
    const formData = new FormData();
    formData.append("url", payload.url);
    formData.append("publicId", payload.publicId);
    const res = await updateAvatarAction(formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Foto Profil berhasil diperbarui!");
      setAvatarUrl(payload.url);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || isAvatarUploading) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Foto profil harus berformat PNG atau JPG/JPEG.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar. Maksimum 10 MB.");
      return;
    }
    setIsAvatarUploading(true);
    try {
      const { handleUpload: upload } = await import("@/lib/upload/uploadService");
      const result = await upload(file, { folder: "laz-avatars" });
      await handleAvatarUpload({ url: result.url, publicId: result.publicId });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengupload foto profil.");
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const parsed = updateProfileSchema.safeParse({ name, phoneNumber });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Input tidak valid.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("phoneNumber", phoneNumber.trim());

      const res = await updateProfileAction(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Profil berhasil diperbarui!");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Pengguna</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        {/* Avatar preview and upload – responsive and styled */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Avatar preview */}
          <div className="relative flex flex-col items-center justify-center col-span-1 md:col-span-3">
            <div className="relative w-28 h-28">
              {/* Avatar image or initials */}
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto Profil"
                  className="w-28 h-28 rounded-full object-cover ring-2 ring-primary/30 shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30 shadow-lg text-primary font-medium text-4xl">
                  {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              {/* Loading spinner overlay */}
              {isAvatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <LoadingSpinner size="sm" className="border-t-primary" />
                </div>
              )}
              {/* Pencil icon overlay */}
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={isAvatarUploading}
                className="absolute bottom-0 right-0 flex items-center bg-white rounded-md px-2 py-1 shadow-md hover:bg-surface-muted transition transform translate-x-2"
                aria-label="Ubah foto profil"
              >
                <Pencil className="h-5 w-5 text-primary" />
                <span className="ml-1 text-sm text-primary">Edit</span>
              </button>
            </div>
            <p className="mt-2 text-sm text-secondary">Foto Profil · PNG atau JPG/JPEG, maks. 10 MB</p>
          </div>

          {/* Hidden native file input for avatar upload */}
          <input
            id="avatar"
            ref={avatarInput}
            name="avatar"
            type="file"
            accept="image/png,image/jpeg"
            disabled={isAvatarUploading}
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary">Nama Lengkap</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ahmad Fauzi"
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary">Alamat Email (Tidak Dapat Diubah)</label>
              <Input
                value={user.email}
                disabled
                className="bg-surface-muted text-secondary cursor-not-allowed opacity-80"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-primary">Nomor WhatsApp / Telepon</label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Contoh: 081234567890"
                disabled={isPending}
              />
              <p className="text-xs text-secondary">
                Digunakan untuk mengirimkan pesan kuitansi dan update status penyaluran dana.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-surface-soft pt-4 mt-4">
          <Button type="submit" isLoading={isPending} disabled={isPending}>
            Simpan Profil
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
