import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { WithdrawalsService } from "../../src/modules/withdrawals/withdrawals.service";
import { WithdrawalsController } from "../../src/modules/withdrawals/withdrawals.controller";

const oldBank = { id: "bank-1", bankCode: "ID_BCA", accountNumber: "1234567890", accountHolder: "Lembaga", label: null, isActive: true };
const proposed = { bankCode: "ID_BNI", accountNumber: "9876543210", accountHolder: "Nama baru" };
const changeInput = { ...proposed, changeReason: "Rekening operasional lembaga berubah" };
const request = { id: "change-1", lembagaId: "lembaga-1", ...changeInput, label: null, previousBankCode: oldBank.bankCode, previousAccountNumber: oldBank.accountNumber, previousAccountHolder: oldBank.accountHolder, status: "PENDING" };

function setup() {
  const db = {
    $executeRaw: vi.fn(),
    lembagaBankAccount: { findUnique: vi.fn().mockResolvedValue(oldBank), findFirst: vi.fn().mockResolvedValue(oldBank), update: vi.fn() },
    lembaga: { update: vi.fn() },
    platformBalance: { findUnique: vi.fn().mockResolvedValue({ id: "platform", ...oldBank }), upsert: vi.fn().mockResolvedValue({ id: "platform", ...proposed }), update: vi.fn() },
    bankAccountChangeRequest: {
      findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(request),
      create: vi.fn().mockImplementation(({ data }) => ({ id: "change-1", status: "PENDING", ...data })),
      update: vi.fn().mockImplementation(({ data }) => ({ ...request, ...data })),
      findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn() },
  };
  const prisma = { ...db, $transaction: vi.fn((fn) => fn(db)) };
  const repository = { createPlatformWithdrawal: vi.fn() };
  const service = new WithdrawalsService(prisma as any, repository as any, {} as any);
  return { service, db, repository };
}

describe("Primary bank account change workflow", () => {
  it("saves the first platform bank immediately and records the audit in the transaction", async () => {
    const { service, db } = setup();
    db.platformBalance.findUnique.mockResolvedValue(null as any);
    await service.updatePlatformBankAccount("finance-1", proposed);
    expect(db.platformBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: proposed }));
    expect(db.bankAccountChangeRequest.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it.each(["lembaga", "platform"])("keeps the active %s bank unchanged while a proposal is pending", async (scope) => {
    const { service, db } = setup();
    const result = scope === "lembaga"
      ? await service.updateBankAccount("lembaga-1", "bank-1", changeInput, "staff-1")
      : await service.updatePlatformBankAccount("finance-1", changeInput);
    expect(result).toMatchObject({ status: "PENDING", ...proposed, previousAccountNumber: oldBank.accountNumber, lembagaId: scope === "lembaga" ? "lembaga-1" : null });
    expect(db.lembagaBankAccount.update).not.toHaveBeenCalled();
    expect(db.lembaga.update).not.toHaveBeenCalled();
    expect(db.platformBalance.upsert).not.toHaveBeenCalled();
    expect(db.platformBalance.update).not.toHaveBeenCalled();
  });

  it("uses the existing platform bank for withdrawals during pending changes", async () => {
    const { service, repository } = setup();
    await service.updatePlatformBankAccount("finance-1", changeInput);
    await service.createPlatformWithdrawal("finance-1", 10000);
    expect(repository.createPlatformWithdrawal).toHaveBeenCalledWith(10000, "finance-1", oldBank.bankCode, oldBank.accountNumber, oldBank.accountHolder);
  });

  it.each(["lembaga", "platform"])("prevents a second pending proposal for %s", async (scope) => {
    const { service, db } = setup();
    db.bankAccountChangeRequest.findFirst.mockResolvedValue(request as any);
    await expect(scope === "lembaga"
      ? service.updateBankAccount("lembaga-1", "bank-1", changeInput, "staff-1")
      : service.updatePlatformBankAccount("finance-1", changeInput)).rejects.toMatchObject({ code: "BANK_CHANGE_PENDING" });
    expect(db.bankAccountChangeRequest.create).not.toHaveBeenCalled();
  });

  it("prevents cross-Lembaga edits and the deactivate/recreate bypass, including inactive accounts", async () => {
    const { service, db } = setup();
    await expect(service.updateBankAccount("lembaga-1", "foreign-bank", changeInput, "staff-1")).rejects.toMatchObject({ code: "BANK_NOT_FOUND" });
    await expect(service.deleteBankAccount("lembaga-1", "bank-1")).rejects.toMatchObject({ code: "BANK_ACCOUNT_LOCKED" });
    db.lembagaBankAccount.findUnique.mockResolvedValue({ ...oldBank, isActive: false });
    await expect(service.createBankAccount("lembaga-1", proposed)).rejects.toMatchObject({ code: "BANK_ACCOUNT_ALREADY_EXISTS" });
    expect(db.bankAccountChangeRequest.create).not.toHaveBeenCalled();
  });

  it("atomically approves Lembaga bank, COA, cached profile and request with reviewer audit", async () => {
    const { service, db } = setup();
    await expect(service.reviewBankChange("change-1", "admin-1", true)).resolves.toMatchObject({ status: "APPROVED", reviewedById: "admin-1", rejectionReason: null });
    expect(db.lembagaBankAccount.update).toHaveBeenCalledWith({ where: { lembagaId: "lembaga-1" }, data: { ...proposed, label: null, isActive: true, isDefault: true, chartOfAccount: { update: { name: "Bank BNI - 3210", isActive: true } } } });
    expect(db.lembaga.update).toHaveBeenCalledWith({ where: { id: "lembaga-1" }, data: proposed });
    expect(db.platformBalance.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "admin-1", entity: "BankAccountChangeRequest" }) }));
  });

  it("activates approved platform details without changing balances or any Lembaga", async () => {
    const { service, db } = setup();
    db.bankAccountChangeRequest.findUnique.mockResolvedValue({ ...request, lembagaId: null } as any);
    await service.reviewBankChange("change-1", "admin-1", true);
    expect(db.platformBalance.update).toHaveBeenCalledWith({ where: { id: "platform" }, data: proposed });
    expect(db.lembagaBankAccount.update).not.toHaveBeenCalled();
  });

  it("rejects with a readable reason and preserves the current bank", async () => {
    const { service, db } = setup();
    await expect(service.reviewBankChange("change-1", "admin-1", false, "  Nama pemilik tidak sesuai  ")).resolves.toMatchObject({ status: "REJECTED", rejectionReason: "Nama pemilik tidak sesuai" });
    expect(db.lembagaBankAccount.update).not.toHaveBeenCalled();
    expect(db.platformBalance.update).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   ", "a".repeat(2001)])("requires a nonempty bounded rejection reason", async (reason) => {
    const { service, db } = setup();
    await expect(service.reviewBankChange("change-1", "admin-1", false, reason)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(db.bankAccountChangeRequest.update).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   ", "a".repeat(2001)])("requires a nonempty bounded change reason", async (changeReason) => {
    const { service, db } = setup();
    await expect(service.updatePlatformBankAccount("finance-1", { ...proposed, changeReason })).rejects.toMatchObject({ code: "INVALID_CHANGE_REASON" });
    expect(db.bankAccountChangeRequest.create).not.toHaveBeenCalled();
  });

  it("rechecks state after acquiring the lock so a repeated review cannot overwrite a decision", async () => {
    const { service, db } = setup();
    db.bankAccountChangeRequest.findUnique.mockResolvedValueOnce(request).mockResolvedValueOnce({ ...request, status: "REJECTED" });
    await expect(service.reviewBankChange("change-1", "admin-1", true)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(db.lembagaBankAccount.update).not.toHaveBeenCalled();
  });

  it.each(["lembaga-1", null, undefined])("scopes history explicitly for owner %s", async (owner) => {
    const { service, db } = setup();
    await service.listBankChanges(owner);
    expect(db.bankAccountChangeRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: owner === undefined ? {} : { lembagaId: owner } }));
  });
});

describe("Bank approval authorization", () => {
  it.each([["FINANCE_PLATFORM", null], ["LEMBAGA_ADMIN", "lembaga-1"], ["CUSTOM_ADMIN", null], ["SUPER_ADMIN", "lembaga-1"]])("blocks %s / %s even with management permission", async (roleName, lembagaId) => {
    const service = { reviewBankChange: vi.fn(), listBankChanges: vi.fn() };
    const controller = new WithdrawalsController(service as any);
    const req = { user: { id: "user-1", roleName, lembagaId, permissions: ["withdrawals.manage"] } } as unknown as Request;
    for (const action of [() => controller.getBankChanges(req), () => controller.approveBankChange(req, "change-1"), () => controller.rejectBankChange(req, "change-1", { reason: "Salah" })]) {
      await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(service.reviewBankChange).not.toHaveBeenCalled();
    expect(service.listBankChanges).not.toHaveBeenCalled();
  });

  it("allows Super Admin review and derives request ownership from the session", async () => {
    const service = { reviewBankChange: vi.fn(), updateBankAccount: vi.fn(), listBankChanges: vi.fn() };
    const controller = new WithdrawalsController(service as any);
    await controller.approveBankChange({ user: { id: "admin-1", roleName: "SUPER_ADMIN", lembagaId: null } } as any, "change-1");
    expect(service.reviewBankChange).toHaveBeenCalledWith("change-1", "admin-1", true);
    const req = { user: { id: "staff-1", lembagaId: "lembaga-1" } } as any;
    await controller.updateBankAccount(req, "bank-1", { ...proposed, lembagaId: "foreign", requestedById: "foreign" } as any);
    expect(service.updateBankAccount).toHaveBeenCalledWith("lembaga-1", "bank-1", expect.anything(), "staff-1");
    await controller.getMyBankChanges(req);
    expect(service.listBankChanges).toHaveBeenCalledWith("lembaga-1", undefined, 1);
  });
});
