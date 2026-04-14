/** Stock analysis detail page with charts, scores, fundamentals, explainability, and sentiment. */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CandlestickChart from "../components/charts/CandlestickChart";
import RSIChart from "../components/charts/RSIChart";
import MACDChart from "../components/charts/MACDChart";
import VolumeChart from "../components/charts/VolumeChart";
import BollingerChart from "../components/charts/BollingerChart";
import ScoreGauge from "../components/dashboard/ScoreGauge";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import ScoreBreakdown from "../components/dashboard/ScoreBreakdown";
import ExplainabilityPanel from "../components/dashboard/ExplainabilityPanel";
import FundamentalsTable from "../components/dashboard/FundamentalsTable";
import SentimentFeed from "../components/dashboard/SentimentFeed";
import { ChartSkeleton, CardSkeleton } from "../components/shared/Skeleton";
import RiskDisclaimer from "../components/shared/RiskDisclaimer";
import { useStockAnalysis } from "../hooks/useStockAnalysis";
import { useWebSocket } from "../hooks/useWebSocket";
import { useHealth } from "../context/HealthContext";
import { useAuth } from "../context/AuthContext";
import { analysisApi, portfolioApi, alertsApi } from "../utils/api";
import { getApiError } from "../utils/api";
import { formatCurrency, formatPercent } from "../utils/formatters";

/**
 * Stock detail route.
 * @returns {JSX.Element}
 */
export default function StockDetail() {
  const { symbol } = useParams();
  const { online } = useHealth();
  const { isAuthenticated } = useAuth();
  const { analyze, loading, error } = useStockAnalysis();
  const { connected, subscribeScore } = useWebSocket();
  const [analysis, setAnalysis] = useState(null);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState("");
  const [sectorContext, setSectorContext] = useState(null);
  const [actionLoading, setActionLoading] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const badgeConfidenceRaw = Number(analysis?.recommendation?.confidence ?? analysis?.recommendation?.final_score ?? 50);
  const badgeConfidence = Math.max(0, Math.min(100, Number.isFinite(badgeConfidenceRaw) ? badgeConfidenceRaw : 50));

  useEffect(() => {
    let mounted = true;

    /** Load analysis for selected symbol. */
    async function load() {
      try {
        const data = await analyze({ symbol, forceRefresh: false });
        if (mounted) setAnalysis(data);
      } catch (_) {
        if (mounted) setAnalysis(null);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [symbol, analyze]);

  useEffect(() => {
    if (!connected || !symbol) {
      return () => {};
    }

    const unsubscribe = subscribeScore(symbol, (payload) => {
      if (!payload || String(payload.symbol || "").toUpperCase() !== String(symbol).toUpperCase()) {
        return;
      }

      setAnalysis((prev) => {
        if (!prev) return prev;
        const recommendation = payload.recommendation || prev.recommendation;
        const scores = payload.scores || prev.scores;
        return {
          ...prev,
          recommendation,
          scores,
        };
      });
    });

    return unsubscribe;
  }, [connected, symbol, subscribeScore]);

  useEffect(() => {
    let active = true;

    /** Poll realtime quote every 15s for live price display. */
    async function loadQuote() {
      try {
        const { data } = await analysisApi.quote(symbol);
        if (!active || !data) {
          return;
        }

        setAnalysis((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            current_price: Number(data.price || prev.current_price),
            technicals: {
              ...(prev.technicals || {}),
              ret_1d: Number.isFinite(Number(data.changePct)) ? Number(data.changePct) : prev.technicals?.ret_1d,
            },
          };
        });
        setQuoteUpdatedAt(data.updatedAt || new Date().toISOString());
      } catch (_) {
        return;
      }
    }

    loadQuote();
    const timer = setInterval(loadQuote, 15 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [symbol]);

  /** Add current stock to portfolio with valid payload for backend contract. */
  async function onAddPortfolio() {
    if (!analysis) {
      return;
    }
    setActionError("");
    setActionMessage("");
    setActionLoading("portfolio");
    try {
      await portfolioApi.add({
        symbol: String(symbol || "").toUpperCase(),
        quantity: 1,
        buyPrice: Number(analysis.current_price || 0),
        buyDate: new Date().toISOString().slice(0, 10),
      });
      setActionMessage("Added to portfolio.");
    } catch (err) {
      setActionError(getApiError(err));
    } finally {
      setActionLoading("");
    }
  }

  /** Create a default price-above alert for current symbol. */
  async function onCreateAlert() {
    if (!analysis) {
      return;
    }
    setActionError("");
    setActionMessage("");
    setActionLoading("alert");
    try {
      await alertsApi.create({
        symbol: String(symbol || "").toUpperCase(),
        type: "PRICE_ABOVE",
        threshold: Number(analysis.current_price || 0) * 1.05,
      });
      setActionMessage("Alert created.");
    } catch (err) {
      setActionError(getApiError(err));
    } finally {
      setActionLoading("");
    }
  }

  useEffect(() => {
    let active = true;

    async function loadSectorContext() {
      try {
        const { data } = await analysisApi.sectorLookup(symbol);
        if (!active) {
          return;
        }
        setSectorContext(data || null);
      } catch (_) {
        if (active) {
          setSectorContext(null);
        }
      }
    }

    loadSectorContext();
    return () => {
      active = false;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card h-24 flex items-center gap-4">
           <CardSkeleton />
        </div>
        <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }
  if (error) return (
    <div className="card border-sell/50 bg-sell/5 p-6 text-center">
      <p className="text-sell">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-4 rounded bg-primary px-4 py-2 text-sm font-semibold text-black">Retry</button>
    </div>
  );
  if (!analysis) return <p className="text-white/70">No analysis data available.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-mono text-lg text-primary">{analysis.symbol}</p>
            <p className="text-sm text-white/70">{analysis.company_name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAddPortfolio}
              disabled={!online || !isAuthenticated || actionLoading === "portfolio"}
              title={online ? (!isAuthenticated ? "Login required" : "") : "Backend offline"}
              className={`rounded border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 ${!online ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {actionLoading === "portfolio" ? "Adding..." : "+ Portfolio"}
            </button>
            <button
              onClick={onCreateAlert}
              disabled={!online || !isAuthenticated || actionLoading === "alert"}
              title={online ? (!isAuthenticated ? "Login required" : "") : "Backend offline"}
              className={`rounded border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10 ${!online ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {actionLoading === "alert" ? "Creating..." : "Set Alert"}
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl">{formatCurrency(analysis.current_price)}</p>
          <p className={`text-sm ${analysis.technicals?.ret_1d >= 0 ? "text-buy" : "text-sell"}`}>
            {formatPercent(analysis.technicals?.ret_1d || 0)}
          </p>
        </div>
        <div className="rounded bg-primary/20 px-3 py-1 text-primary">{analysis.recommendation?.action || "HOLD"} ({Math.round(badgeConfidence)}%)</div>
      </div>

      <p className="text-xs text-white/60">Live score feed: {connected ? "Connected" : "Disconnected"} (updates every 60s during 09:15-15:30 IST)</p>
      {actionMessage && <p className="text-xs text-buy">{actionMessage}</p>}
      {actionError && <p className="text-xs text-sell">{actionError}</p>}
      {quoteUpdatedAt && <p className="text-xs text-white/50">Realtime price updated: {new Date(quoteUpdatedAt).toLocaleTimeString()}</p>}

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <CandlestickChart data={analysis.chart_data} />
          <RSIChart data={analysis.chart_data} />
          <MACDChart data={analysis.chart_data} />
          <VolumeChart data={analysis.chart_data} />
          <BollingerChart data={analysis.chart_data} />
        </div>
        <div className="space-y-4">
          <ScoreGauge score={analysis.recommendation?.final_score} action={analysis.recommendation?.action} />
          <ScoreBreakdown scores={analysis.scores} />
          <RecommendationCard recommendation={analysis.recommendation} />
          {sectorContext && (
            <div className="card">
              <h3 className="mb-2 text-sm font-semibold text-white/80">Sector Context</h3>
              <p className="text-sm text-white/80">{sectorContext?.sector_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/65">
                <p>Sector Score</p>
                <p className="text-right font-mono">{Number(sectorContext?.sector_score || 0).toFixed(1)}</p>
                <p>Signal</p>
                <p className="text-right font-mono">{sectorContext?.sector_signal || "HOLD"}</p>
                <p>Rank in Sector</p>
                <p className="text-right font-mono">
                  #{Number(sectorContext?.stock_rank_in_sector || 0)} / {Number(sectorContext?.stocks_count || 0)}
                </p>
              </div>
              <Link to={`/sectors?focus=${encodeURIComponent(sectorContext?.sector_name || "")}`} className="mt-3 inline-block text-xs text-primary hover:underline">
                Explore Sector
              </Link>
            </div>
          )}
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold text-white/80">Prediction</h3>
            <p>7d: {analysis.prediction?.direction_7d?.prediction} ({Math.round((analysis.prediction?.direction_7d?.probability || 0) * 100)}%)</p>
            <p>30d: {analysis.prediction?.direction_30d?.prediction} ({Math.round((analysis.prediction?.direction_30d?.probability || 0) * 100)}%)</p>
            <p>Est. 7d Price: {formatCurrency(analysis.prediction?.predicted_price_7d || 0)}</p>
          </div>
        </div>
      </div>

      <FundamentalsTable fundamentals={analysis.fundamentals} />
      <ExplainabilityPanel explainability={analysis.explainability} />
      <SentimentFeed sentiment={analysis.sentiment} />
      <RiskDisclaimer />
    </div>
  );
}
