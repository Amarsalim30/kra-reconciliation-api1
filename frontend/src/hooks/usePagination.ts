import { useState, useCallback, useEffect } from "react";
import { PaginatedResponse } from "@/types";

interface UsePaginationOptions {
  limit?: number;
  enabled?: boolean;
}

export function usePagination<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  options: UsePaginationOptions = {}
) {
  const { limit = 100, enabled = false } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const hasMore = page < totalPages && items.length < total;

  const loadNextPage = useCallback(async () => {
    if (isInitialLoading || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetchPage(nextPage, limit);
      setItems((prev) => [...prev, ...res.items]);
      setPage(res.page);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error("Failed to load next page:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isInitialLoading, isLoadingMore, hasMore, fetchPage, limit]);

  const reset = useCallback((initialItems: T[] = [], initialTotal = 0, initialTotalPages = 0) => {
    setItems(initialItems);
    setPage(1);
    setTotal(initialTotal);
    setTotalPages(initialTotalPages);
    setIsInitialLoading(false);
    setIsLoadingMore(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      const fetchInitial = async () => {
        setIsInitialLoading(true);
        try {
          const res = await fetchPage(1, limit);
          setItems(res.items);
          setPage(res.page);
          setTotal(res.total);
          setTotalPages(res.total_pages);
        } catch (err) {
          console.error("Failed to load initial page:", err);
        } finally {
          setIsInitialLoading(false);
        }
      };
      fetchInitial();
    }
  }, [enabled, fetchPage, limit]);

  return {
    items,
    setItems,
    page,
    total,
    totalItems: total,
    totalPages,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    loadNextPage,
    reset,
  };
}
