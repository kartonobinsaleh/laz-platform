import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { PaginationMeta } from "@shared/types/api";

export function useTablePagination(defaultLimit = 10) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLimit = Number(searchParams.get("limit") ?? defaultLimit);
  const limit = [10, 20, 50, 100].includes(requestedLimit) ? requestedLimit : defaultLimit;
  const requestedPage = Number(searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 &&
    Number.isSafeInteger((requestedPage - 1) * limit) ? requestedPage : 1;

  return { page, limit, searchParams, setSearchParams };
}

export function useTablePaginationMeta(meta: PaginationMeta | undefined, page: number, limit: number) {
  const [, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  // Filters and approvals can remove the last row on the current page.
  useEffect(() => {
    if (meta && page > totalPages) {
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        next.set("page", String(totalPages));
        return next;
      }, { replace: true });
    }
  }, [meta, page, totalPages, setSearchParams]);

  return meta
    ? { currentPage: Math.min(meta.page, totalPages), totalPages, totalCount: meta.total, pageSize: meta.limit }
    : { currentPage: 1, totalPages: 1, totalCount: 0, pageSize: limit };
}
