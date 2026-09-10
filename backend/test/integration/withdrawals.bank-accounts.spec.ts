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

  it("activates the first account immediately and applies subsequent changes only after approval", async () => {
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
      const role = await tx.role.create({ data: { name: 'BANK_TEST_' + randomUUID() } });
      const requester = await tx.user.create({ data: { email: randomUUID() + '@bank.test', roleId: role.id, lembagaId: lembaga.id } });
      const reviewer = await tx.user.create({ data: { email: randomUUID() + '@bank.test', roleId: role.id } });
      // Keep service transactions inside the real rollback-only test transaction.
      const service = new WithdrawalsService(
        { ...tx, $transaction: (fn: (client: Prisma.TransactionClient) => unknown) => fn(tx) } as unknown as PrismaService,
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
      await expect(service.deleteBankAccount(lembaga.id, bank.id)).rejects.toMatchObject({ code: "BANK_ACCOUNT_LOCKED" });
      const replacement = { ...input, bankCode: "ID_BNI", accountNumber: "9876543210" };
      const changeInput = { ...replacement, changeReason: "Pergantian rekening operasional" };
      const pending = await service.updateBankAccount(lembaga.id, bank.id, changeInput, requester.id);
      expect(pending).toMatchObject({ status: "PENDING", changeReason: changeInput.changeReason, previousAccountNumber: input.accountNumber });
      expect(await tx.lembagaBankAccount.findUnique({ where: { id: bank.id } })).toMatchObject(input);
      expect(await tx.lembaga.findUnique({ where: { id: lembaga.id } })).toMatchObject(input);
      await expect(service.updateBankAccount(lembaga.id, bank.id, changeInput, requester.id)).rejects.toMatchObject({ code: "BANK_CHANGE_PENDING" });
      await service.reviewBankChange(pending.id, reviewer.id, false, "Nama belum sesuai");
      expect(await tx.bankAccountChangeRequest.findUnique({ where: { id: pending.id } })).toMatchObject({ status: "REJECTED", rejectionReason: "Nama belum sesuai" });
      expect(await tx.lembagaBankAccount.findUnique({ where: { id: bank.id } })).toMatchObject(input);
      const next = await service.updateBankAccount(lembaga.id, bank.id, changeInput, requester.id);
      await service.reviewBankChange(next.id, reviewer.id, true);
      expect(await tx.lembagaBankAccount.findUnique({ where: { id: bank.id } })).toMatchObject({ ...replacement, isActive: true });
      expect(await tx.chartOfAccount.findUnique({ where: { id: bank.chartOfAccount.id } })).toMatchObject({ name: "Bank BNI - 3210" });
      expect(await tx.lembaga.findUnique({ where: { id: lembaga.id } })).toMatchObject(replacement);
      await expect(service.reviewBankChange(next.id, reviewer.id, false, "Terlambat")).rejects.toMatchObject({ code: "INVALID_STATE" });
      expect(await tx.lembagaBankAccount.count({ where: { lembagaId: lembaga.id } })).toBe(1);
      // Legacy inactive records must not allow a fresh initial bank to bypass approval.
      await tx.lembagaBankAccount.update({ where: { id: bank.id }, data: { isActive: false } });
      await expect(service.createBankAccount(lembaga.id, input)).rejects.toMatchObject({ code: "BANK_ACCOUNT_ALREADY_EXISTS" });
      throw rollback;
    }, { timeout: 15000 })).rejects.toBe(rollback);
  });
});
