import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";
import { WithdrawalsController } from "../../src/modules/withdrawals/withdrawals.controller";
import { hasPermission } from "../../../shared/lib/permissions";
import { PERMISSIONS } from "../../../shared/constants/permissions";

describe("Withdrawal management access", () => {
  it.each(["approveWithdrawal", "rejectWithdrawal"] as const)("allows platform finance to use %s with the same permission as the UI", (action) => {
    const user = { roleName: "FINANCE_PLATFORM", permissions: [PERMISSIONS.WITHDRAWALS_MANAGE] };
    const context = {
      getHandler: () => WithdrawalsController.prototype[action],
      getClass: () => WithdrawalsController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    expect(hasPermission(user, PERMISSIONS.WITHDRAWALS_MANAGE)).toBe(true);
    expect(new PermissionsGuard(new Reflector()).canActivate(context)).toBe(true);
  });

  it.each(["approveWithdrawal", "rejectWithdrawal"] as const)("rejects read-only staff for %s", (action) => {
    const user = { roleName: "LEMBAGA_ADMIN", permissions: [PERMISSIONS.WITHDRAWALS_READ] };
    const context = {
      getHandler: () => WithdrawalsController.prototype[action],
      getClass: () => WithdrawalsController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    expect(hasPermission(user, PERMISSIONS.WITHDRAWALS_MANAGE)).toBe(false);
    expect(() => new PermissionsGuard(new Reflector()).canActivate(context)).toThrow("Akses ditolak");
  });
});
