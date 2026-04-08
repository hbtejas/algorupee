/** Protected portfolio page with holdings table, summary metrics, and allocation chart. */

import { useEffect } from "react";
import { useState } from "react";
import PortfolioChart from "../components/portfolio/PortfolioChart";
import PortfolioTable from "../components/portfolio/PortfolioTable";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import { usePortfolioContext } from "../context/PortfolioContext";
import { usePortfolio } from "../hooks/usePortfolio";
import { portfolioApi, getApiError } from "../utils/api";
import { formatCurrency, formatPercent } from "../utils/formatters";

/**
 * Portfolio route component.
 * @returns {JSX.Element}
 */
export default function Portfolio() {
  const { summary, holdings, loading, error } = usePortfolioContext();
  const { removeHolding, refresh } = usePortfolio();
  const [optimizer, setOptimizer] = useState(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  /** Run Modern Portfolio Theory optimization for held symbols. */
  async function runOptimizer() {
    setOptimizerLoading(true);
    setOptimizerError("");
    try {
      const { data } = await portfolioApi.optimize();
      setOptimizer(data);
    } catch (err) {
      setOptimizer(null);
      setOptimizerError(getApiError(err));
    } finally {
      setOptimizerLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {error && <p className="text-sell">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-xs text-white/60">Total Invested</p>
          <p className="value-text mt-1 text-xl">{formatCurrency(summary?.totalInvested || 0)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-white/60">Total Value</p>
          <p className="value-text mt-1 text-xl">{formatCurrency(summary?.totalValue || 0)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-white/60">Overall P&L</p>
          <p className={`value-text mt-1 text-xl ${(summary?.totalPnl || 0) >= 0 ? "text-buy" : "text-sell"}`}>
            {formatCurrency(summary?.totalPnl || 0)} ({formatPercent(summary?.totalPnlPct || 0)})
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PortfolioTable rows={holdings} onRemove={removeHolding} />
        <PortfolioChart rows={holdings} summary={summary} />
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white/80">Portfolio Optimizer</h3>
          <button type="button" onClick={runOptimizer} disabled={optimizerLoading} className="rounded bg-primary px-3 py-2 text-xs font-semibold text-black disabled:opacity-60">
            {optimizerLoading ? "Optimizing..." : "Run MPT Optimizer"}
          </button>
        </div>

        {optimizerError && <p className="text-sm text-sell">{optimizerError}</p>}

        {optimizer && (
          <>
            <div className="mb-3 grid gap-2 md:grid-cols-3 text-sm">
              <p>Expected Return: <span className="font-mono">{optimizer.expected_return_pct}%</span></p>
              <p>Volatility: <span className="font-mono">{optimizer.volatility_pct}%</span></p>
              <p>Sharpe Ratio: <span className="font-mono">{optimizer.sharpe_ratio}</span></p>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20 text-left text-xs uppercase tracking-wide text-white/60">
                    <th className="py-2">Symbol</th>
                    <th className="py-2">Suggested Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {(optimizer.recommendations || []).map((row) => (
                    <tr key={row.symbol} className="border-b border-white/10">
                      <td className="py-2 font-mono text-primary">{row.symbol}</td>
                      <td className="py-2 font-mono">{row.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
