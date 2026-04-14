/** Dashboard page with search, overview strip, recent analyses, and trending cards. */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "../components/shared/SearchBar";
import RiskDisclaimer from "../components/shared/RiskDisclaimer";
import Skeleton, { ChartSkeleton, TableSkeleton, CardSkeleton } from "../components/shared/Skeleton";
import { useWebSocket } from "../hooks/useWebSocket";
import { analysisApi } from "../utils/api";

const trending = [
  { symbol: "INFY", score: 78 },
  { symbol: "TCS", score: 74 },
  { symbol: "RELIANCE", score: 69 },
  { symbol: "ICICIBANK", score: 81 },
  { symbol: "SBIN", score: 66 },
];

/**
 * Dashboard route component.
 * @returns {JSX.Element}
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { connected } = useWebSocket();
  const [marketOverview, setMarketOverview] = useState([]);
  const [marketUpdatedAt, setMarketUpdatedAt] = useState("");
  const [topSectors, setTopSectors] = useState([]);

  const bySymbol = new Map((marketOverview || []).map((item) => [String(item.symbol || "").toUpperCase(), item]));
  const homeIndices = [
    { symbol: "^NSEI", name: "NIFTY 50" },
    { symbol: "^BSESN", name: "SENSEX" },
  ].map((base) => {
    const live = bySymbol.get(base.symbol) || {};
    return {
      symbol: base.symbol,
      name: base.name,
      value: Number(live.value || 0),
      changePct: Number(live.changePct || 0),
      updatedAt: live.updatedAt || "",
      stale: Boolean(live.stale),
    };
  });

  useEffect(() => {
    let active = true;

    /** Load live market overview values. */
    async function loadOverview() {
      try {
        const { data } = await analysisApi.marketOverview();
        if (!active) {
          return;
        }
        setMarketOverview(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length) {
          setMarketUpdatedAt(data[0].updatedAt || new Date().toISOString());
        }
      } catch (_) {
        return;
      }
    }

    loadOverview();
    const timer = setInterval(loadOverview, 15 * 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSectorSummary() {
      try {
        const { data } = await analysisApi.sectorOverview();
        if (!active) return;
        const sectors = Array.isArray(data?.sectors) ? data.sectors : [];
        setTopSectors(sectors.slice(0, 3));
        setLoadingSectors(false);
      } catch (err) {
        setLoadingSectors(false);
      }
    }

    loadSectorSummary();
    const timer = setInterval(loadSectorSummary, 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="card relative z-40">
        <p className="mb-2 text-xs uppercase tracking-wider text-white/60">Search and Analyze</p>
        <SearchBar onSelect={(item) => navigate(`/stock/${item.symbol}`)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {loadingOverview ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          homeIndices.map((m) => (
            <div key={m.name} className="card">
              <p className="text-xs text-white/60">{m.name}</p>
              <p className="mt-1 font-mono text-xl">
                {m.value > 0 ? Number(m.value || 0).toLocaleString("en-IN") : "--"}
              </p>
              <p className={`text-sm ${Number(m.changePct || 0) >= 0 ? "text-buy" : "text-sell"}`}>
                {Number(m.changePct || 0) >= 0 ? "+" : ""}
                {Number(m.changePct || 0).toFixed(2)}%
              </p>
              {m.stale && <p className="mt-1 text-[11px] text-amber-300">Live feed delayed</p>}
            </div>
          ))
        )}
      </div>
      {marketUpdatedAt && !loadingOverview && <p className="text-xs text-white/50">Market data updated: {new Date(marketUpdatedAt).toLocaleTimeString()}</p>}

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">Sector Momentum Snapshot</p>
          <Link to="/sectors" className="text-xs text-primary hover:underline">
            Open Sector Analysis
          </Link>
        </div>
        {loadingSectors ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {topSectors.map((sector) => (
              <button
                key={sector?.sector_name}
                type="button"
                onClick={() => navigate(`/sectors?focus=${encodeURIComponent(sector?.sector_name || "")}`)}
                className="rounded border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-primary/50"
              >
                <p className="text-xs text-white/70">#{sector?.rank}</p>
                <p className="text-sm text-white">{sector?.sector_name}</p>
                <p className="font-mono text-primary">{Number(sector?.composite_score || 0).toFixed(1)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Recent Analyses</h3>
          <div className="space-y-2">
            {trending.slice(0, 5).map((s) => (
              <button
                key={s.symbol}
                type="button"
                className="flex w-full items-center justify-between rounded bg-white/5 px-3 py-2 hover:bg-white/10"
                onClick={() => navigate(`/stock/${s.symbol}`)}
              >
                <span className="font-mono text-primary">{s.symbol}</span>
                <span className="font-mono">{s.score}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Trending Quick Scores</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {trending.map((s) => (
              <div key={s.symbol} className="rounded border border-white/10 bg-white/5 p-3">
                <p className="font-mono text-primary">{s.symbol}</p>
                <p className="mt-1 text-xl font-bold">{s.score}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/60">Live channel: {connected ? "Connected" : "Offline"}</p>
        </div>
      </div>

      <RiskDisclaimer />
    </div>
  );
}
