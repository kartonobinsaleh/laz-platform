import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

@Injectable()
export class VolunteerApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVolunteerAndActivity(volunteerId: string, activityId: string) {
    return this.prisma.volunteerApplication.findUnique({
      where: { volunteerId_activityId: { volunteerId, activityId } },
    });
  }

  async create(data: Prisma.VolunteerApplicationUncheckedCreateInput) {
    return this.prisma.volunteerApplication.create({ data });
  }

  async findOwnApplications(volunteerId: string, status?: string | string[]) {
    return this.prisma.volunteerApplication.findMany({
      where: {
        volunteerId,
        ...(status ? { status: (Array.isArray(status) ? { in: status } : status) as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        activity: {
          select: {
            title: true,
            description: true,
            location: true,
            activityDate: true,
            program: { select: { title: true, slug: true, imageUrl: true } },
          },
        },
        lembaga: { select: { name: true, slug: true } },
      },
    });
  }

  async findMany(page = 1, limit = 10, lembagaId?: string, status?: string, search?: string, activityId?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.VolunteerApplicationWhereInput = {
      ...(lembagaId ? { lembagaId } : {}),
      ...(activityId ? { activityId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            volunteer: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.volunteerApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          // Detail ini hanya dikembalikan dari endpoint dashboard yang dijaga
          // VOLUNTEERS_MANAGE dan sudah dibatasi ke lembaga pemilik kegiatan.
          // Jangan gunakan select ini pada endpoint publik/relawan lain.
          volunteer: {
            select: {
              name: true,
              email: true,
              phone: true,
              addressDomicile: true,
              addressKtp: true,
              photoUrl: true,
              ktpUrl: true,
              cvUrl: true,
            },
          },
          activity: { select: { title: true, quota: true } },
        },
      }),
      this.prisma.volunteerApplication.count({ where }),
    ]);

    return {
      items,
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findById(id: string) {
    return this.prisma.volunteerApplication.findUnique({
      where: { id },
      include: { activity: { select: { title: true } } },
    });
  }

  async approve(id: string, reviewedById: string) {
    return this.prisma.volunteerApplication.update({
      where: { id },
      data: { status: "APPROVED", reviewedById, reviewedAt: new Date(), rejectionReason: null },
    });
  }

  async reject(id: string, reason: string, reviewedById: string) {
    return this.prisma.volunteerApplication.update({
      where: { id },
      data: { status: "REJECTED", reviewedById, reviewedAt: new Date(), rejectionReason: reason },
    });
  }

  async submitReport(id: string, data: { reportText: string; reportFileUrl?: string; reportFilePublicId?: string }) {
    return this.prisma.volunteerApplication.update({
      where: { id },
      data: {
        status: "REPORT_SUBMITTED",
        reportText: data.reportText,
        reportFileUrl: data.reportFileUrl || null,
        reportFilePublicId: data.reportFilePublicId || null,
        reportSubmittedAt: new Date(),
        reportNote: null,
      },
    });
  }

  async verifyReport(id: string, verifiedById: string, note?: string) {
    return this.prisma.volunteerApplication.update({
      where: { id },
      data: { status: "COMPLETED", verifiedById, verifiedAt: new Date(), reportNote: note || null },
    });
  }

  /** Lembaga meminta relawan merevisi laporan — kembali ke APPROVED. */
  async requestReportRevision(id: string, verifiedById: string, note?: string) {
    return this.prisma.volunteerApplication.update({
      where: { id },
      data: { status: "APPROVED", verifiedById, verifiedAt: new Date(), reportNote: note || null },
    });
  }
}
