/** Hook for fetching stock analysis payloads and handling loading/errors. */

import { useMutation } from "@tanstack/react-query";
import { analysisApi, getApiError } from "../utils/api";

/**
 * Custom hook for stock analysis.
 * @returns {{analyze: Function, data: any, loading: boolean, error: string}}
 */
export function useStockAnalysis() {
  const mutation = useMutation({
    mutationFn: (payload) => analysisApi.analyze(payload),
  });

  return {
    analyze: async (payload) => {
      const response = await mutation.mutateAsync(payload);
      return response.data;
    },
    data: mutation.data?.data || null,
    loading: mutation.isPending,
    error: mutation.error ? getApiError(mutation.error) : "",
  };
}
