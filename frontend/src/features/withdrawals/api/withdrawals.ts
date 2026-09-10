import { api } from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Withdrawal {
  id: string;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REVERSED";
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  rejectionReason?: string;
  createdAt: string;
  isPlatform: boolean;
  lembaga?: { name: string; slug: string };
  requestedBy?: { name: string; email: string };
  approvedBy?: { name: string; email: string };
  program?: { id: string; title: string; slug: string } | null;
}

export interface ProgramWithdrawalBalance {
  programId: string;
  balance: string;
  mustahiqBalance: string;
  amilBalance: string;
  reservedBalance: string;
  program: {
    id: string;
    title: string;
    slug: string;
    status: string;
  };
}

export interface LembagaBankAccount {
  id: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  label?: string | null;
  isDefault: boolean;
  isActive: boolean;
  chartOfAccount: { id: string; code: string; name: string };
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.get<LembagaBankAccount[]>("/withdrawals/bank-accounts")).data,
    refetchInterval: 15000,
  });
}

export interface PlatformBalance {
  id: string;
  balance: string;
  reservedBalance: string;
  bankCode?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
}

export function useProgramWithdrawalBalances() {
  return useQuery({
    queryKey: ["program-withdrawal-balances"],
    queryFn: async () => (
      await api.get<ProgramWithdrawalBalance[]>("/withdrawals/program-balances")
    ).data,
  });
}

export function useSaveBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<LembagaBankAccount> & {
      id?: string; bankCode: string; accountNumber: string; accountHolder: string;
      changeReason?: string;
    }) => id
      ? (await api.patch<BankAccountChangeRequest>(`/withdrawals/bank-accounts/${id}`, data)).data
      : (await api.post<LembagaBankAccount>("/withdrawals/bank-accounts", data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-changes"] });
      queryClient.invalidateQueries({ queryKey: ["coa"] });
      queryClient.invalidateQueries({ queryKey: ["lembaga-me"] });
    },
  });
}

export function useDeactivateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/withdrawals/bank-accounts/${id}/deactivate`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["coa"] });
      queryClient.invalidateQueries({ queryKey: ["lembaga-me"] });
    },
  });
}

export function useGetMyWithdrawals(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["my-withdrawals", page, limit],
    queryFn: async () => {
      const { data, meta } = await api.get<Withdrawal[]>("/withdrawals/mine", { page, limit });
      return { data, meta };
    },
  });
}

export type WithdrawalScope = "lembaga" | "platform";

export function useGetAllWithdrawals(scope: WithdrawalScope, status?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["all-withdrawals", "approval", scope, status, page, limit],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, meta } = await api.get<Withdrawal[]>("/withdrawals", { scope, status, page, limit });
      return { data, meta };
    },
  });
}

export function usePlatformWithdrawals(page = 1, limit = 10) {
  return useQuery({
    queryKey: ["all-withdrawals", "platform", page, limit],
    queryFn: () => api.get<Withdrawal[]>("/withdrawals/platform", { page, limit }),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function usePlatformBalance() {
  return useQuery({
    queryKey: ["platform-balance"],
    queryFn: async () => (await api.get<PlatformBalance>("/withdrawals/platform/balance")).data,
    refetchInterval: 15000,
  });
}

export function useSavePlatformBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { bankCode: string; accountNumber: string; accountHolder: string; changeReason?: string }) =>
      (await api.patch<PlatformBalance | BankAccountChangeRequest>("/withdrawals/platform/bank", data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-balance"] });
      queryClient.invalidateQueries({ queryKey: ["bank-changes"] });
    },
  });
}

export function useCreatePlatformWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) =>
      (await api.post<Withdrawal>("/withdrawals/platform", { amount })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-balance"] });
      queryClient.invalidateQueries({ queryKey: ["all-withdrawals"] });
    },
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, programId }: { amount: number; programId: string }) => {
      const { data } = await api.post("/withdrawals", { amount, programId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["program-withdrawal-balances"] });
      queryClient.invalidateQueries({ queryKey: ["lembaga-me"] });
    },
  });
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/withdrawals/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-withdrawals"] });
    },
  });
}

export function useRejectWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.post(`/withdrawals/${id}/reject`, { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-withdrawals"] });
    },
  });
}

export function useRetryPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/withdrawals/${id}/retry-payout`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-withdrawals"] });
    },
  });
}

export interface BankAccountChangeRequest {
  id: string;
  lembagaId: string | null;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  changeReason: string;
  previousBankCode: string;
  previousAccountNumber: string;
  previousAccountHolder: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  lembaga?: { name: string } | null;
  requestedBy?: { name: string | null };
  reviewedBy?: { name: string | null } | null;
}

export function useBankChanges(scope: "lembaga" | "platform" | "admin", page = 1, status?: string) {
  const path = scope === "admin" ? "/withdrawals/bank-changes"
    : scope === "platform" ? "/withdrawals/platform/bank-changes" : "/withdrawals/bank-changes/mine";
  return useQuery({
    queryKey: ["bank-changes", scope, page, status],
    queryFn: () => api.get<BankAccountChangeRequest[]>(path, { page, ...(status ? { status } : {}) }),
    refetchInterval: 15000,
  });
}

export function useReviewBankChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      (await api.post<BankAccountChangeRequest>(`/withdrawals/bank-changes/${id}/${approve ? "approve" : "reject"}`, { reason })).data,
    onSuccess: () => {
      for (const key of ["bank-changes", "bank-accounts", "platform-balance", "coa", "lembaga-me"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
