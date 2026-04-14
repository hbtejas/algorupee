/** Collapsible fundamentals table for valuation and quality metrics. */

import { useState } from "react";

/**
 * Fundamentals table component.
 * @param {{fundamentals:any}} props
 * @returns {JSX.Element}
 */
export default function FundamentalsTable({ fundamentals }) {
  const [open, setOpen] = useState(true);

  const labelMap = {
    pe_ratio: "PE Ratio",
    forward_pe: "Forward PE",
    pb_ratio: "PB Ratio",
    roe: "ROE",
    roa: "ROA",
    debt_to_equity: "Debt to Equity",
    current_ratio: "Current Ratio",
    revenue_growth: "Revenue Growth",
    earnings_growth: "Earnings Growth",
    profit_margin: "Profit Margin",
    market_cap: "Market Cap",
    dividend_yield: "Dividend Yield",
    "52w_high": "52W High",
    "52w_low": "52W Low",
    beta: "Beta",
    sector: "Sector",
    industry: "Industry",
    website: "Website",
  };

  const percentKeys = new Set(["roe", "roa", "revenue_growth", "earnings_growth", "profit_margin", "dividend_yield"]);

  const businessModel = fundamentals?.business_model;
  const promoterHolding = fundamentals?.promoter_holding_pct;
  const institutionalHolding = fundamentals?.institutional_holding_pct;

  const tableEntries = Object.entries(fundamentals || {}).filter(
    ([key]) => !["business_model", "promoter_holding_pct", "institutional_holding_pct"].includes(key)
  );

  function formatValue(key, value) {
    if (value == null || value === "" || value === "Unknown") {
      return "-";
    }
    if (key === "market_cap") {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString("en-IN") : "-";
    }
    if (key === "website") {
      return String(value);
    }
    if (percentKeys.has(key)) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "-";
      const pct = n <= 1 ? n * 100 : n;
      return `${pct.toFixed(2)}%`;
    }
    if (typeof value === "number") {
      return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    }
    return String(value);
  }

  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="mb-3 flex w-full items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Fundamentals</h3>
        <span className="text-xs text-primary">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/60">Business Model</p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {businessModel || "Business model details are currently unavailable for this stock."}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/60">Ownership Snapshot</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded border border-primary/20 bg-primary/10 px-3 py-2">
                  <span className="text-white/70">Promoter/Insider Holding</span>
                  <span className="font-mono text-primary">
                    {promoterHolding == null ? "N/A" : `${Number(promoterHolding).toFixed(2)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border border-blue-400/20 bg-blue-500/10 px-3 py-2">
                  <span className="text-white/70">Institutional Holding</span>
                  <span className="font-mono text-blue-300">
                    {institutionalHolding == null ? "N/A" : `${Number(institutionalHolding).toFixed(2)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {tableEntries.length === 0 ? (
            <p className="text-sm text-white/60 py-4 text-center">No fundamental metrics available.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {tableEntries.map(([k, v]) => (
                    <tr key={k} className="border-b border-white/10">
                      <td className="py-2 text-white/70">{labelMap[k] || k}</td>
                      <td className="py-2 text-right font-mono">{formatValue(k, v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
