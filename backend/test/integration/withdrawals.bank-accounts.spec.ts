import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { WithdrawalsService } from "../../src/modules/withdrawals/withdrawals.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { WithdrawalsRepository } from "../../src/modules/withdrawals/withdrawals.repository";
import { XenditService } from "../../src/lib/xendit/xendit.service";
import { COA_KEYS } from "../../src/modules/coa/coa.template";

// Run against a migrated PostgreSQL database via TEST_DATABASE_URL.
// All fixtures and service writes are rolled back, including on assertion failure.
describe.skipIf(!process.env.TEST_DATABASE_URL)("Bank account creation (PostgreSQL)", () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }),
  });
  afterAll(() => prisma.$disconnect());

  it("creates the account and COA, rejects duplicates, and reactivates the same account", async () => {
    const rollback = new Error("Rollback test fixtures");
    await expect(prisma.$transaction(async (tx) => {
      const lembaga = await tx.lembaga.create({
        data: { name: "Bank account regression", slug: `bank-test-${randomUUID()}` },
      });
      const book = await tx.accountingBook.create({
        data: { name: "Test book", ownerType: "LEMBAGA", lembagaId: lembaga.id },
      });
      await tx.chartOfAccount.create({
        data: {
          accountingBookId: book.id, lembagaId: lembaga.id,
          key: COA_KEYS.BANK_ACCOUNTS, code: "1103", name: "Rekening Bank",
          accountType: "ASSET", normalBalance: "DEBIT", isHeader: true, level: 3,
        },
      });
      // Keep service transactions inside the real rollback-only test transaction.
      const service = new WithdrawalsService(
        { $transaction: (fn: (client: Prisma.TransactionClient) => unknown) => fn(tx) } as unknown as PrismaService,
        {} as WithdrawalsRepository,
        {} as XenditService,
      );
      const input = { bankCode: "ID_BCA", accountNumber: "1234567890", accountHolder: "Test Lembaga" };
      const bank = await service.createBankAccount(lembaga.id, input);
      expect(bank).toMatchObject({ ...input, lembagaId: lembaga.id, isActive: true, isDefault: true });
      expect(bank.chartOfAccount).toMatchObject({ code: "110301", name: "Bank BCA - 7890" });
      expect(await tx.lembaga.findUnique({ where: { id: lembaga.id } })).toMatchObject(input);

      await expect(service.createBankAccount(lembaga.id, input)).rejects.toMatchObject({
        code: "BANK_ACCOUNT_ALREADY_EXISTS", status: 409,
      });
      await service.deleteBankAccount(lembaga.id, bank.id);
      const replacement = { ...input, accountNumber: "9876543210" };
      const reactivated = await service.createBankAccount(lembaga.id, replacement);
      expect(reactivated).toMatchObject({ ...replacement, id: bank.id, isActive: true });
      expect(reactivated.chartOfAccount.id).toBe(bank.chartOfAccount.id);
      expect(await tx.lembagaBankAccount.count({ where: { lembagaId: lembaga.id } })).toBe(1);
      expect(await tx.chartOfAccount.findUnique({ where: { id: bank.chartOfAccount.id } }))
        .toMatchObject({ isActive: true, name: "Bank BCA - 3210" });
      expect(await tx.lembaga.findUnique({ where: { id: lembaga.id } })).toMatchObject(replacement);
      throw rollback;
    }, { timeout: 15000 })).rejects.toBe(rollback);
  });
});
