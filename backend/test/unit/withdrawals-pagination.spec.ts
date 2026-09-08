import { describe, expect, it, vi } from "vitest";
import { WithdrawalsService } from "../../src/modules/withdrawals/withdrawals.service";
import { WithdrawalsController } from "../../src/modules/withdrawals/withdrawals.controller";

describe.each(["getAllWithdrawals", "getAllPayouts"] as const)("%s pagination", (method) => {
  function setup(total = 25) {
    const model = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(total) };
    const service = new WithdrawalsService({ withdrawal: model, payout: model } as any, {} as any, {} as any);
    return { model, service, controller: new WithdrawalsController(service) };
  }

  it("queries only the requested page and counts the same status filter", async () => {
    const { model, service } = setup();
    const result = await service[method]("PROCESSING", 2, 10);
    expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PROCESSING" }, skip: 10, take: 10,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
    expect(model.count).toHaveBeenCalledWith({ where: { status: "PROCESSING" } });
    expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it("uses a bounded default and handles an empty result without a filter", async () => {
    const { model, controller } = setup(0);
    const result = await controller[method]();
    expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, skip: 0, take: 20 }));
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
  });

  it("allows the maximum page size", async () => {
    const { model, service } = setup();
    await service[method](undefined, 2, 100);
    expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, take: 100 }));
  });

  it.each([
    ["0", "10"], ["-1", "10"], ["1", "101"], ["1", "0"], ["1", "-10"],
    ["abc", "10"], ["1.5", "10"], ["1", "Infinity"], ["1", "10abc"],
    ["", "10"], ["9007199254740991", "100"],
  ])("rejects invalid page/limit %s/%s before querying the database", async (page, limit) => {
    const { model, controller } = setup();
    await expect(controller[method](undefined, page, limit)).rejects.toMatchObject({ code: "INVALID_PAGINATION" });
    expect(model.findMany).not.toHaveBeenCalled();
    expect(model.count).not.toHaveBeenCalled();
  });
});
