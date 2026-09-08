import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { WithdrawalsService } from "../../src/modules/withdrawals/withdrawals.service";
import { WithdrawalsController } from "../../src/modules/withdrawals/withdrawals.controller";

describe("Platform withdrawal history", () => {
  function setup() {
    const withdrawal = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(25) };
    const service = new WithdrawalsService({ withdrawal } as any, {} as any, {} as any);
    return { withdrawal, service };
  }

  it("limits rows in the database and counts only platform withdrawals", async () => {
    const { withdrawal, service } = setup();
    const result = await service.getPlatformWithdrawals(2, 10);
    expect(withdrawal.findMany).toHaveBeenCalledWith({
      where: { isPlatform: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 10, take: 10,
    });
    expect(withdrawal.count).toHaveBeenCalledWith({ where: { isPlatform: true } });
    expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it.each([[0, 10], [1, 101], [1, 0], [NaN, 10], [1.5, 10], [1, Infinity]])("rejects invalid pagination %s/%s before querying", async (page, limit) => {
    const { withdrawal, service } = setup();
    await expect(service.getPlatformWithdrawals(page, limit)).rejects.toMatchObject({ code: "INVALID_PAGINATION" });
    expect(withdrawal.findMany).not.toHaveBeenCalled();
  });

  it("rejects Lembaga users and allows platform finance with default pagination", async () => {
    const service = { getPlatformWithdrawals: vi.fn().mockResolvedValue({ data: [] }) };
    const controller = new WithdrawalsController(service as unknown as WithdrawalsService);
    await expect(controller.getPlatformWithdrawals({ user: { roleName: "LEMBAGA_ADMIN", lembagaId: "l-1" } } as Request)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(service.getPlatformWithdrawals).not.toHaveBeenCalled();
    await controller.getPlatformWithdrawals({ user: { roleName: "FINANCE_PLATFORM", lembagaId: null } } as Request);
    expect(service.getPlatformWithdrawals).toHaveBeenCalledWith(1, 10);
  });
});
