import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req, Query, HttpCode } from "@nestjs/common";
import { WithdrawalsService } from "./withdrawals.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { AppError } from "../../common/errors/app.error";
import { Request } from "express";
import { PERMISSIONS } from "../../../../shared/constants/permissions";
import { isPlatformFinance } from "../../../../shared/lib/platform-finance";

@Controller("api/withdrawals")
@UseGuards(AuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) { }

  private requirePlatformFinance(req: Request) {
    if (!isPlatformFinance(req.user)) {
      throw new AppError("FORBIDDEN", "Penarikan platform hanya dapat diakses oleh Finance Platform.", 403);
    }
  }

  // ==========================================
  // INSTITUTION ENDPOINTS
  // ==========================================

  @Post()
  @RequirePermission("withdrawals.create")
  async createWithdrawal(@Req() req: Request, @Body() body: { amount: number; programId: string }) {
    const user = req.user!;
    // Must be part of a lembaga to request withdrawal
    if (!user.lembagaId) {
      throw new AppError("FORBIDDEN", "User does not belong to an institution.", 403);
    }

    return this.withdrawalsService.createWithdrawal(
      user.lembagaId,
      user.id,
      body.amount,
      body.programId,
    );
  }

  @Get("program-balances")
  @RequirePermission("withdrawals.read")
  async listProgramBalances(@Req() req: Request) {
    if (!req.user!.lembagaId) throw new AppError("FORBIDDEN", "User tidak memiliki Lembaga", 403);
    return this.withdrawalsService.listProgramBalances(req.user!.lembagaId);
  }

  @Get("bank-accounts")
  @RequirePermission("withdrawals.read")
  async listBankAccounts(@Req() req: Request) {
    if (!req.user!.lembagaId) throw new AppError("FORBIDDEN", "User tidak memiliki Lembaga", 403);
    return this.withdrawalsService.listBankAccounts(req.user!.lembagaId);
  }

  @Post("bank-accounts")
  @RequirePermission("withdrawals.create")
  async createBankAccount(@Req() req: Request, @Body() body: {
    bankCode: string; accountNumber: string; accountHolder: string; label?: string; isDefault?: boolean;
  }) {
    if (!req.user!.lembagaId) throw new AppError("FORBIDDEN", "User tidak memiliki Lembaga", 403);
    return this.withdrawalsService.createBankAccount(req.user!.lembagaId, body);
  }

  @Patch("bank-accounts/:id")
  @RequirePermission("withdrawals.create")
  async updateBankAccount(@Req() req: Request, @Param("id") id: string, @Body() body: {
    bankCode: string; accountNumber: string; accountHolder: string; label?: string; isDefault?: boolean;
  }) {
    if (!req.user!.lembagaId) throw new AppError("FORBIDDEN", "User tidak memiliki Lembaga", 403);
    return this.withdrawalsService.updateBankAccount(req.user!.lembagaId, id, body);
  }

  @Post("bank-accounts/:id/deactivate")
  @HttpCode(200)
  @RequirePermission("withdrawals.create")
  async deleteBankAccount(@Req() req: Request, @Param("id") id: string) {
    if (!req.user!.lembagaId) throw new AppError("FORBIDDEN", "User tidak memiliki Lembaga", 403);
    return this.withdrawalsService.deleteBankAccount(req.user!.lembagaId, id);
  }

  @Get("mine")
  @RequirePermission("withdrawals.read")
  async getMyWithdrawals(
    @Req() req: Request,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const user = req.user!;
    if (!user.lembagaId) {
      throw new AppError("FORBIDDEN", "User does not belong to an institution.", 403);
    }

    return this.withdrawalsService.getLembagaWithdrawals(
      user.lembagaId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  // ==========================================
  // PLATFORM FINANCE ENDPOINTS
  // ==========================================

  @Post("platform")
  @RequirePermission(PERMISSIONS.PLATFORM_WITHDRAWALS_CREATE)
  async createPlatformWithdrawal(@Req() req: Request, @Body() body: { amount: number }) {
    this.requirePlatformFinance(req);
    return this.withdrawalsService.createPlatformWithdrawal(req.user!.id, body.amount);
  }

  @Get("platform/balance")
  @RequirePermission(PERMISSIONS.PLATFORM_WITHDRAWALS_CREATE)
  async getPlatformBalance(@Req() req: Request) {
    this.requirePlatformFinance(req);
    return this.withdrawalsService.getPlatformBalance();
  }

  @Get("platform")
  @RequirePermission(PERMISSIONS.PLATFORM_WITHDRAWALS_CREATE)
  async getPlatformWithdrawals(
    @Req() req: Request,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    this.requirePlatformFinance(req);
    return this.withdrawalsService.getPlatformWithdrawals(
      page === undefined ? 1 : Number(page),
      limit === undefined ? 10 : Number(limit),
    );
  }

  @Patch("platform/bank")
  @RequirePermission(PERMISSIONS.PLATFORM_WITHDRAWALS_CREATE)
  async updatePlatformBank(
    @Req() req: Request,
    @Body() body: { bankCode: string; accountNumber: string; accountHolder: string },
  ) {
    this.requirePlatformFinance(req);
    return this.withdrawalsService.updatePlatformBankAccount(req.user!.id, body);
  }

  @Get()
  @RequirePermission(PERMISSIONS.WITHDRAWALS_READ_ALL)
  async getAllWithdrawals(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.withdrawalsService.getAllWithdrawals(
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get("payouts")
  @RequirePermission(PERMISSIONS.WITHDRAWALS_READ_ALL)
  async getAllPayouts(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.withdrawalsService.getAllPayouts(
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermission("withdrawals.manage")
  async approveWithdrawal(@Req() req: Request, @Param("id") id: string) {
    return this.withdrawalsService.approveWithdrawal(id, req.user!.id);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @RequirePermission("withdrawals.manage")
  async rejectWithdrawal(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { reason: string }
  ) {
    return this.withdrawalsService.rejectWithdrawal(id, req.user!.id, body.reason);
  }

  @Post(":id/retry-payout")
  @HttpCode(200)
  @RequirePermission("withdrawals.manage")
  async retryPayout(@Param("id") id: string) {
    return this.withdrawalsService.retryPayout(id);
  }
}
