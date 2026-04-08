/** Hook for portfolio CRUD operations and summary refresh. */

import { useMutation } from "@tanstack/react-query";
import { portfolioApi, getApiError } from "../utils/api";
import { usePortfolioContext } from "../context/PortfolioContext";

/**
 * Portfolio operations hook.
 * @returns {{addHolding: Function, removeHolding: Function, refresh: Function, loading: boolean, error: string}}
 */
export function usePortfolio() {
  const { refreshPortfolio } = usePortfolioContext();

  const addMutation = useMutation({ mutationFn: (payload) => portfolioApi.add(payload) });
  const removeMutation = useMutation({ mutationFn: (id) => portfolioApi.remove(id) });

  /**
   * Add a portfolio holding.
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async function addHolding(payload) {
    await addMutation.mutateAsync(payload);
    await refreshPortfolio();
  }

  /**
   * Remove holding by id.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function removeHolding(id) {
    await removeMutation.mutateAsync(id);
    await refreshPortfolio();
  }

  return {
    addHolding,
    removeHolding,
    refresh: refreshPortfolio,
    loading: addMutation.isPending || removeMutation.isPending,
    error: addMutation.error ? getApiError(addMutation.error) : removeMutation.error ? getApiError(removeMutation.error) : "",
  };
}
