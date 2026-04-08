import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SectorCard from "../components/sector/SectorCard";
import SectorCompareModal from "../components/sector/SectorCompareModal";
import SectorDetailPanel from "../components/sector/SectorDetailPanel";
import SectorHeatmap from "../components/sector/SectorHeatmap";
import SectorRotationChart from "../components/sector/SectorRotationChart";
import TopStocksTable from "../components/sector/TopStocksTable";
import { useRealtimeSectors } from "../hooks/useRealtimeSectors";
import { useRealtimeStocks } from "../hooks/useRealtimeStocks";
import { analysisApi, getApiError } from "../utils/api";

/**
 * Convert unknown error payloads into safe display text.
 * @param {any} value
 * @returns {string}
 */
function toDisplayError(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

/**
 * Dedicated sector analysis page.
 * @returns {JSX.Element}
 */
export default function SectorAnalysis() {
  const [params, setParams] = useSearchParams();
  const focusSector = params.get("focus") || "";

  const { sectors, loading, error, changedSectors, isMarketOpen, lastUpdated, autoRefresh, setAutoRefresh, refreshNow } = useRealtimeSectors();

  const [view, setView] = useState("overview");
  const [sortBy, setSortBy] = useState("rank");
  const [selectedSector, setSelectedSector] = useState("");
  const [rotationData, setRotationData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [compareSelection, setCompareSelection] = useState([]);
  const [comparison, setComparison] = useState({});
  const [compareOpen, setCompareOpen] = useState(false);
  const [pageError, setPageError] = useState("");
  const detailRef = useRef(null);
  const visibleError = toDisplayError(error || pageError);

  const { stocks, loading: stocksLoading } = useRealtimeStocks(selectedSector || focusSector, 10);

  const selectedSectorData = useMemo(() => {
    const name = selectedSector || focusSector;
    return sectors.find((s) => s?.sector_name === name) || sectors[0] || null;
  }, [selectedSector, focusSector, sectors]);

  const sortedSectors = useMemo(() => {
    const list = [...sectors];
    if (sortBy === "score") {
      list.sort((a, b) => Number(b?.composite_score || 0) - Number(a?.composite_score || 0));
    } else if (sortBy === "momentum") {
      list.sort((a, b) => Number(b?.momentum_score || 0) - Number(a?.momentum_score || 0));
    } else if (sortBy === "1m") {
      list.sort((a, b) => Number(b?.performance?.change_1m || 0) - Number(a?.performance?.change_1m || 0));
    } else {
      list.sort((a, b) => Number(a?.rank || 0) - Number(b?.rank || 0));
    }
    return list;
  }, [sectors, sortBy]);

  const derivedHeatmap = useMemo(
    () =>
      (sectors || []).map((item) => ({
        name: item?.sector_name,
        change_1d: Number(item?.performance?.change_1d || 0),
        change_1m: Number(item?.performance?.change_1m || 0),
        change_3m: Number(item?.performance?.change_3m || 0),
        signal: item?.signal,
        composite_score: Number(item?.composite_score || 0),
        market_cap_total: Number(item?.market_cap_total || 0),
        rotation_phase: item?.rotation_phase || "Neutral",
      })),
    [sectors]
  );

  const derivedRotation = useMemo(
    () =>
      (sectors || []).map((item) => ({
        name: item?.sector_name,
        x: Number(item?.momentum_score || 0),
        y: Number(item?.valuation_score || 0),
        size: Math.max(Number(item?.market_cap_total || 1), 1),
        signal: item?.signal || "HOLD",
        composite_score: Number(item?.composite_score || 0),
        breadth_score: Number(item?.breadth_score || 0),
      })),
    [sectors]
  );

  useEffect(() => {
    if (!selectedSector && focusSector) {
      setSelectedSector(focusSector);
      return;
    }
    if (!selectedSector && sectors.length) {
      setSelectedSector(sectors[0]?.sector_name || "");
    }
  }, [focusSector, selectedSector, sectors]);

  useEffect(() => {
    setHeatmapData(derivedHeatmap);
    setRotationData(derivedRotation);
  }, [derivedHeatmap, derivedRotation]);

  useEffect(() => {
    let active = true;

    async function refreshVisuals() {
      try {
        const [rotationResp, heatmapResp] = await Promise.all([analysisApi.sectorRotation(), analysisApi.sectorHeatmap()]);
        if (!active) return;

        const liveRotation = Array.isArray(rotationResp?.data?.rotation_data) ? rotationResp.data.rotation_data : [];
        const liveHeatmap = Array.isArray(heatmapResp?.data?.sectors) ? heatmapResp.data.sectors : [];

        if (liveRotation.length) {
          setRotationData(liveRotation);
        }
        if (liveHeatmap.length) {
          setHeatmapData(liveHeatmap);
        }
      } catch (err) {
        if (!active) return;
        const msg = String(getApiError(err) || "");
        if (!msg.toLowerCase().includes("route not found")) {
          setPageError(msg);
        }
      }
    }

    refreshVisuals();
    const timer = setInterval(refreshVisuals, 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  function openSectorDetails(name) {
    setSelectedSector(name);
    setView("overview");
    setPageError("");
    requestAnimationFrame(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function openSectorPage(name) {
    openSectorDetails(name);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("focus", name);
      next.set("view", "overview");
      return next;
    });
  }

  async function runCompare() {
    if (compareSelection.length < 2) {
      setPageError("Select at least 2 sectors to compare.");
      return;
    }
    try {
      setPageError("");
      const { data } = await analysisApi.sectorCompare(compareSelection);
      setComparison(data?.comparison || {});
      setCompareOpen(true);
    } catch (err) {
      setPageError(getApiError(err));
    }
  }

  function toggleCompare(name) {
    setCompareSelection((prev) => {
      if (prev.includes(name)) {
        return prev.filter((item) => item !== name);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, name];
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Sector Analysis</h1>
          <p className="text-xs text-white/60">
            Market: {isMarketOpen ? "Open" : "Closed"} | Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button type="button" onClick={refreshNow} className="rounded border border-white/20 px-2 py-1 hover:border-primary/60">
            Refresh
          </button>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[
          { id: "overview", label: "Overview" },
          { id: "heatmap", label: "Heatmap" },
          { id: "compare", label: "Compare" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`rounded border px-3 py-1 ${view === tab.id ? "border-primary text-primary" : "border-white/20 text-white/70"}`}
          >
            {tab.label}
          </button>
        ))}
        <select className="ml-auto rounded border border-white/20 bg-surface px-2 py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="rank">Sort: Rank</option>
          <option value="score">Sort: Score</option>
          <option value="momentum">Sort: Momentum</option>
          <option value="1m">Sort: 1M Return</option>
        </select>
      </div>

      {visibleError && <p className="text-sm text-sell">{visibleError}</p>}
      {loading && <p className="text-sm text-white/70">Loading sector data...</p>}

      {view === "overview" && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedSectors.map((sector) => (
              <SectorCard
                key={sector?.sector_name}
                sector={sector}
                changed={changedSectors.includes(sector?.sector_name)}
                onOpen={() => openSectorDetails(sector?.sector_name)}
                onOpenPage={() => openSectorPage(sector?.sector_name)}
              />
            ))}
          </div>

          <div ref={detailRef} className="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
            <div className="space-y-4">
              <SectorRotationChart data={rotationData} />
              <TopStocksTable stocks={stocks} loading={stocksLoading} title={`Top Stocks - ${selectedSectorData?.sector_name || "Sector"}`} />
            </div>
            <SectorDetailPanel sector={selectedSectorData} />
          </div>
        </>
      )}

      {view === "heatmap" && (
        <SectorHeatmap
          data={heatmapData}
          selected={selectedSectorData?.sector_name || ""}
          onSelect={(name) => {
            setSelectedSector(name);
            setView("overview");
          }}
        />
      )}

      {view === "compare" && (
        <div className="card">
          <p className="mb-2 text-sm font-semibold text-white/85">Select 2-4 sectors</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sortedSectors.map((sector) => {
              const checked = compareSelection.includes(sector?.sector_name);
              return (
                <label key={sector?.sector_name} className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-2 text-sm">
                  <input type="checkbox" checked={checked} onChange={() => toggleCompare(sector?.sector_name)} />
                  <span>{sector?.sector_name}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-3">
            <button type="button" onClick={runCompare} className="rounded border border-primary/60 px-3 py-1 text-sm text-primary hover:bg-primary/10">
              Compare Now
            </button>
          </div>
        </div>
      )}

      <SectorCompareModal open={compareOpen} onClose={() => setCompareOpen(false)} comparison={comparison} />
    </div>
  );
}
