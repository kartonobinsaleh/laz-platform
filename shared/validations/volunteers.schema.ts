import { z } from "zod";
import { INDONESIA_PHONE_REGEX } from "./donations.schema";

export const volunteerRegistrationSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(100),
    email: z.string().email("Format email tidak valid"),
    phone: z.string().regex(INDONESIA_PHONE_REGEX, "Format nomor telepon tidak valid"),
    addressDomicile: z.string().min(5, "Alamat domisili minimal 5 karakter").max(500),
    addressKtp: z.string().min(5, "Alamat KTP minimal 5 karakter").max(500),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string(),
    photoUrl: z.string().url().optional().or(z.literal("")),
    photoPublicId: z.string().optional().or(z.literal("")),
    ktpUrl: z.string().url().optional().or(z.literal("")),
    ktpPublicId: z.string().optional().or(z.literal("")),
    cvUrl: z.string().url().optional().or(z.literal("")),
    cvPublicId: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

export type VolunteerRegistrationInput = z.infer<typeof volunteerRegistrationSchema>;

export const volunteerProfileSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(100),
  phone: z.string().regex(INDONESIA_PHONE_REGEX, "Format nomor telepon tidak valid"),
  addressDomicile: z.string().min(5, "Alamat domisili minimal 5 karakter").max(500),
  addressKtp: z.string().min(5, "Alamat KTP minimal 5 karakter").max(500),
  photoUrl: z.string().url().optional().or(z.literal("")),
  photoPublicId: z.string().optional().or(z.literal("")),
  ktpUrl: z.string().url().optional().or(z.literal("")),
  ktpPublicId: z.string().optional().or(z.literal("")),
  cvUrl: z.string().url().optional().or(z.literal("")),
  cvPublicId: z.string().optional().or(z.literal("")),
});

export type VolunteerProfileInput = z.infer<typeof volunteerProfileSchema>;

export const volunteerLoginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export type VolunteerLoginInput = z.infer<typeof volunteerLoginSchema>;

/** Dibuat/diubah oleh Lembaga Admin — "Kegiatan Relawan". */
export const VOLUNTEER_ACTIVITY_STATUSES = ["OPEN", "CLOSED", "CANCELLED"] as const;

export const volunteerActivitySchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter").max(150, "Judul maksimal 150 karakter"),
  description: z.string().min(20, "Deskripsi minimal 20 karakter"),
  location: z.string().max(200).optional().or(z.literal("")),
  activityDate: z.string().optional().or(z.literal("")),
  quota: z.coerce.number().int().min(1, "Kuota minimal 1 orang").optional(),
  programId: z.string().optional().or(z.literal("")),
  status: z.enum(VOLUNTEER_ACTIVITY_STATUSES).default("OPEN"),
});

export type VolunteerActivityInput = z.infer<typeof volunteerActivitySchema>;

export const volunteerApplicationSchema = z.object({
  activityId: z.string().min(1, "Kegiatan tidak valid"),
});

export type VolunteerApplicationInput = z.infer<typeof volunteerApplicationSchema>;

export const volunteerApplicationReviewSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type VolunteerApplicationReviewInput = z.infer<typeof volunteerApplicationReviewSchema>;

/** Relawan mengirim laporan/tugas selesai untuk kegiatan yang diikuti. */
export const volunteerReportSchema = z.object({
  reportText: z.string().min(10, "Laporan minimal 10 karakter").max(3000),
  reportFileUrl: z.string().url().optional().or(z.literal("")),
  reportFilePublicId: z.string().optional().or(z.literal("")),
});

export type VolunteerReportInput = z.infer<typeof volunteerReportSchema>;

/** Lembaga memverifikasi atau meminta revisi laporan kegiatan. */
export const volunteerReportReviewSchema = z.object({
  note: z.string().max(500).optional(),
});

export type VolunteerReportReviewInput = z.infer<typeof volunteerReportReviewSchema>;
