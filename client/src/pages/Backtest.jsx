/** Backtest page for running strategy simulations and visualizing results. */

import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import SearchBar from "../components/shared/SearchBar";
import RiskDisclaimer from "../components/shared/RiskDisclaimer";
import { ChartSkeleton, TableSkeleton, CardSkeleton } from "../components/shared/Skeleton";
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Improved Header Card */}
      <div className="card relative overflow-hidden border-none bg-gradient-to-br from-surface via-[#0c1423] to-[#0b1d23]">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 opacity-5 pointer-events-none">
          <svg className="h-48 w-48 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Strategy Backtesting
          </h2>
          <p className="mt-2 text-sm text-white/60 max-w-xl leading-relaxed">
            Simulate quantitative trading strategies on historical price data. Evaluate total return, drawdown, and win rates before deploying real capital.
          </p>
        </div>
      </div>

      <form onSubmit={run} className="card relative z-40 space-y-5 border-white/5 backdrop-blur-md bg-white/[0.02]">

        <SearchBar onSelect={(item) => setForm((s) => ({ ...s, symbol: item.symbol }))} />

        <div className="grid gap-2 sm:grid-cols-3">
          {strategies.map((strategy) => (
            <button
              key={strategy.name}
              type="button"
              onClick={() => setForm((s) => ({ ...s, strategy: strategy.name }))}
              className={`rounded-xl border p-4 text-left transition-all duration-200 group ${
                form.strategy === strategy.name
                  ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(0,212,170,0.1)]"
                  : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`h-2 w-2 rounded-full ${form.strategy === strategy.name ? 'bg-primary' : 'bg-white/30 group-hover:bg-white/50'}`} />
                <p className={`font-semibold ${form.strategy === strategy.name ? 'text-primary' : 'text-white/80'}`}>
                  {strategy.name}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-white/50 pl-4">{strategy.description}</p>
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-white/70 tracking-wide uppercase">
            Target Symbol
            <input
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-mono text-white placeholder:text-white/30 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              value={form.symbol}
              placeholder="e.g. RELIANCE"
              onChange={(e) => setForm((s) => ({ ...s, symbol: e.target.value.toUpperCase() }))}
            />
          </label>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-wider text-white/50">Active Strategy</p>
            <p className="mt-0.5 text-sm font-semibold text-primary truncate">{form.strategy}</p>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-white/70 tracking-wide uppercase">
            Start Date
            <input type="date" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none transition-all" value={form.startDate} onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-white/70 tracking-wide uppercase">
            End Date
            <input type="date" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none transition-all" value={form.endDate} onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))} />
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end border-t border-white/10 pt-5 mt-2">
          <label className="flex w-full flex-col gap-1.5 text-xs font-medium text-white/70 tracking-wide uppercase sm:max-w-[260px]">
            Initial Capital (INR)
            <input type="number" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-mono text-white focus:border-primary/50 focus:outline-none transition-all" value={form.initialCapital} onChange={(e) => setForm((s) => ({ ...s, initialCapital: Number(e.target.value) }))} />
          </label>
          <button type="submit" disabled={loading || Boolean(validationError)} className="rounded-lg bg-primary hover:bg-primary/90 px-6 py-2.5 font-bold text-black shadow-[0_0_15px_rgba(0,212,170,0.3)] transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:h-[42px] ml-auto">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : "Run Simulation"}
          </button>
        </div>

        {validationError && <p className="text-xs text-rose-400 mt-2">{validationError}</p>}
      </form>

      {loading && (
        <div className="space-y-4 animate-pulse">
           <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
             {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
           </div>
           <ChartSkeleton />
           <TableSkeleton rows={4} />
        </div>
      )}
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
