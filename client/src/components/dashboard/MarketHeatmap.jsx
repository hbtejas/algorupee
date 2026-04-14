/** Market heatmap panel for NIFTY 50 and SENSEX constituents. */

import { useEffect, useMemo, useRef, useState } from "react";
import { analysisApi, getApiError } from "../../utils/api";
import { CardSkeleton } from "../shared/Skeleton";

/**
 * Resolve card color based on percentage change.
 * @param {number} changePct
 * @returns {string}
 */
function heatmapCardColor(changePct) {
  if (changePct >= 2) return "border-emerald-300/70 bg-emerald-900/70";
  if (changePct > 0) return "border-emerald-300/45 bg-emerald-900/50";
  if (changePct <= -2) return "border-rose-300/70 bg-rose-900/70";
  if (changePct < 0) return "border-rose-300/45 bg-rose-900/50";
  return "border-slate-300/35 bg-slate-800/65";
}

/**
 * Accent bar class for trend direction.
 * @param {number} value
 * @returns {string}
 */
function trendAccentClass(value) {
  if (value > 0) return "bg-emerald-300/85";
  if (value < 0) return "bg-rose-300/85";
  return "bg-slate-300/75";
}

/**
 * Class for signed percentage text.
 * @param {number} value
 * @returns {string}
 */
function signedColorClass(value) {
  if (value > 0) return "text-emerald-200";
  if (value < 0) return "text-rose-200";
  return "text-slate-200";
}

/**
 * Heatmap section for dashboard.
 * @param {{ fullPage?: boolean }} props
 * @returns {JSX.Element}
 */
export default function MarketHeatmap({ fullPage = false }) {
  const [indexKey, setIndexKey] = useState("nifty50");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [heatmap, setHeatmap] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const inFlightRef = useRef(false);
  const heatmapRef = useRef(null);

  useEffect(() => {
    heatmapRef.current = heatmap;
  }, [heatmap]);

  useEffect(() => {
    let active = true;

    /** Load heatmap from API. */
    async function loadHeatmap() {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const initial = !heatmapRef.current;
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError("");
      try {
        const { data } = await analysisApi.marketHeatmap(indexKey);
        if (active) {
          setHeatmap(data);
          setLastSuccessAt(new Date().toISOString());
        }
      } catch (err) {
        if (active) {
          const raw = String(getApiError(err) || "");
          const normalized = raw.toLowerCase().includes("route not found") ? "Heatmap API route is not available right now." : raw;
          setError(normalized || "Failed to load heatmap");
        }
      } finally {
        inFlightRef.current = false;
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadHeatmap();
    const timer = setInterval(loadHeatmap, 15 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [indexKey]);

  const sorted = useMemo(() => {
    const rows = heatmap?.constituents || [];
    return [...rows].sort((a, b) => {
      const aUnavailable = String(a?.data_status || "") === "unavailable";
      const bUnavailable = String(b?.data_status || "") === "unavailable";
      if (aUnavailable !== bUnavailable) {
        return aUnavailable ? 1 : -1;
      }
      const aStale = String(a?.data_status || "") === "cached" || Boolean(a?.stale);
      const bStale = String(b?.data_status || "") === "cached" || Boolean(b?.stale);
      if (aStale !== bStale) {
        return aStale ? 1 : -1;
      }
      return Math.abs(Number(b.changePct || 0)) - Math.abs(Number(a.changePct || 0));
    });
  }, [heatmap]);

  const gainers = useMemo(() => {
    return [...sorted]
      .filter((r) => Number(r?.value || 0) > 0)
      .filter((r) => Number(r.changePct || 0) > 0)
      .sort((a, b) => Number(b.changePct || 0) - Number(a.changePct || 0))
      .slice(0, 8);
  }, [sorted]);

  const losers = useMemo(() => {
    return [...sorted]
      .filter((r) => Number(r?.value || 0) > 0)
      .filter((r) => Number(r.changePct || 0) < 0)
      .sort((a, b) => Number(a.changePct || 0) - Number(b.changePct || 0))
      .slice(0, 8);
  }, [sorted]);

  const summary = useMemo(() => {
    const rows = (heatmap?.constituents || []).filter((r) => Number(r?.value || 0) > 0);
    const adv = rows.filter((r) => Number(r.changePct || 0) > 0).length;
    const dec = rows.filter((r) => Number(r.changePct || 0) < 0).length;
    const flat = Math.max(rows.length - adv - dec, 0);
    const avg = rows.length ? rows.reduce((acc, row) => acc + Number(row.changePct || 0), 0) / rows.length : 0;
    return { adv, dec, flat, avg };
  }, [heatmap]);

  return (
    <div className="card border-white/15 bg-gradient-to-br from-surface via-[#0c1423] to-[#0b1d23]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Market Heatmap</h3>
          <p className="text-xs text-white/60">Live red/green index board for {indexKey === "sensex" ? "SENSEX" : "NIFTY 50"}</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="heatmap-index" className="text-xs text-white/60">
            Index
          </label>
          <select
            id="heatmap-index"
            value={indexKey}
            onChange={(e) => setIndexKey(e.target.value)}
            className="rounded border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85 outline-none focus:border-primary"
          >
            <option value="nifty50">NIFTY 50</option>
            <option value="sensex">SENSEX</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
      {!loading && refreshing && <p className="text-xs text-cyan-200/80">Refreshing live board...</p>}
      {error && (
        <div className="mb-3 rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {heatmap && (
        <>
          <p className="mb-2 text-xs text-white/50">
            {heatmap.indexName} • Updated {new Date(heatmap.updatedAt).toLocaleTimeString()}
          </p>
          {heatmap.coverage && (
            <p className="mb-1 text-xs text-cyan-200/90">
              Live coverage: {Number(heatmap.coverage.live || 0)}/{Number(heatmap.coverage.total || 0)} ({Number(heatmap.coverage.pct || 0).toFixed(0)}%)
            </p>
          )}
          {heatmap.coverage && (
            <p className="mb-2 text-[11px] text-white/60">
              Realtime ticks: {Number(heatmap.coverage.true_live || 0)} • Cached recovery: {Number(heatmap.coverage.cached || 0)} • Unavailable: {Number(heatmap.coverage.unavailable || 0)}
            </p>
          )}
          <p className={`mb-3 text-xs ${heatmap.stale ? "text-amber-300" : "text-emerald-300"}`}>
            {heatmap.stale ? "Using latest available market snapshot" : "Live market board with cached recovery for blocked symbols"}
          </p>
          <p className="mb-3 text-[11px] text-white/50">Auto-refresh: every 15 seconds</p>
          {lastSuccessAt && <p className="mb-3 text-[11px] text-white/50">Last successful sync: {new Date(lastSuccessAt).toLocaleTimeString()}</p>}

          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-2 text-center">
              <p className="text-[11px] text-emerald-100/80">Advancers</p>
              <p className="font-mono text-lg text-emerald-200">{summary.adv}</p>
            </div>
            <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-center">
              <p className="text-[11px] text-rose-100/80">Decliners</p>
              <p className="font-mono text-lg text-rose-200">{summary.dec}</p>
            </div>
            <div className="rounded-lg border border-slate-300/30 bg-slate-500/10 p-2 text-center">
              <p className="text-[11px] text-slate-100/80">Unchanged</p>
              <p className="font-mono text-lg text-slate-100">{summary.flat}</p>
            </div>
            <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 p-2 text-center">
              <p className="text-[11px] text-cyan-100/80">Avg Change</p>
              <p className={`font-mono text-lg ${summary.avg >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                {summary.avg >= 0 ? "+" : ""}
                {summary.avg.toFixed(2)}%
              </p>
            </div>
          </div>

          {!sorted.length && (
            <div className="mb-3 rounded border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              Real-time provider data is temporarily unavailable for this index. Please retry in a few seconds.
            </div>
          )}

          <div className={`${fullPage ? "grid gap-4 lg:grid-cols-2" : "mb-4 grid gap-4 md:grid-cols-2"}`}>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
              <p className="mb-2 text-xs font-semibold text-emerald-300">Top Gainers</p>
              <div className="space-y-1">
                {gainers.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-white/85">{item.symbol}</span>
                    <span className="font-mono text-emerald-300">+{Number(item.changePct || 0).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-red-400/20 bg-red-500/5 p-3">
              <p className="mb-2 text-xs font-semibold text-red-300">Top Losers</p>
              <div className="space-y-1">
                {losers.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-white/85">{item.symbol}</span>
                    <span className="font-mono text-red-300">{Number(item.changePct || 0).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2 text-[11px] text-white/60">
            <span className="rounded bg-red-500/20 px-2 py-1 text-red-200">Bearish</span>
            <span className="rounded bg-slate-500/20 px-2 py-1 text-slate-200">Neutral</span>
            <span className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-200">Bullish</span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.slice(0, fullPage ? sorted.length : 16).map((item) => {
              const changePct = Number(item.changePct || 0);
              return (
                <div
                  key={item.symbol}
                  className={`relative overflow-hidden rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm ${heatmapCardColor(changePct)}`}
                >
                  <span className={`absolute left-0 top-0 h-1 w-full ${trendAccentClass(changePct)}`} />
                  <p className="truncate pt-1 text-lg font-semibold text-white">{item.symbol}</p>
                  <p className="mt-1 text-xs text-white/80">Price: {Number(item.value || 0) > 0 ? Number(item.value || 0).toLocaleString("en-IN") : "--"}</p>
                  <p className={`mt-1 text-sm font-mono ${signedColorClass(changePct)}`}>
                    {changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
