import { useState } from "react";
import { volunteerProfileSchema, type VolunteerProfileInput } from "../validations/volunteers.schema";
import { FormWrapper, FormField, Button, Card, CardContent, CardFooter } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { toast } from "@/stores/toast.store";

interface VolunteerProfile {
  name: string;
  email: string;
  phone: string;
  addressDomicile?: string | null;
  addressKtp?: string | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  ktpUrl?: string | null;
  ktpPublicId?: string | null;
  cvUrl?: string | null;
  cvPublicId?: string | null;
}

export function VolunteerProfileForm({ initialData }: { initialData: VolunteerProfile }) {
  const [isPending, setIsPending] = useState(false);
  const [uploading, setUploading] = useState({ photo: false, ktp: false, cv: false });
  const isUploading = Object.values(uploading).some(Boolean);
  const [photo, setPhoto] = useState({ url: initialData.photoUrl ?? "", publicId: initialData.photoPublicId ?? "" });
  const [ktp, setKtp] = useState({ url: initialData.ktpUrl ?? "", publicId: initialData.ktpPublicId ?? "" });
  const [cv, setCv] = useState({ url: initialData.cvUrl ?? "", publicId: initialData.cvPublicId ?? "" });

  const onSubmit = async (data: VolunteerProfileInput) => {
    if (isUploading) return;
    setIsPending(true);
    try {
      await api.patch("/volunteers/profile", {
        ...data,
        photoUrl: photo.url || undefined,
        photoPublicId: photo.publicId || undefined,
        ktpUrl: ktp.url || undefined,
        ktpPublicId: ktp.publicId || undefined,
        cvUrl: cv.url || undefined,
        cvPublicId: cv.publicId || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["volunteer"] });
      toast.success("Profil berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memperbarui profil");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <FormWrapper<VolunteerProfileInput>
        schema={volunteerProfileSchema}
        onSubmit={onSubmit}
        defaultValues={{
          name: initialData.name,
          phone: initialData.phone,
          addressDomicile: initialData.addressDomicile ?? "",
          addressKtp: initialData.addressKtp ?? "",
        }}
      >
        <CardContent className="space-y-6">
          <FormField name="name" label="Nama Lengkap" type="input" disabled={isPending} />
          <div className="rounded-xl bg-surface-muted p-3 text-sm text-secondary">
            Email: <span className="font-semibold text-primary">{initialData.email}</span> (tidak dapat diubah)
          </div>
          <FormField name="phone" label="Nomor Telepon" type="input" inputType="tel" disabled={isPending} />
          <FormField name="addressDomicile" label="Alamat Domisili" required type="textarea" rows={2} placeholder="Alamat tempat tinggal saat ini" disabled={isPending} />
          <FormField name="addressKtp" label="Alamat KTP" required type="textarea" rows={2} placeholder="Alamat sesuai KTP" disabled={isPending} />

          <FileUpload
            name="photoUrl"
            label="Foto Diri"
            folder="volunteers/photo"
            disabled={isPending}
            initialUrl={initialData.photoUrl ?? ""}
            initialPublicId={initialData.photoPublicId ?? ""}
            onUpload={setPhoto}
            onUploadingChange={(value) => setUploading((prev) => ({ ...prev, photo: value }))}
            onRemove={() => setPhoto({ url: "", publicId: "" })}
          />
          <FileUpload
            name="ktpUrl"
            label="KTP"
            accept="image/png, image/jpeg, application/pdf"
            folder="volunteers/documents"
            disabled={isPending}
            initialUrl={initialData.ktpUrl ?? ""}
            initialPublicId={initialData.ktpPublicId ?? ""}
            onUpload={setKtp}
            onUploadingChange={(value) => setUploading((prev) => ({ ...prev, ktp: value }))}
            onRemove={() => setKtp({ url: "", publicId: "" })}
          />
          <FileUpload
            name="cvUrl"
            label="CV"
            accept="image/png, image/jpeg, application/pdf"
            folder="volunteers/documents"
            disabled={isPending}
            initialUrl={initialData.cvUrl ?? ""}
            initialPublicId={initialData.cvPublicId ?? ""}
            onUpload={setCv}
            onUploadingChange={(value) => setUploading((prev) => ({ ...prev, cv: value }))}
            onRemove={() => setCv({ url: "", publicId: "" })}
          />
        </CardContent>

        <CardFooter className="flex justify-end border-t border-surface-soft pt-6 mt-6">
          <Button type="submit" isLoading={isPending} disabled={isPending || isUploading}>
            Simpan Perubahan
          </Button>
        </CardFooter>
      </FormWrapper>
    </Card>
  );
}
