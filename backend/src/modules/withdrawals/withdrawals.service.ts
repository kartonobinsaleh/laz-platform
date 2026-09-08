import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WithdrawalsRepository } from "./withdrawals.repository";
import { AppError } from "../../common/errors/app.error";
import { XenditService } from "../../lib/xendit/xendit.service";
import * as crypto from "crypto";
import { NotificationsService } from "../notifications/notifications.service";
import { COA_KEYS } from "../coa/coa.template";
import { Prisma } from "@prisma/client";

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawalsRepository: WithdrawalsRepository,
    private readonly xenditService: XenditService,
    @Optional() private readonly notifications?: NotificationsService,
  ) { }

  async createWithdrawal(lembagaId: string, userId: string, amount: number, programId: string) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new AppError("INVALID_AMOUNT", "Withdrawal amount must be a positive integer.", 400);
    }

    const lembaga = await this.prisma.lembaga.findUnique({
      where: { id: lembagaId },
      select: { status: true },
    });

    if (!lembaga) {
      throw new AppError("NOT_FOUND", "Institution not found.", 404);
    }

    if (lembaga.status !== "APPROVED") {
      throw new AppError("FORBIDDEN", "Institution is not eligible to withdraw funds.", 403);
    }

    if (!programId?.trim()) {
      throw new AppError("PROGRAM_REQUIRED", "Program sumber dana wajib dipilih.", 400);
    }

    const programBalance = await this.prisma.programBalance.findFirst({
      where: { programId, lembagaId },
      select: { programId: true },
    });
    if (!programBalance) {
      throw new AppError("PROGRAM_BALANCE_NOT_FOUND", "Program tidak memiliki saldo yang dapat ditarik.", 404);
    }

    // Rekening tidak diterima dari client. Backend selalu mengambil satu-satunya
    // rekening aktif milik tenant sehingga IDOR/cross-tenant tidak mungkin.
    const bankAccount = await this.prisma.lembagaBankAccount.findUnique({
      where: { lembagaId },
    });
    if (!bankAccount?.isActive) {
      throw new AppError("BANK_NOT_FOUND", "Rekening Bank tidak ditemukan atau tidak aktif", 404);
    }

    const withdrawal = await this.withdrawalsRepository.createWithdrawal(
      lembagaId,
      programId,
      amount,
      userId,
      bankAccount.id,
      bankAccount.bankCode,
      bankAccount.accountNumber,
      bankAccount.accountHolder
    );
    await this.notifications?.notifyRole("SUPER_ADMIN", {
      type: "ACTION_REQUIRED",
      title: "Penarikan dana menunggu persetujuan",
      message: `Ada permintaan penarikan dana sebesar ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)}.`,
      link: "/dashboard/withdrawals",
    });
    return withdrawal;
  }

  async listProgramBalances(lembagaId: string) {
    const programs = await this.prisma.program.findMany({
      where: { lembagaId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        balance: {
          select: {
            balance: true,
            mustahiqBalance: true,
            amilBalance: true,
            reservedBalance: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return programs.map(({ balance, ...program }) => ({
      programId: program.id,
      balance: balance?.balance ?? 0,
      mustahiqBalance: balance?.mustahiqBalance ?? 0,
      amilBalance: balance?.amilBalance ?? 0,
      reservedBalance: balance?.reservedBalance ?? 0,
      program,
    }));
  }

  async listBankAccounts(lembagaId: string) {
    return this.prisma.lembagaBankAccount.findMany({
      where: { lembagaId, isActive: true },
      include: { chartOfAccount: { select: { id: true, code: true, name: true } } },
      take: 1,
    });
  }

  async createBankAccount(lembagaId: string, input: {
    bankCode: string; accountNumber: string; accountHolder: string; label?: string; isDefault?: boolean;
  }) {
    this.validateBankAccount(input);
    return this.prisma.$transaction(async (tx) => {
      // Serialisasi create pada tenant yang sama; unique(lembagaId) tetap
      // menjadi lapisan pertahanan terakhir di database.
      // Fungsi lock mengembalikan void, yang tidak dapat dideserialisasi Prisma.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lembagaId}))`);

      const existingBank = await tx.lembagaBankAccount.findUnique({
        where: { lembagaId },
        include: { chartOfAccount: { select: { id: true, code: true, name: true } } },
      });
      if (existingBank?.isActive) {
        throw new AppError(
          "BANK_ACCOUNT_ALREADY_EXISTS",
          "Lembaga hanya boleh memiliki satu rekening Bank. Ubah rekening yang sudah ada.",
          409,
        );
      }

      if (existingBank) {
        const accountName = this.bankCoaName(input);
        await tx.chartOfAccount.update({
          where: { id: existingBank.chartOfAccountId },
          data: { name: accountName, isActive: true },
        });
        const reactivated = await tx.lembagaBankAccount.update({
          where: { id: existingBank.id },
          data: {
            bankCode: input.bankCode.trim(),
            accountNumber: input.accountNumber.trim(),
            accountHolder: input.accountHolder.trim(),
            label: input.label?.trim() || null,
            isDefault: true,
            isActive: true,
          },
          include: { chartOfAccount: { select: { id: true, code: true, name: true } } },
        });
        await tx.lembaga.update({
          where: { id: lembagaId },
          data: {
            bankCode: reactivated.bankCode,
            accountNumber: reactivated.accountNumber,
            accountHolder: reactivated.accountHolder,
          },
        });
        return reactivated;
      }

      const parent = await tx.chartOfAccount.findFirst({
        where: { lembagaId, key: COA_KEYS.BANK_ACCOUNTS, isActive: true },
      });
      if (!parent) throw new AppError("BANK_COA_NOT_FOUND", "Kelompok COA Rekening Bank belum tersedia", 500);
      const usedCodes = new Set((await tx.chartOfAccount.findMany({
        where: { accountingBookId: parent.accountingBookId, code: { startsWith: "1103" } },
        select: { code: true },
      })).map((account) => account.code));
      let code = "";
      for (let sequence = 1; sequence <= 98; sequence++) {
        const candidate = `1103${sequence.toString().padStart(2, "0")}`;
        if (!usedCodes.has(candidate)) { code = candidate; break; }
      }
      if (!code) throw new AppError("BANK_COA_LIMIT", "Maksimal rekening Bank telah tercapai", 409);
      const accountName = this.bankCoaName(input);
      const coa = await tx.chartOfAccount.create({
        data: {
          accountingBookId: parent.accountingBookId,
          lembagaId,
          key: `BANK_ACCOUNT_${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
          code,
          name: accountName,
          accountType: "ASSET",
          normalBalance: "DEBIT",
          isHeader: false,
          parentCode: parent.code,
          level: parent.level + 1,
          isSystem: false,
          isEditable: false,
          isDeletable: false,
        },
      });
      const bank = await tx.lembagaBankAccount.create({
        data: {
          lembagaId,
          chartOfAccountId: coa.id,
          bankCode: input.bankCode.trim(),
          accountNumber: input.accountNumber.trim(),
          accountHolder: input.accountHolder.trim(),
          label: input.label?.trim() || null,
          isDefault: true,
        },
        include: { chartOfAccount: { select: { id: true, code: true, name: true } } },
      });
      await tx.lembaga.update({
        where: { id: lembagaId },
        data: { bankCode: bank.bankCode, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder },
      });
      return bank;
    });
  }

  async updateBankAccount(lembagaId: string, id: string, input: {
    bankCode: string; accountNumber: string; accountHolder: string; label?: string; isDefault?: boolean;
  }) {
    this.validateBankAccount(input);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lembagaBankAccount.findUnique({ where: { lembagaId } });
      if (current?.id !== id || !current.isActive) {
        throw new AppError("BANK_NOT_FOUND", "Rekening Bank tidak ditemukan", 404);
      }
      const bank = await tx.lembagaBankAccount.update({
        where: { id },
        data: {
          bankCode: input.bankCode.trim(), accountNumber: input.accountNumber.trim(),
          accountHolder: input.accountHolder.trim(), label: input.label?.trim() || null,
          isDefault: true,
          isActive: true,
          chartOfAccount: { update: { name: this.bankCoaName(input) } },
        },
        include: { chartOfAccount: { select: { id: true, code: true, name: true } } },
      });
      await tx.lembaga.update({
        where: { id: lembagaId },
        data: { bankCode: bank.bankCode, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder },
      });
      return bank;
    });
  }

  async deleteBankAccount(lembagaId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const bank = await tx.lembagaBankAccount.findFirst({ where: { id, lembagaId, isActive: true } });
      if (!bank) throw new AppError("BANK_NOT_FOUND", "Rekening Bank tidak ditemukan", 404);
      const activeWithdrawal = await tx.withdrawal.count({
        where: { bankAccountId: id, status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
      });
      if (activeWithdrawal) throw new AppError("BANK_IN_USE", "Rekening masih digunakan oleh pencairan aktif", 409);
      await tx.lembagaBankAccount.update({ where: { id }, data: { isActive: false, isDefault: false } });
      await tx.chartOfAccount.update({ where: { id: bank.chartOfAccountId }, data: { isActive: false } });
      if (bank.isDefault) {
        const replacement = await tx.lembagaBankAccount.findFirst({
          where: { lembagaId, isActive: true }, orderBy: { createdAt: "asc" },
        });
        if (replacement) {
          await tx.lembagaBankAccount.update({ where: { id: replacement.id }, data: { isDefault: true } });
          await tx.lembaga.update({ where: { id: lembagaId }, data: {
            bankCode: replacement.bankCode, accountNumber: replacement.accountNumber, accountHolder: replacement.accountHolder,
          } });
        } else {
          await tx.lembaga.update({ where: { id: lembagaId }, data: { bankCode: null, accountNumber: null, accountHolder: null } });
        }
      }
      return { success: true };
    });
  }

  private validateBankAccount(input: { bankCode: string; accountNumber: string; accountHolder: string }) {
    if (!input.bankCode?.trim() || !/^\d{5,30}$/.test(input.accountNumber?.trim() ?? "") || !input.accountHolder?.trim()) {
      throw new AppError("INVALID_BANK_ACCOUNT", "Bank, nomor rekening 5-30 digit, dan nama pemilik wajib diisi", 400);
    }
  }

  private bankCoaName(input: { bankCode: string; accountNumber: string; label?: string }) {
    const bankName = input.bankCode.trim().replace(/^ID_/, "");
    return input.label?.trim() || `Bank ${bankName} - ${input.accountNumber.trim().slice(-4)}`;
  }

  async createPlatformWithdrawal(userId: string, amount: number) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new AppError("INVALID_AMOUNT", "Withdrawal amount must be a positive integer.", 400);
    }
    const balance = await this.prisma.platformBalance.findUnique({ where: { id: "platform" } });
    if (!balance?.bankCode || !balance.accountNumber || !balance.accountHolder) {
      throw new AppError("BANK_NOT_CONFIGURED", "Rekening Bank Platform belum lengkap.", 400);
    }
    return this.withdrawalsRepository.createPlatformWithdrawal(
      amount,
      userId,
      balance.bankCode,
      balance.accountNumber,
      balance.accountHolder,
    );
  }

  async getPlatformBalance() {
    return this.prisma.platformBalance.upsert({
      where: { id: "platform" },
      update: {},
      create: { id: "platform" },
    });
  }

  async updatePlatformBankAccount(userId: string, input: { bankCode: string; accountNumber: string; accountHolder: string }) {
    this.validateBankAccount(input);
    const balance = await this.prisma.platformBalance.upsert({
      where: { id: "platform" },
      update: {
        bankCode: input.bankCode.trim(),
        accountNumber: input.accountNumber.trim(),
        accountHolder: input.accountHolder.trim(),
      },
      create: {
        id: "platform",
        bankCode: input.bankCode.trim(),
        accountNumber: input.accountNumber.trim(),
        accountHolder: input.accountHolder.trim(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "PlatformBalance",
        entityId: balance.id,
        userId,
        newData: { bankCode: balance.bankCode, accountNumber: balance.accountNumber, accountHolder: balance.accountHolder },
      },
    });
    return balance;
  }

  async approveWithdrawal(withdrawalId: string, superAdminId: string) {
    const withdrawal = await this.withdrawalsRepository.approveWithdrawal(withdrawalId, superAdminId);
    if (!withdrawal) throw new AppError("NOT_FOUND", "Withdrawal not found.", 404);

    if (withdrawal.lembagaId) {
      await this.notifications?.notifyLembaga(withdrawal.lembagaId, {
        type: "SUCCESS",
        title: "Penarikan dana disetujui",
        message: "Permintaan penarikan dana Anda telah disetujui dan sedang diproses.",
        link: "/dashboard/lembaga/finance/overview",
      });
    }

    // Kick off the payout process. We don't await this so the UI responds quickly.
    // If it fails synchronously, the retry endpoint can be used.
    this.processApprovedWithdrawal(withdrawal).catch((err) => {
      this.logger.error({ withdrawalId, err }, "Failed to process payout during approval");
    });

    return withdrawal;
  }

  async processApprovedWithdrawal(withdrawal: any) {
    if (withdrawal.status !== "APPROVED") {
      throw new AppError("INVALID_STATE", "Withdrawal is not approved", 400);
    }

    const idempotencyKey = crypto.randomUUID();
    const referenceId = `payout-${withdrawal.id}`;

    // 1. Create or get existing Payout record
    const payoutRecord = await this.withdrawalsRepository.createPayoutRecord(
      withdrawal,
      idempotencyKey,
      referenceId
    );

    if (payoutRecord.status !== "REQUESTED" && payoutRecord.status !== "FAILED") {
      this.logger.warn({ withdrawalId: withdrawal.id }, "Payout already in progress or completed");
      return;
    }

    // 2. Call Xendit API
    const payoutResult = await this.xenditService.createPayout({
      idempotencyKey: payoutRecord.idempotencyKey,
      referenceId: payoutRecord.referenceId,
      amountIdr: Number(withdrawal.amount),
      channelCode: withdrawal.bankCode,
      accountNumber: withdrawal.accountNumber,
      accountHolderName: withdrawal.accountHolder,
    });

    // 3. Respons create-payout hanya acknowledgement. Status COMPLETED dan
    // konsumsi saldo reservasi hanya boleh terjadi lewat webhook sukses yang
    // terverifikasi, yaitu saat gateway menyatakan dana benar-benar terkirim.
    const payoutRejected = ["FAILED", "CANCELLED", "REVERSED"].includes(payoutResult.status);
    // Kegagalan acknowledgement bukan bukti dana gagal secara terminal;
    // pertahankan REQUESTED agar retry aman dan webhook gagal masih dapat
    // melepaskan reservasi tepat satu kali.
    const newPayoutStatus = payoutRejected ? "REQUESTED" : "PROCESSING";
    const newWithdrawalStatus = payoutRejected ? undefined : "PROCESSING";

    await this.withdrawalsRepository.updatePayoutStatus(
      withdrawal.id,
      payoutResult.payoutId,
      newPayoutStatus,
      newWithdrawalStatus
    );
  }

  async retryPayout(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { payout: true }
    });

    if (!withdrawal) {
      throw new AppError("NOT_FOUND", "Withdrawal not found", 404);
    }

    if (withdrawal.status !== "APPROVED") {
      throw new AppError("INVALID_STATE", "Only APPROVED withdrawals can be retried", 400);
    }

    await this.processApprovedWithdrawal(withdrawal);

    return { success: true, message: "Payout retry initiated" };
  }

  async rejectWithdrawal(withdrawalId: string, superAdminId: string, reason: string) {
    if (!reason || reason.trim() === "") {
      throw new AppError("INVALID_INPUT", "Rejection reason is required.", 400);
    }
    const withdrawal = await this.withdrawalsRepository.rejectWithdrawal(withdrawalId, superAdminId, reason);
    if (!withdrawal) throw new AppError("NOT_FOUND", "Withdrawal not found.", 404);
    if (withdrawal.lembagaId) {
      await this.notifications?.notifyLembaga(withdrawal.lembagaId, {
        type: "WARNING",
        title: "Penarikan dana ditolak",
        message: `Permintaan penarikan dana ditolak: ${reason}`,
        link: "/dashboard/lembaga/finance/overview",
      });
    }
    return withdrawal;
  }

  async getLembagaWithdrawals(lembagaId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { lembagaId },
        include: { program: { select: { id: true, title: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where: { lembagaId } }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getPlatformWithdrawals(page = 1, limit = 10) {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
      throw new AppError("INVALID_PAGINATION", "Halaman harus positif dan batas data antara 1–100.", 400);
    }
    const where = { isPlatform: true };
    const [data, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getAllWithdrawals(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          lembaga: { select: { name: true, slug: true } },
          requestedBy: { select: { name: true, email: true } },
          approvedBy: { select: { name: true, email: true } },
          program: { select: { id: true, title: true, slug: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getAllPayouts(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          withdrawal: {
            include: {
              lembaga: { select: { name: true, slug: true } }
            }
          }
        },
        skip,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
