import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { WithdrawalsController } from "../../src/modules/withdrawals/withdrawals.controller";
import type { WithdrawalsService } from "../../src/modules/withdrawals/withdrawals.service";

describe("Platform withdrawal role restriction", () => {
  const bank = { bankCode: "ID_BCA", accountNumber: "123456", accountHolder: "Platform" };

  it.each([
    ["SUPER_ADMIN", null],
    ["LEMBAGA_ADMIN", "lembaga-1"],
    ["CUSTOM_FINANCE", null],
    ["FINANCE_PLATFORM", "lembaga-1"],
    [undefined, null],
  ])("rejects role %s with lembaga %s before accessing data", async (roleName, lembagaId) => {
    const service = {
      getPlatformBalance: vi.fn(),
      createPlatformWithdrawal: vi.fn(),
      updatePlatformBankAccount: vi.fn(),
    };
    const controller = new WithdrawalsController(service as unknown as WithdrawalsService);
    const req = { user: { id: "user-1", roleName, lembagaId, permissions: ["platform_withdrawals.create"] } } as unknown as Request;

    for (const action of [
      () => controller.getPlatformBalance(req),
      () => controller.createPlatformWithdrawal(req, { amount: 10000 }),
      () => controller.updatePlatformBank(req, bank),
    ]) {
      await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    }
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });

  it("allows platform finance to access all three endpoints", async () => {
    const service = {
      getPlatformBalance: vi.fn().mockResolvedValue({ balance: 10000 }),
      createPlatformWithdrawal: vi.fn().mockResolvedValue({ id: "withdrawal-1" }),
      updatePlatformBankAccount: vi.fn().mockResolvedValue(bank),
    };
    const controller = new WithdrawalsController(service as unknown as WithdrawalsService);
    const req = { user: { id: "finance-1", roleName: "FINANCE_PLATFORM", lembagaId: null } } as unknown as Request;
    await expect(controller.getPlatformBalance(req)).resolves.toEqual({ balance: 10000 });
    await controller.createPlatformWithdrawal(req, { amount: 10000 });
    await controller.updatePlatformBank(req, bank);
    expect(service.createPlatformWithdrawal).toHaveBeenCalledWith("finance-1", 10000);
    expect(service.updatePlatformBankAccount).toHaveBeenCalledWith("finance-1", bank);
  });
});
