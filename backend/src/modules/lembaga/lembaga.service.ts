import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { LembagaRepository } from "./lembaga.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit.types";
import { AppError } from "../../common/errors/app.error";
import { CoaService } from "../coa/coa.service";
import type { LembagaAdminInput, LembagaProfileInput } from "../../../../shared/validations/lembaga.schema";
import type { LembagaDocumentType, LembagaStatus } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";

export interface RegisterLembagaInput {
  name: string;
  picName: string;
  picPhone?: string;
  address: string;
  description?: string;
  website?: string;
  izinYayasanNumber?: string;
  logoUrl?: string;
  logoPublicId?: string;
  officePhotoUrl?: string;
  officePhotoPublicId?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  documents: Array<{ type: LembagaDocumentType; fileUrl: string; filePublicId?: string; originalName?: string }>;
}

@Injectable()
export class LembagaService {
  constructor(
    private readonly lembagaRepository: LembagaRepository,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly coaService: CoaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async getLembagas(page?: number, pageSize?: number, search?: string, status?: LembagaStatus) {
    return this.lembagaRepository.findMany(page, pageSize, search, status);
  }

  async getOptions() {
    return this.lembagaRepository.findActive();
  }

  async getPublicDirectory(page?: number, limit?: number, search?: string) {
    return this.lembagaRepository.findApprovedDirectory(page, limit, search);
  }

  async getPublicProfile(slug: string) {
    return this.lembagaRepository.findApprovedProfileBySlug(slug);
  }

  async getById(id: string) {
    return this.lembagaRepository.findById(id);
  }

  /**
   * Turunkan slug URL dari nama lembaga, lalu pastikan unik dengan menambah
   * angka urut (-2, -3, dst) jika sudah dipakai lembaga lain. Dipakai saat
   * registrasi supaya donatur/pendaftar tidak pernah perlu memikirkan slug
   * secara manual, dan tidak pernah gagal karena tabrakan slug.
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "") || "lembaga";

    let slug = base;
    let counter = 2;
    while (await this.lembagaRepository.findBySlug(slug)) {
      slug = `${base}-${counter}`;
      counter += 1;
    }
    return slug;
  }

  /**
   * Public self-service registration — creates a PENDING Lembaga + its
   * first LEMBAGA_ADMIN account. No auto-login: the lembaga must be
   * approved by a SUPER_ADMIN before its admin can sign in.
   */
  async registerLembaga(input: RegisterLembagaInput) {
    const slug = await this.generateUniqueSlug(input.name);

    const existingEmail = await this.prisma.user.findUnique({ where: { email: input.adminEmail } });
    if (existingEmail) {
      throw new AppError("EMAIL_TAKEN", "Email sudah terdaftar", 409);
    }

    const lembagaAdminRole = await this.prisma.role.findUnique({ where: { name: "LEMBAGA_ADMIN" } });
    if (!lembagaAdminRole) {
      throw new AppError("MISSING_ROLE", "Role konfigurasi sistem tidak ditemukan (LEMBAGA_ADMIN)", 500);
    }

    const hashedPassword = await bcrypt.hash(input.adminPassword, 12);

    const { lembaga } = await this.lembagaRepository.registerLembaga({
      name: input.name,
      slug,
      picName: input.picName,
      picPhone: input.picPhone,
      address: input.address,
      description: input.description,
      website: input.website,
      izinYayasanNumber: input.izinYayasanNumber,
      logoUrl: input.logoUrl,
      logoPublicId: input.logoPublicId,
      officePhotoUrl: input.officePhotoUrl,
      officePhotoPublicId: input.officePhotoPublicId,
      adminName: input.adminName,
      adminEmail: input.adminEmail,
      hashedPassword,
      lembagaAdminRoleId: lembagaAdminRole.id,
      documents: input.documents,
    });

    await this.auditService.log({
      userId: null,
      action: AuditAction.CREATE,
      entity: "Lembaga",
      entityId: lembaga.id,
      newData: { name: lembaga.name, slug: lembaga.slug, status: lembaga.status },
    });

    await this.notifications?.notifyRole("SUPER_ADMIN", {
      type: "ACTION_REQUIRED",
      title: "Pendaftaran lembaga baru",
      message: `${lembaga.name} menunggu pemeriksaan dan persetujuan Anda.`,
      link: "/dashboard/lembaga",
    });

    return { lembagaId: lembaga.id, status: lembaga.status };
  }

  async approveLembaga(id: string, approverId: string) {
    const existing = await this.lembagaRepository.findById(id);
    if (!existing) throw new NotFoundException("Lembaga tidak ditemukan");
    if (existing.status !== "PENDING") {
      throw new AppError("INVALID_STATUS", "Hanya lembaga berstatus PENDING yang dapat disetujui", 409);
    }

    const updated = await this.lembagaRepository.approve(id, approverId);

    // Seed COA template otomatis untuk lembaga yang baru di-approve
    await this.coaService.seedCoaForLembaga(id);

    await this.auditService.log({
      userId: approverId,
      action: AuditAction.LEMBAGA_APPROVE,
      entity: "Lembaga",
      entityId: id,
      oldData: { status: existing.status },
      newData: { status: updated.status },
    });

    await this.notifications?.notifyLembaga(id, {
      type: "SUCCESS",
      title: "Lembaga telah disetujui",
      message: `${updated.name} telah disetujui. Anda sekarang dapat menggunakan dashboard lembaga.`,
      link: "/dashboard",
    });

    return updated;
  }

  async rejectLembaga(id: string, reason: string, approverId: string) {
    const existing = await this.lembagaRepository.findById(id);
    if (!existing) throw new NotFoundException("Lembaga tidak ditemukan");
    if (existing.status !== "PENDING") {
      throw new AppError("INVALID_STATUS", "Hanya lembaga berstatus PENDING yang dapat ditolak", 409);
    }

    const updated = await this.lembagaRepository.reject(id, reason, approverId);

    await this.auditService.log({
      userId: approverId,
      action: AuditAction.LEMBAGA_REJECT,
      entity: "Lembaga",
      entityId: id,
      oldData: { status: existing.status },
      newData: { status: updated.status, rejectionReason: reason },
    });

    await this.notifications?.notifyLembaga(id, {
      type: "WARNING",
      title: "Pendaftaran lembaga ditolak",
      message: `Pendaftaran ${updated.name} ditolak: ${reason}`,
      link: "/dashboard/settings",
    });

    return updated;
  }

  /** Self-edit profile — LEMBAGA_ADMIN, scoped to their own lembaga. */
  async updateProfile(lembagaId: string, input: LembagaProfileInput, executorUserId: string) {
    const existing = await this.lembagaRepository.findById(lembagaId);
    if (!existing) throw new NotFoundException("Lembaga tidak ditemukan");

    const updated = await this.lembagaRepository.update(lembagaId, {
      name: input.name,
      picName: input.picName,
      picPhone: input.picPhone || null,
      address: input.address,
      description: input.description || null,
      website: input.website || null,
      izinYayasanNumber: input.izinYayasanNumber || null,
      logoUrl: input.logoUrl || null,
      logoPublicId: input.logoPublicId || null,
      officePhotoUrl: input.officePhotoUrl || null,
      officePhotoPublicId: input.officePhotoPublicId || null,
    });

    await this.auditService.log({
      userId: executorUserId,
      action: AuditAction.UPDATE,
      entity: "Lembaga",
      entityId: lembagaId,
      newData: { name: updated.name },
    });

    return updated;
  }

  /** Internal Super Admin CRUD (slug/name/logo/status). */
  async createLembaga(input: LembagaAdminInput, creatorUserId: string) {
    const existing = await this.lembagaRepository.findBySlug(input.slug);
    if (existing) {
      throw new AppError("SLUG_TAKEN", "Slug lembaga ini sudah digunakan oleh organisasi lain", 409);
    }

    const lembaga = await this.lembagaRepository.create({
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl || null,
      logoPublicId: input.logoPublicId || null,
      status: input.status,
      picName: "",
      address: "",
    });

    await this.auditService.log({
      userId: creatorUserId,
      action: AuditAction.CREATE,
      entity: "Lembaga",
      entityId: lembaga.id,
      newData: { name: lembaga.name, slug: lembaga.slug, status: lembaga.status },
    });

    return lembaga;
  }

  async deleteLembaga(id: string, executorUserId: string) {
    const existing = await this.lembagaRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Lembaga tidak ditemukan");
    }

    const dependencies = await this.lembagaRepository.getDeletionDependencies(id);
    const dependencyLabels: Array<[keyof NonNullable<typeof dependencies>, string]> = [
      ["programs", "program"],
      ["donations", "donasi"],
      ["distributions", "penyaluran"],
      ["payments", "pembayaran"],
      ["volunteerActivities", "kegiatan relawan"],
      ["volunteerApplications", "pendaftaran relawan"],
      ["withdrawals", "penarikan dana"],
      ["journals", "jurnal"],
      ["amilPlatformChangeRequests", "pengajuan perubahan porsi amil"],
    ];
    const blockers = dependencies
      ? dependencyLabels
          .filter(([key]) => dependencies[key] > 0)
          .map(([key, label]) => `${dependencies[key]} ${label}`)
      : [];

    if (blockers.length > 0) {
      throw new AppError(
        "LEMBAGA_HAS_RELATED_DATA",
        `Lembaga "${existing.name}" tidak dapat dihapus karena masih memiliki ${blockers.join(", ")}. Hapus data terkait terlebih dahulu.`,
        409,
      );
    }

    const deleted = await this.lembagaRepository.delete(id);

    await this.auditService.log({
      userId: executorUserId,
      action: AuditAction.DELETE,
      entity: "Lembaga",
      entityId: deleted.id,
      oldData: { name: deleted.name, slug: deleted.slug, status: deleted.status },
    });

    return deleted;
  }

  async updateLembaga(id: string, input: LembagaAdminInput, executorUserId: string) {
    const existing = await this.lembagaRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Lembaga tidak ditemukan");
    }

    const updated = await this.lembagaRepository.update(id, {
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl ?? null,
      logoPublicId: input.logoPublicId ?? null,
      status: input.status,
    });

    await this.auditService.log({
      userId: executorUserId,
      action: AuditAction.UPDATE,
      entity: "Lembaga",
      entityId: updated.id,
      oldData: {
        name: existing.name,
        slug: existing.slug,
        status: existing.status,
      },
      newData: {
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
      },
    });

    return updated;
  }
}
