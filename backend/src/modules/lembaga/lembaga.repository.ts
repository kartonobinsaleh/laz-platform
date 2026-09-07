import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma, LembagaStatus, LembagaDocumentType } from "@prisma/client";
import { CloudinaryProvider } from "../../lib/upload/cloudinary.provider";

export interface RegisterLembagaData {
  name: string;
  slug: string;
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
  hashedPassword: string;
  lembagaAdminRoleId: string;
  documents: Array<{ type: LembagaDocumentType; fileUrl: string; filePublicId?: string; originalName?: string }>;
}

@Injectable()
export class LembagaRepository {
  private readonly logger = new Logger(LembagaRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryProvider: CloudinaryProvider,
  ) {}

  /**
   * Find all Lembaga tenants with pagination, search, and optional status filter.
   */
  async findMany(page: number = 1, pageSize: number = 10, search?: string, status?: LembagaStatus) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.LembagaWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.lembaga.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { documents: true },
      }),
      this.prisma.lembaga.count({ where }),
    ]);

    return {
      items,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findById(id: string) {
    return this.prisma.lembaga.findUnique({
      where: { id },
      include: { documents: true, balance: true },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.lembaga.findUnique({
      where: { slug },
    });
  }

  async create(data: Prisma.LembagaCreateInput) {
    return this.prisma.lembaga.create({
      data,
    });
  }

  async getDeletionDependencies(id: string) {
    const lembaga = await this.prisma.lembaga.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            programs: true,
            donations: true,
            distributions: true,
            payments: true,
            volunteerActivities: true,
            volunteerApplications: true,
            withdrawals: true,
            journals: true,
            amilPlatformChangeRequests: true,
          },
        },
      },
    });

    return lembaga?._count ?? null;
  }

  /**
   * Update an existing Lembaga's details.
   */
  async update(id: string, data: Prisma.LembagaUpdateInput) {
    const existing = await this.prisma.lembaga.findUnique({ where: { id } });
    if (
      existing?.logoPublicId &&
      data.logoPublicId &&
      data.logoPublicId !== existing.logoPublicId
    ) {
      try {
        await this.cloudinaryProvider.delete(existing.logoPublicId);
      } catch (e) {
        this.logger.error(
          { err: e, id, oldLogoPublicId: existing.logoPublicId },
          "Failed to delete old logo from Cloudinary",
        );
      }
    }
    return this.prisma.lembaga.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.lembaga.findUnique({ where: { id } });
    if (existing?.logoPublicId) {
      try {
        await this.cloudinaryProvider.delete(existing.logoPublicId);
      } catch (e) {
        this.logger.error(
          { err: e, id, logoPublicId: existing.logoPublicId },
          "Failed to delete logo on record removal from Cloudinary",
        );
      }
    }
    return this.prisma.lembaga.delete({
      where: { id },
    });
  }

  /** Lembaga APPROVED (untuk dropdown/marketplace). */
  async findActive() {
    return this.prisma.lembaga.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
    });
  }

  /** Direktori publik lembaga APPROVED + statistik ringkas. */
  async findApprovedDirectory(page = 1, limit = 12, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.LembagaWhereInput = {
      status: "APPROVED",
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.lembaga.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          _count: { select: { programs: { where: { status: "PUBLISHED" } } } },
        },
      }),
      this.prisma.lembaga.count({ where }),
    ]);

    const itemsWithTotals = await Promise.all(
      items.map(async (item) => {
        const agg = await this.prisma.donation.aggregate({
          where: { lembagaId: item.id, status: "PAID" },
          _sum: { amount: true },
        });
        return {
          ...item,
          programCount: item._count.programs,
          totalCollected: Number(agg._sum.amount || 0),
        };
      }),
    );

    return {
      items: itemsWithTotals,
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Profil publik satu lembaga APPROVED + program + statistik. */
  async findApprovedProfileBySlug(slug: string) {
    const lembaga = await this.prisma.lembaga.findFirst({
      where: { slug, status: "APPROVED" },
      include: {
        programs: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!lembaga) return null;

    const agg = await this.prisma.donation.aggregate({
      where: { lembagaId: lembaga.id, status: "PAID" },
      _sum: { amount: true },
    });

    return {
      ...lembaga,
      totalCollected: Number(agg._sum.amount || 0),
    };
  }

  /**
   * Public self-service registration: creates the Lembaga (PENDING) + its
   * documents + the first LEMBAGA_ADMIN user, all in one transaction.
   */
  async registerLembaga(data: RegisterLembagaData) {
    return this.prisma.$transaction(async (tx) => {
      const lembaga = await tx.lembaga.create({
        data: {
          name: data.name,
          slug: data.slug,
          status: "PENDING",
          picName: data.picName,
          picPhone: data.picPhone,
          address: data.address,
          description: data.description,
          website: data.website,
          izinYayasanNumber: data.izinYayasanNumber,
          logoUrl: data.logoUrl,
          logoPublicId: data.logoPublicId,
          officePhotoUrl: data.officePhotoUrl,
          officePhotoPublicId: data.officePhotoPublicId,
        },
      });

      if (data.documents.length > 0) {
        await tx.lembagaDocument.createMany({
          data: data.documents.map((doc) => ({
            lembagaId: lembaga.id,
            type: doc.type,
            fileUrl: doc.fileUrl,
            filePublicId: doc.filePublicId,
            originalName: doc.originalName,
          })),
        });
      }

      const adminUser = await tx.user.create({
        data: {
          email: data.adminEmail,
          name: data.adminName,
          password: data.hashedPassword,
          roleId: data.lembagaAdminRoleId,
          lembagaId: lembaga.id,
          status: "ACTIVE",
        },
      });

      return { lembaga, adminUser };
    });
  }

  async approve(id: string, approvedById: string) {
    return this.prisma.lembaga.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById,
        rejectionReason: null,
      },
    });
  }

  async reject(id: string, reason: string, approvedById: string) {
    return this.prisma.lembaga.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        approvedById,
        approvedAt: null,
      },
    });
  }
}
