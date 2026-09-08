/** Platform withdrawals are exclusive to platform finance, including for super admins. */
export function isPlatformFinance(user: { roleName?: string | null; lembagaId?: string | null } | null | undefined): boolean {
  return user?.roleName === "FINANCE_PLATFORM" && user.lembagaId === null;
}
