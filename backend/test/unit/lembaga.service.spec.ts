import { beforeEach, describe, expect, it, vi } from "vitest";
import { LembagaService } from "../../src/modules/lembaga/lembaga.service";
import { AppError } from "../../src/common/errors/app.error";

describe("LembagaService.deleteLembaga", () => {
  const repository = {
    findById: vi.fn(),
    getDeletionDependencies: vi.fn(),
    delete: vi.fn(),
  };
  const auditService = { log: vi.fn() };

  const service = new LembagaService(
    repository as never,
    auditService as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue({
      id: "lembaga-1",
      name: "Yayasan Contoh",
      slug: "yayasan-contoh",
      status: "APPROVED",
    });
  });

  it("rejects deletion and lists the related data", async () => {
    repository.getDeletionDependencies.mockResolvedValue({
      programs: 1,
      donations: 2,
      distributions: 0,
      payments: 2,
      volunteerActivities: 0,
      volunteerApplications: 0,
      withdrawals: 1,
      journals: 0,
      amilPlatformChangeRequests: 0,
    });

    await expect(service.deleteLembaga("lembaga-1", "super-admin-1")).rejects.toMatchObject({
      code: "LEMBAGA_HAS_RELATED_DATA",
      message: expect.stringContaining("1 program, 2 donasi, 2 pembayaran, 1 penarikan dana"),
    } satisfies Partial<AppError>);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("deletes a lembaga that has no business data", async () => {
    repository.getDeletionDependencies.mockResolvedValue({
      programs: 0,
      donations: 0,
      distributions: 0,
      payments: 0,
      volunteerActivities: 0,
      volunteerApplications: 0,
      withdrawals: 0,
      journals: 0,
      amilPlatformChangeRequests: 0,
    });
    repository.delete.mockResolvedValue({
      id: "lembaga-1",
      name: "Yayasan Contoh",
      slug: "yayasan-contoh",
      status: "APPROVED",
    });

    await expect(service.deleteLembaga("lembaga-1", "super-admin-1")).resolves.toMatchObject({
      id: "lembaga-1",
    });
    expect(repository.delete).toHaveBeenCalledWith("lembaga-1");
    expect(auditService.log).toHaveBeenCalledOnce();
  });
});
