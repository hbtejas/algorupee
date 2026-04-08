"""Sector scoring and ranking logic."""

from __future__ import annotations

from typing import Any, Dict, List


class SectorScorer:
    """Aggregate stock data into actionable sector analytics."""

    HISTORICAL_PE: Dict[str, float] = {
        "IT & Technology": 24.0,
        "Banking & Finance": 18.0,
        "FMCG & Consumer": 42.0,
        "Pharma & Healthcare": 28.0,
        "Auto & EV": 26.0,
        "Energy & Oil": 17.0,
        "Metals & Mining": 12.0,
        "Infrastructure & Real Estate": 25.0,
        "Chemicals & Specialty": 35.0,
        "Telecom & Media": 27.0,
        "Capital Goods": 33.0,
        "Retail & E-commerce": 58.0,
    }

    def _safe(self, value: Any, default: float = 0.0) -> float:
        """Convert numeric values safely."""
        try:
            if value is None:
                return default
            return float(value)
        except Exception:
            return default

    def _trend_from_scores(self, momentum: float, breadth_pct: float) -> str:
        """Map momentum and breadth to trend label."""
        if momentum >= 75 and breadth_pct >= 70:
            return "STRONG_UPTREND"
        if momentum >= 60 and breadth_pct >= 55:
            return "UPTREND"
        if momentum <= 35 and breadth_pct <= 35:
            return "STRONG_DOWNTREND"
        if momentum <= 45:
            return "DOWNTREND"
        return "NEUTRAL"

    def _signal_from_score(self, score: float) -> str:
        """Map score to signal."""
        if score >= 72:
            return "BUY"
        if score >= 52:
            return "HOLD"
        return "AVOID"

    def _weighted_perf(self, stocks: List[Dict[str, Any]], key: str) -> float:
        """Market-cap weighted performance for a period key."""
        total_cap = sum(max(self._safe(item.get("market_cap"), 0.0), 0.0) for item in stocks)
        if total_cap <= 0:
            vals = [self._safe(item.get(key), 0.0) for item in stocks]
            return sum(vals) / len(vals) if vals else 0.0

        weighted = 0.0
        for item in stocks:
            cap = max(self._safe(item.get("market_cap"), 0.0), 0.0)
            weighted += self._safe(item.get(key), 0.0) * (cap / total_cap)
        return weighted

    def generate_outlook(self, sector_name: str, scores: Dict[str, Any]) -> str:
        """Generate template-based sector outlook in 2-3 actionable sentences."""
        composite = self._safe(scores.get("composite_score"), 50)
        breadth = self._safe(scores.get("stocks_above_ma50_pct"), 0)
        avg_pe = self._safe(scores.get("avg_pe"), 0)
        hist = self._safe(self.HISTORICAL_PE.get(sector_name), 20)
        one_m = self._safe((scores.get("performance") or {}).get("change_1m"), 0)

        lines: List[str] = []
        if composite >= 75:
            lines.append(
                f"{sector_name} is showing strong bullish momentum with a composite score of {composite:.1f}/100."
            )
        elif composite >= 60:
            lines.append(
                f"{sector_name} remains constructive with a healthy composite score of {composite:.1f}/100."
            )
        elif composite >= 45:
            lines.append(
                f"{sector_name} is range-bound with mixed internal signals and a neutral score of {composite:.1f}/100."
            )
        else:
            lines.append(
                f"{sector_name} is under pressure with weak internal momentum and a low score of {composite:.1f}/100."
            )

        if breadth < 40:
            lines.append(
                f"Market breadth is weak with only {breadth:.1f}% stocks above MA50, suggesting sector fatigue."
            )
        elif breadth > 70:
            lines.append(
                f"Breadth is strong at {breadth:.1f}% above MA50, indicating broad participation."
            )
        else:
            lines.append(
                f"Breadth is moderate at {breadth:.1f}%, so stock selection remains important."
            )

        if avg_pe > 0 and hist > 0:
            if avg_pe > hist * 1.2:
                lines.append(f"Valuation appears stretched at {avg_pe:.1f}x PE versus historical {hist:.1f}x.")
            elif avg_pe < hist * 0.85:
                lines.append(f"Valuation is relatively attractive at {avg_pe:.1f}x PE versus historical {hist:.1f}x.")
            else:
                lines.append(f"Valuation is close to normal at {avg_pe:.1f}x PE; monitor earnings confirmation.")
        else:
            direction = "improving" if one_m >= 0 else "softening"
            lines.append(f"Recent one-month performance is {one_m:.2f}%, and momentum is {direction}.")

        return " ".join(lines[:3])

    def score_sector(self, stocks: List[Dict[str, Any]], sector_name: str = "Unknown") -> Dict[str, Any]:
        """Aggregate stock metrics to sector-level score object."""
        if not stocks:
            empty = {
                "sector_name": sector_name,
                "composite_score": 0.0,
                "momentum_score": 0.0,
                "breadth_score": 0.0,
                "valuation_score": 0.0,
                "strength_score": 0.0,
                "performance": {"change_1d": 0.0, "change_5d": 0.0, "change_1m": 0.0, "change_3m": 0.0, "ytd": 0.0},
                "market_cap_total": 0.0,
                "avg_pe": 0.0,
                "avg_pb": 0.0,
                "stocks_above_ma50": 0,
                "stocks_above_ma50_pct": 0.0,
                "stocks_count": 0,
                "top_gainer": {"symbol": "-", "name": "-", "change_1d": 0.0},
                "top_loser": {"symbol": "-", "name": "-", "change_1d": 0.0},
                "trend": "NEUTRAL",
                "signal": "HOLD",
                "outlook": "Sector data is currently limited. Monitor updates during market hours.",
            }
            return empty

        stocks_count = len(stocks)
        cap_total = sum(max(self._safe(s.get("market_cap"), 0.0), 0.0) for s in stocks)
        pe_values = [self._safe(s.get("pe_ratio"), 0.0) for s in stocks if self._safe(s.get("pe_ratio"), 0.0) > 0]
        pb_values = [self._safe(s.get("pb_ratio"), 0.0) for s in stocks if self._safe(s.get("pb_ratio"), 0.0) > 0]

        perf_1d = self._weighted_perf(stocks, "change_1d")
        perf_5d = self._weighted_perf(stocks, "change_5d")
        perf_1m = self._weighted_perf(stocks, "change_1m")
        perf_3m = self._weighted_perf(stocks, "change_3m")
        perf_ytd = self._weighted_perf(stocks, "ytd")

        above_ma50 = sum(1 for s in stocks if bool(s.get("above_ma50")))
        breadth_pct = (above_ma50 / stocks_count) * 100 if stocks_count else 0.0

        avg_rsi = sum(self._safe(s.get("rsi"), 50.0) for s in stocks) / stocks_count
        avg_vr = sum(self._safe(s.get("volume_ratio"), 1.0) for s in stocks) / stocks_count

        momentum_score = max(0.0, min(100.0, 50 + 1.6 * perf_1m + 1.1 * perf_3m))
        breadth_score = max(0.0, min(100.0, breadth_pct))

        historical_pe = self._safe(self.HISTORICAL_PE.get(sector_name), 20)
        avg_pe = (sum(pe_values) / len(pe_values)) if pe_values else 0.0
        if avg_pe > 0 and historical_pe > 0:
            valuation_score = max(0.0, min(100.0, 100 - ((avg_pe / historical_pe) - 1) * 60))
        else:
            valuation_score = 55.0

        strength_score = max(0.0, min(100.0, (avg_rsi * 0.55) + (min(avg_vr, 2.5) / 2.5 * 45)))

        composite = (
            momentum_score * 0.35
            + breadth_score * 0.25
            + valuation_score * 0.20
            + strength_score * 0.20
        )

        ranked = sorted(stocks, key=lambda s: self._safe(s.get("change_1d"), 0.0), reverse=True)
        gainer = ranked[0]
        loser = ranked[-1]

        score_obj = {
            "sector_name": sector_name,
            "composite_score": round(composite, 2),
            "momentum_score": round(momentum_score, 2),
            "breadth_score": round(breadth_score, 2),
            "valuation_score": round(valuation_score, 2),
            "strength_score": round(strength_score, 2),
            "performance": {
                "change_1d": round(perf_1d, 2),
                "change_5d": round(perf_5d, 2),
                "change_1m": round(perf_1m, 2),
                "change_3m": round(perf_3m, 2),
                "ytd": round(perf_ytd, 2),
            },
            "market_cap_total": round(cap_total, 2),
            "avg_pe": round(avg_pe, 2) if avg_pe > 0 else 0.0,
            "avg_pb": round((sum(pb_values) / len(pb_values)), 2) if pb_values else 0.0,
            "stocks_above_ma50": above_ma50,
            "stocks_above_ma50_pct": round(breadth_pct, 2),
            "stocks_count": stocks_count,
            "top_gainer": {
                "symbol": gainer.get("symbol", "-"),
                "name": gainer.get("name", "-"),
                "change_1d": round(self._safe(gainer.get("change_1d"), 0.0), 2),
            },
            "top_loser": {
                "symbol": loser.get("symbol", "-"),
                "name": loser.get("name", "-"),
                "change_1d": round(self._safe(loser.get("change_1d"), 0.0), 2),
            },
        }

        score_obj["trend"] = self._trend_from_scores(momentum_score, breadth_pct)
        score_obj["signal"] = self._signal_from_score(composite)
        score_obj["outlook"] = self.generate_outlook(sector_name, score_obj)
        return score_obj

    def rank_sectors(self, all_sector_scores: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort sectors by composite score descending and include rank."""
        items = list(all_sector_scores.values())
        items.sort(key=lambda s: self._safe(s.get("composite_score"), 0.0), reverse=True)
        ranked: List[Dict[str, Any]] = []
        for idx, item in enumerate(items, start=1):
            copy = dict(item)
            copy["rank"] = idx
            ranked.append(copy)
        return ranked

    def get_rotation_data(self, all_sector_scores: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build rotation bubble plot payload."""
        out: List[Dict[str, Any]] = []
        for sector in all_sector_scores.values():
            out.append(
                {
                    "name": sector.get("sector_name"),
                    "x": self._safe(sector.get("momentum_score"), 0.0),
                    "y": self._safe(sector.get("valuation_score"), 0.0),
                    "size": max(self._safe(sector.get("market_cap_total"), 1.0), 1.0),
                    "signal": sector.get("signal", "HOLD"),
                    "composite_score": self._safe(sector.get("composite_score"), 0.0),
                    "breadth_score": self._safe(sector.get("breadth_score"), 0.0),
                }
            )
        return out

    def classify_rotation_phase(self, momentum_score: float, breadth_score: float) -> str:
        """Classify sector rotation phase from momentum and breadth."""
        if momentum_score >= 60 and breadth_score >= 60:
            return "Expansion"
        if momentum_score >= 50 and breadth_score < 60:
            return "Recovery"
        if momentum_score < 50 and breadth_score >= 45:
            return "Slowdown"
        return "Recession"
