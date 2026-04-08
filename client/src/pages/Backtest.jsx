/** Backtest page for running strategy simulations and visualizing results. */

import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import SearchBar from "../components/shared/SearchBar";
import RiskDisclaimer from "../components/shared/RiskDisclaimer";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import { analysisApi, getApiError } from "../utils/api";
import { formatCurrency } from "../utils/formatters";

const strategies = [
  {
    name: "Score-Based",
    description: "Composite signal from RSI, MACD histogram, and trend crossover.",
  },
  {
    name: "RSI Mean Reversion",
    description: "Buy oversold RSI and trim when RSI turns overbought.",
  },
  {
    name: "MACD Crossover",
    description: "Follows momentum using MACD and signal line crossovers.",
  },
];

const rangePresets = [
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
];

/**
 * Backtest route component.
 * @returns {JSX.Element}
 */
export default function Backtest() {
  const [form, setForm] = useState({ symbol: "INFY", strategy: "Score-Based", startDate: "2024-01-01", endDate: "2025-12-31", initialCapital: 100000 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isScoreBased = form.strategy === "Score-Based";

  const selectedStrategy = useMemo(
    () => strategies.find((s) => s.name === form.strategy) || strategies[0],
    [form.strategy]
  );

  const chartData = useMemo(() => {
    if (!result) {
      return [];
    }

    const benchmarkByDate = new Map((result.benchmark_curve || []).map((p) => [p.date, p.benchmark_equity]));
    return (result.equity_curve || []).map((p) => ({
      ...p,
      benchmark_equity: benchmarkByDate.get(p.date) ?? null,
    }));
  }, [result]);

  const validationError = useMemo(() => {
    if (!form.symbol?.trim()) {
      return "Symbol is required.";
    }
    if (!form.startDate || !form.endDate) {
      return "Start and end dates are required.";
    }
    if (new Date(form.startDate) > new Date(form.endDate)) {
      return "Start date must be before end date.";
    }
    if (Number(form.initialCapital) <= 0) {
      return "Initial capital must be greater than zero.";
    }
    return "";
  }, [form]);

  /**
   * Apply date range preset.
   * @param {number} monthsBack
   */
  function applyRangePreset(monthsBack) {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - monthsBack);
    const toIsoDate = (d) => d.toISOString().slice(0, 10);
    setForm((s) => ({
      ...s,
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
    }));
  }

  /**
   * Submit backtest request.
   * @param {import('react').FormEvent} e
   */
  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await analysisApi.backtest(form);
      setResult(data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="card relative z-40 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Backtest Strategy</h2>
          <p className="text-sm text-white/60">Pick a stock, strategy, and time window to simulate performance.</p>
        </div>

        <SearchBar onSelect={(item) => setForm((s) => ({ ...s, symbol: item.symbol }))} />

        <div className="grid gap-2 sm:grid-cols-3">
          {strategies.map((strategy) => (
            <button
              key={strategy.name}
              type="button"
              onClick={() => setForm((s) => ({ ...s, strategy: strategy.name }))}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                form.strategy === strategy.name
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
              }`}
            >
              <p className="font-semibold">{strategy.name}</p>
              <p className="mt-1 text-xs text-white/60">{strategy.description}</p>
            </button>
          ))}
        </div>

        {isScoreBased && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-white/80">
            <p className="mb-1 font-semibold text-primary">Score-Based Logic</p>
            <p>Buy when at least 2 of 3 signals are bullish: RSI below 45, MACD histogram positive, Golden Cross active.</p>
            <p>Sell when all 3 signals are weak.</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Symbol
            <input
              className="rounded border border-white/20 bg-white/5 px-3 py-2 text-sm"
              value={form.symbol}
              onChange={(e) => setForm((s) => ({ ...s, symbol: e.target.value.toUpperCase() }))}
            />
          </label>
          <div className="rounded border border-white/15 bg-white/5 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/60">Selected Strategy</p>
            <p className="mt-1 text-sm font-semibold text-primary">{form.strategy}</p>
            <p className="mt-1 text-xs text-white/60">{selectedStrategy.description}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Start Date
            <input type="date" className="rounded border border-white/20 bg-white/5 px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            End Date
            <input type="date" className="rounded border border-white/20 bg-white/5 px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-white/60">Quick Range:</p>
          {rangePresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyRangePreset(preset.months)}
              className="rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/80 hover:border-primary hover:text-primary"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex w-full flex-col gap-1 text-xs text-white/70 sm:max-w-[260px]">
            Initial Capital
            <input type="number" className="rounded border border-white/20 bg-white/5 px-3 py-2 text-sm" value={form.initialCapital} onChange={(e) => setForm((s) => ({ ...s, initialCapital: Number(e.target.value) }))} />
          </label>
          <button type="submit" disabled={loading || Boolean(validationError)} className="rounded bg-primary px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60 sm:h-[42px]">
            {loading ? "Running..." : "Run Backtest"}
          </button>
        </div>

        {validationError && <p className="text-xs text-amber-300">{validationError}</p>}
      </form>

      {loading && <LoadingSpinner />}
      {error && <p className="text-sell">{error}</p>}

      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="card"><p className="text-xs text-white/60">Total Return</p><p className={`font-mono text-lg ${Number(result.total_return_pct || 0) >= 0 ? "text-buy" : "text-sell"}`}>{result.total_return_pct}%</p></div>
            <div className="card"><p className="text-xs text-white/60">Sharpe Ratio</p><p className="font-mono text-lg">{result.sharpe_ratio}</p></div>
            <div className="card"><p className="text-xs text-white/60">Max Drawdown</p><p className="font-mono text-lg">{result.max_drawdown_pct}%</p></div>
            <div className="card"><p className="text-xs text-white/60">Win Rate</p><p className="font-mono text-lg">{result.win_rate_pct}%</p></div>
          </div>

          {result.strategy === "Score-Based" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="card"><p className="text-xs text-white/60">Buy Signals</p><p className="font-mono text-lg text-buy">{result.signal_counts?.buy ?? 0}</p></div>
              <div className="card"><p className="text-xs text-white/60">Sell Signals</p><p className="font-mono text-lg text-sell">{result.signal_counts?.sell ?? 0}</p></div>
              <div className="card"><p className="text-xs text-white/60">Trades Executed</p><p className="font-mono text-lg">{result.trade_count ?? 0}</p></div>
              <div className="card"><p className="text-xs text-white/60">Final Equity</p><p className="font-mono text-lg">{formatCurrency(result.final_value || 0)}</p></div>
            </div>
          )}

          <div className="card h-[340px] sm:h-[380px]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/80">Equity Curve</h3>
              <div className="flex items-center gap-3 text-xs text-white/70">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Strategy</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#60A5FA]" /> Benchmark</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value), name === "equity" ? "Strategy" : "Benchmark"]}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{ background: "#0f1729", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 }}
                />
                <Line dataKey="equity" stroke="#00D4AA" dot={false} strokeWidth={2} />
                <Line dataKey="benchmark_equity" stroke="#60A5FA" dot={false} strokeDasharray="5 5" strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-x-auto">
            <h3 className="mb-2 text-sm font-semibold text-white/80">Trade Log</h3>
            <table className="min-w-[680px] w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 text-left text-xs uppercase tracking-wide text-white/60">
                  <th className="py-2">Entry Date</th><th className="py-2">Exit Date</th><th className="py-2">Entry</th><th className="py-2">Exit</th><th className="py-2">Qty</th><th className="py-2">PnL</th>
                </tr>
              </thead>
              <tbody>
                {(result.trades || []).map((t, idx) => (
                  <tr key={`${t.entry_date}-${idx}`} className="border-b border-white/10">
                    <td className="py-2">{t.entry_date}</td><td>{t.exit_date}</td><td>{formatCurrency(t.entry_price)}</td><td>{formatCurrency(t.exit_price)}</td><td>{t.quantity}</td><td className={t.pnl >= 0 ? "text-buy" : "text-sell"}>{formatCurrency(t.pnl)}</td>
                  </tr>
                ))}
                {(!result.trades || result.trades.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-white/60">No trades were generated for this setup. Try a different range or strategy.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RiskDisclaimer />
    </div>
  );
}
