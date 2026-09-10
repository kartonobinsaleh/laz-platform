import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/app.error";
import { COA_KEYS, type CoaKey } from "../coa/coa.template";

type Tx = Prisma.TransactionClient;
type OwnerType = "LEMBAGA" | "PLATFORM";

interface JournalLine {
  key?: CoaKey;
  accountId?: string;
  debit?: number;
  credit?: number;
  description: string;
}

@Injectable()
export class AutoJournalService {
  private readonly logger = new Logger(AutoJournalService.name);

  private async getBook(tx: Tx, ownerType: OwnerType, lembagaId?: string) {
    const book = await tx.accountingBook.findFirst({
      where: ownerType === "PLATFORM" ? { ownerType } : { ownerType, lembagaId },
      select: { id: true },
    });
    if (!book) {
      throw new AppError("ACCOUNTING_BOOK_NOT_FOUND", `Buku akuntansi ${ownerType} belum tersedia`, 500);
    }
    return book;
  }

  private async getAccountMap(tx: Tx, accountingBookId: string, keys: CoaKey[]) {
    const uniqueKeys = [...new Set(keys)];
    const accounts = await tx.chartOfAccount.findMany({
      where: { accountingBookId, key: { in: uniqueKeys }, isActive: true, isHeader: false },
      select: { id: true, key: true },
    });
    if (accounts.length !== uniqueKeys.length) {
      const found = new Set(accounts.map((account) => account.key));
      const missing = uniqueKeys.filter((key) => !found.has(key));
      throw new AppError("COA_NOT_FOUND", `Akun COA belum tersedia: ${missing.join(", ")}`, 500);
    }
    return new Map(accounts.map((account) => [account.key, account.id]));
  }

  async generateJournalNo(tx: Tx, accountingBookId: string, date: Date): Promise<string> {
    const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    const prefix = `JU-${yearMonth}-`;
    const lastJournal = await tx.journal.findFirst({
      where: { accountingBookId, journalNo: { startsWith: prefix } },
      orderBy: { journalNo: "desc" },
      select: { journalNo: true },
    });
    const lastSequence = lastJournal ? Number.parseInt(lastJournal.journalNo.replace(prefix, ""), 10) : 0;
    const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
    return `${prefix}${nextSequence.toString().padStart(6, "0")}`;
  }

  private async postJournal(tx: Tx, input: {
    accountingBookId: string;
    lembagaId: string | null;
    description: string;
    sourceType: "DONATION" | "DISTRIBUTION" | "REFUND" | "EXPENSE" | "ASSET_PURCHASE" | "WITHDRAWAL";
    sourceId: string;
    sourceEvent: string;
    programId?: string | null;
    userId?: string | null;
    lines: JournalLine[];
  }) {
    const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new AppError("UNBALANCED_AUTO_JOURNAL", `Jurnal otomatis tidak balance: ${totalDebit} != ${totalCredit}`, 500);
    }

    const keys = input.lines.flatMap((line) => line.key ? [line.key] : []);
    const accounts = await this.getAccountMap(tx, input.accountingBookId, keys);
    const directIds = [...new Set(input.lines.flatMap((line) => line.accountId ? [line.accountId] : []))];
    if (directIds.length) {
      const validDirectAccounts = await tx.chartOfAccount.count({
        where: { id: { in: directIds }, accountingBookId: input.accountingBookId, isActive: true, isHeader: false },
      });
      if (validDirectAccounts !== directIds.length) {
        throw new AppError("INVALID_JOURNAL_ACCOUNT", "Akun jurnal dinamis tidak valid untuk buku ini", 500);
      }
    }
    const date = new Date();
    const journalNo = await this.generateJournalNo(tx, input.accountingBookId, date);

    return tx.journal.create({
      data: {
        accountingBookId: input.accountingBookId,
        lembagaId: input.lembagaId,
        journalNo,
        journalDate: date,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceEvent: input.sourceEvent,
        programId: input.programId ?? null,
        status: "POSTED",
        createdById: input.userId ?? null,
        postedById: input.userId ?? null,
        postedAt: date,
        details: {
          create: input.lines.map((line) => ({
            accountId: line.accountId ?? accounts.get(line.key!)!,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            description: line.description,
          })),
        },
      },
    });
  }

  private getDonationRevenueKey(category: string): CoaKey {
    switch (category) {
      case "ZAKAT": return COA_KEYS.ZAKAT_REVENUE;
      case "INFAK_SEDEKAH": return COA_KEYS.INFAK_SEDEKAH_REVENUE;
      case "WAKAF": return COA_KEYS.WAKAF_REVENUE;
      case "CSR": return COA_KEYS.CSR_REVENUE;
      case "DSKL": return COA_KEYS.DSKL_REVENUE;
      default: throw new AppError("UNSUPPORTED_PROGRAM_CATEGORY", `Kategori program tidak didukung: ${category}`, 500);
    }
  }

  private getDistributionKey(category: string): CoaKey {
    switch (category) {
      case "ZAKAT": return COA_KEYS.ZAKAT_DISTRIBUTION;
      case "INFAK_SEDEKAH": return COA_KEYS.INFAK_SEDEKAH_DISTRIBUTION;
      case "WAKAF": return COA_KEYS.WAKAF_DISTRIBUTION;
      case "CSR": return COA_KEYS.CSR_DISTRIBUTION;
      case "DSKL": return COA_KEYS.DSKL_DISTRIBUTION;
      default: throw new AppError("UNSUPPORTED_PROGRAM_CATEGORY", `Kategori program tidak didukung: ${category}`, 500);
    }
  }

  async createDonationJournal(
    tx: Tx,
    donationId: string,
    amount: number,
    amilPlatformAmount: number,
    amilInstitutionAmount: number,
    netAmount: number,
    programId: string,
    lembagaId: string,
    programCategory: string,
  ) {
    const institutionAmount = netAmount + amilInstitutionAmount;
    const totalAmilRevenue = amilInstitutionAmount + amilPlatformAmount;
    if (Math.abs(amount - (netAmount + totalAmilRevenue)) >= 0.01) {
      throw new AppError("INVALID_DONATION_SPLIT", "Pembagian donasi tidak sama dengan nilai bruto", 500);
    }

    const [lembagaBook, platformBook] = await Promise.all([
      this.getBook(tx, "LEMBAGA", lembagaId),
      this.getBook(tx, "PLATFORM"),
    ]);

    await this.postJournal(tx, {
      accountingBookId: lembagaBook.id,
      lembagaId,
      description: `Penerimaan Donasi #${donationId.slice(-6).toUpperCase()}`,
      sourceType: "DONATION",
      sourceId: donationId,
      sourceEvent: "PAYMENT_SUCCEEDED",
      programId,
      lines: [
        { key: COA_KEYS.PAYMENT_GATEWAY_RECEIVABLE, debit: institutionAmount, description: "Hak bersih Lembaga di payment gateway" },
        ...(amilPlatformAmount > 0 ? [{ key: COA_KEYS.PLATFORM_AMIL_EXPENSE, debit: amilPlatformAmount, description: "Bagian amil Platform" } as JournalLine] : []),
        { key: this.getDonationRevenueKey(programCategory), credit: netAmount, description: "Penerimaan dana program" },
        ...(totalAmilRevenue > 0 ? [{ key: COA_KEYS.AMIL_REVENUE, credit: totalAmilRevenue, description: "Penerimaan dana amil bruto" } as JournalLine] : []),
      ],
    });

    await this.postJournal(tx, {
      accountingBookId: platformBook.id,
      lembagaId: null,
      description: `Penerimaan Payment Gateway #${donationId.slice(-6).toUpperCase()}`,
      sourceType: "DONATION",
      sourceId: donationId,
      sourceEvent: "PAYMENT_SUCCEEDED",
      programId,
      lines: [
        { key: COA_KEYS.PAYMENT_GATEWAY_RECEIVABLE, debit: amount, description: "Dana bruto di payment gateway" },
        { key: COA_KEYS.INSTITUTION_FUNDS_PAYABLE, credit: institutionAmount, description: `Hak Lembaga ${lembagaId}` },
        ...(amilPlatformAmount > 0 ? [{ key: COA_KEYS.AMIL_REVENUE, credit: amilPlatformAmount, description: "Pendapatan amil Platform" } as JournalLine] : []),
      ],
    });

    await tx.platformBalance.upsert({
      where: { id: "platform" },
      update: { balance: { increment: amilPlatformAmount } },
      create: { id: "platform", balance: amilPlatformAmount },
    });
    this.logger.log(`Created Lembaga and Platform donation journals for ${donationId}`);
  }

  async createDistributionJournal(tx: Tx, distributionId: string, amount: number,
    programId: string, lembagaId: string, programCategory: string,
    fundSource: "MUSTAHIQ" | "AMIL", userId: string) {
    const lembagaBook = await this.getBook(tx, "LEMBAGA", lembagaId);
    const defaultBank = await tx.lembagaBankAccount.findFirst({
      where: { lembagaId, isActive: true, isDefault: true },
      select: { chartOfAccountId: true },
    });
    const sourceLabel = fundSource === "AMIL" ? "saldo amil lembaga" : "saldo utama/mustahiq";
    await this.postJournal(tx, {
      accountingBookId: lembagaBook.id,
      lembagaId,
      description: `Penyaluran #${distributionId.slice(-6).toUpperCase()}`,
      sourceType: "DISTRIBUTION",
      sourceId: distributionId,
      sourceEvent: "DISTRIBUTION_COMPLETED",
      programId,
      userId,
      lines: [
        {
          key: fundSource === "AMIL" ? COA_KEYS.OTHER_OPERATING_EXPENSE : this.getDistributionKey(programCategory),
          debit: amount,
          description: fundSource === "AMIL" ? "Penyaluran dari dana amil" : "Penyaluran dana program",
        },
        defaultBank
          ? { accountId: defaultBank.chartOfAccountId, credit: amount, description: `Pelaporan ${sourceLabel} dari rekening Bank utama` }
          : { key: COA_KEYS.BANK, credit: amount, description: `Pelaporan ${sourceLabel} dari Bank Operasional` },
      ],
    });
  }

  async createWithdrawalCompletionJournal(tx: Tx, withdrawalId: string, amount: number,
    lembagaId: string, userId: string | null, bankChartOfAccountId?: string | null,
    programId?: string | null, context?: {
      bankCode?: string | null;
      accountNumber?: string | null;
      programTitle?: string | null;
    }) {
    const [lembagaBook, platformBook] = await Promise.all([
      this.getBook(tx, "LEMBAGA", lembagaId),
      this.getBook(tx, "PLATFORM"),
    ]);
    const reference = withdrawalId.slice(-6).toUpperCase();
    const bankName = context?.bankCode?.replace(/^ID_/, "") || "Bank";
    const accountSuffix = context?.accountNumber?.slice(-4);
    const destination = `${bankName}${accountSuffix ? ` •${accountSuffix}` : ""}`;
    const programLabel = context?.programTitle ? ` program ${context.programTitle}` : "";
    const description = `Penarikan dana${programLabel} ke ${destination} berhasil #${reference}`;

    await this.postJournal(tx, {
      accountingBookId: lembagaBook.id,
      lembagaId,
      description,
      sourceType: "WITHDRAWAL",
      sourceId: withdrawalId,
      sourceEvent: "PAYOUT_SUCCEEDED",
      programId: programId ?? null,
      userId,
      lines: [
        bankChartOfAccountId
          ? { accountId: bankChartOfAccountId, debit: amount, description: `Dana penarikan masuk ke ${destination}` }
          : { key: COA_KEYS.BANK, debit: amount, description: `Dana penarikan masuk ke ${destination}` },
        { key: COA_KEYS.PAYMENT_GATEWAY_RECEIVABLE, credit: amount, description: `Saldo rekening${programLabel} berkurang` },
      ],
    });
    await this.postJournal(tx, {
      accountingBookId: platformBook.id,
      lembagaId: null,
      description,
      sourceType: "WITHDRAWAL",
      sourceId: withdrawalId,
      sourceEvent: "PAYOUT_SUCCEEDED",
      userId,
      lines: [
        { key: COA_KEYS.INSTITUTION_FUNDS_PAYABLE, debit: amount, description: `Pelunasan hak Lembaga ${lembagaId}${programLabel}` },
        { key: COA_KEYS.PAYMENT_GATEWAY_RECEIVABLE, credit: amount, description: `Transfer payout ke ${destination}` },
      ],
    });
  }

  async createPlatformWithdrawalCompletionJournal(tx: Tx, withdrawalId: string, amount: number, userId: string | null) {
    const book = await this.getBook(tx, "PLATFORM");
    await this.postJournal(tx, {
      accountingBookId: book.id,
      lembagaId: null,
      description: `Payout Platform berhasil #${withdrawalId.slice(-6).toUpperCase()}`,
      sourceType: "WITHDRAWAL",
      sourceId: withdrawalId,
      sourceEvent: "PLATFORM_PAYOUT_SUCCEEDED",
      userId,
      lines: [
        { key: COA_KEYS.BANK, debit: amount, description: "Dana Platform masuk Bank" },
        { key: COA_KEYS.PAYMENT_GATEWAY_RECEIVABLE, credit: amount, description: "Dana Platform keluar dari payment gateway" },
      ],
    });
  }

  async createGatewayFeeJournal(tx: Tx, sourceId: string, amount: number) {
    const book = await this.getBook(tx, "PLATFORM");
    await this.postJournal(tx, {
      accountingBookId: book.id,
      lembagaId: null,
      description: `Biaya payment gateway #${sourceId.slice(-6).toUpperCase()}`,
      sourceType: "EXPENSE",
      sourceId,
      sourceEvent: "GATEWAY_FEE_POSTED",
      lines: [
        { key: COA_KEYS.BANK_GATEWAY_EXPENSE, debit: amount, description: "Biaya payment gateway" },
        { key: COA_KEYS.PAYMENT_GATEWAY_RECEIVABLE, credit: amount, description: "Potongan saldo rekening" },
      ],
    });
    await tx.platformBalance.update({ where: { id: "platform" }, data: { balance: { decrement: amount } } });
  }
}
