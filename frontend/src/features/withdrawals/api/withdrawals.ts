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
  chartOfAccount: { id: string; code: string; name: string };
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.get<LembagaBankAccount[]>("/withdrawals/bank-accounts")).data,
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
    }) => id
      ? (await api.patch<LembagaBankAccount>(`/withdrawals/bank-accounts/${id}`, data)).data
      : (await api.post<LembagaBankAccount>("/withdrawals/bank-accounts", data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
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

export function useGetAllWithdrawals(status?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["all-withdrawals", status, page, limit],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, meta } = await api.get<Withdrawal[]>("/withdrawals", { status, page, limit });
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
  });
}

export function useSavePlatformBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { bankCode: string; accountNumber: string; accountHolder: string }) =>
      (await api.patch<PlatformBalance>("/withdrawals/platform/bank", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-balance"] }),
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
