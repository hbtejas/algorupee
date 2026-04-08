/** Portfolio context for centralizing holdings state and refresh logic. */

import { createContext, useContext, useMemo, useState } from "react";
import { portfolioApi, getApiError } from "../utils/api";

const PortfolioContext = createContext(null);

/**
 * Portfolio state provider.
 * @param {{children: import('react').ReactNode}} props
 * @returns {JSX.Element}
 */
export function PortfolioProvider({ children }) {
  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** Refresh portfolio summary from API. */
  async function refreshPortfolio() {
    setLoading(true);
    setError("");
    try {
      const { data } = await portfolioApi.summary();
      setSummary(data.summary);
      setHoldings(data.holdings || []);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const value = useMemo(
    () => ({ summary, holdings, loading, error, refreshPortfolio, setHoldings }),
    [summary, holdings, loading, error]
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

/**
 * Hook for portfolio context.
 * @returns {any}
 */
export function usePortfolioContext() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error("usePortfolioContext must be used within PortfolioProvider");
  }
  return ctx;
}
