"""Flask routes for sector analysis and comparison."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request
from pytz import timezone

from data.sector_collector import SectorCollector
from features.sector_scorer import SectorScorer

sector_bp = Blueprint("sector", __name__, url_prefix="/api/sector")

collector = SectorCollector()
scorer = SectorScorer()
_last_overview_payload: Dict[str, Any] | None = None


def _market_open_ist() -> bool:
    """Return True when market is open in IST hours (Mon-Fri 09:15-15:30)."""
    now_ist = datetime.now(timezone("Asia/Kolkata"))
    if now_ist.weekday() >= 5:
        return False
    mins = now_ist.hour * 60 + now_ist.minute
    return 9 * 60 + 15 <= mins <= 15 * 60 + 30


def _normalize_sector_name(raw: str) -> str:
    """Normalize incoming sector string to configured sector key."""
    value = str(raw or "").strip()
    if not value:
        return value

    slug = value.replace("_", " ").replace("-", " ").lower()
    for sector_name in collector.SECTORS.keys():
        if sector_name.lower() == slug:
            return sector_name
        if sector_name.lower().replace("&", "and") == slug.replace("&", "and"):
            return sector_name
        if sector_name.lower().startswith(slug):
            return sector_name
    return value


def _all_sector_scores(force_refresh: bool = False) -> tuple[Dict[str, Dict[str, Any]], Dict[str, List[Dict[str, Any]]], Dict[str, Any], Dict[str, Dict[str, float]]]:
    """Collect all sector datasets and computed scores."""
    sector_stocks = collector.fetch_all_sectors(force_refresh=force_refresh)
    index_perf = collector.get_sector_index_performance(force_refresh=force_refresh)

    scores: Dict[str, Dict[str, Any]] = {}
    sector_caps: Dict[str, float] = {}
    for sector_name, stocks in sector_stocks.items():
        score_obj = scorer.score_sector(stocks=stocks, sector_name=sector_name)
        scores[sector_name] = score_obj
        sector_caps[sector_name] = float(score_obj.get("market_cap_total") or 0.0)

    flows = collector.get_fii_dii_sector_flows(sector_market_caps=sector_caps, force_refresh=force_refresh)
    for sector_name, score_obj in scores.items():
        phase = scorer.classify_rotation_phase(
            momentum_score=float(score_obj.get("momentum_score") or 0.0),
            breadth_score=float(score_obj.get("breadth_score") or 0.0),
        )
        score_obj["rotation_phase"] = phase
        score_obj["fund_flow"] = flows.get(sector_name, {"fii_net": 0.0, "dii_net": 0.0, "net": 0.0})

    return scores, sector_stocks, index_perf, flows


@sector_bp.get("/overview")
def overview() -> Any:
    """Return ranked sector overview with scores and market state."""
    global _last_overview_payload
    force_refresh = str(request.args.get("forceRefresh", "false")).lower() == "true"
    try:
        scores, _, index_perf, _ = _all_sector_scores(force_refresh=force_refresh)
        ranked = scorer.rank_sectors(scores)
        payload = {
            "sectors": ranked,
            "sector_indices": index_perf,
            "last_updated": datetime.now(timezone("Asia/Kolkata")).isoformat(),
            "market_open": _market_open_ist(),
        }
        _last_overview_payload = payload
        return jsonify(payload), 200
    except Exception:
        if _last_overview_payload:
            fallback = {**_last_overview_payload, "stale": True, "warning": "Using latest available sector snapshot"}
            return jsonify(fallback), 200
        return (
            jsonify(
                {
                    "sectors": [],
                    "sector_indices": {},
                    "last_updated": datetime.now(timezone("Asia/Kolkata")).isoformat(),
                    "market_open": _market_open_ist(),
                    "stale": True,
                    "warning": "Sector providers temporarily unavailable",
                }
            ),
            200,
        )


@sector_bp.get("/heatmap")
def heatmap() -> Any:
    """Return lightweight sector heatmap payload."""
    force_refresh = str(request.args.get("forceRefresh", "false")).lower() == "true"
    scores, _, _, _ = _all_sector_scores(force_refresh=force_refresh)

    heat = []
    for item in scorer.rank_sectors(scores):
        perf = item.get("performance") or {}
        heat.append(
            {
                "name": item.get("sector_name"),
                "change_1d": float(perf.get("change_1d") or 0.0),
                "change_1m": float(perf.get("change_1m") or 0.0),
                "change_3m": float(perf.get("change_3m") or 0.0),
                "signal": item.get("signal"),
                "composite_score": float(item.get("composite_score") or 0.0),
                "market_cap_total": float(item.get("market_cap_total") or 0.0),
                "rotation_phase": item.get("rotation_phase", "Neutral"),
            }
        )

    return jsonify({"sectors": heat}), 200


@sector_bp.get("/rotation")
def rotation() -> Any:
    """Return sector rotation bubble chart payload."""
    force_refresh = str(request.args.get("forceRefresh", "false")).lower() == "true"
    scores, _, _, _ = _all_sector_scores(force_refresh=force_refresh)
    return jsonify({"rotation_data": scorer.get_rotation_data(scores)}), 200


@sector_bp.get("/compare")
def compare() -> Any:
    """Compare 2-4 sectors side-by-side."""
    raw = str(request.args.get("sectors", "")).strip()
    if not raw:
        return jsonify({"error": "sectors query is required"}), 400

    selected = [_normalize_sector_name(x.strip()) for x in raw.split(",") if x.strip()]
    if len(selected) < 2 or len(selected) > 4:
        return jsonify({"error": "Select between 2 and 4 sectors"}), 400

    scores, stock_map, index_perf, _ = _all_sector_scores(force_refresh=False)
    comparison: Dict[str, Any] = {}
    for sector_name in selected:
        if sector_name not in scores:
            continue
        comparison[sector_name] = {
            **scores[sector_name],
            "stocks": stock_map.get(sector_name, []),
            "index": index_perf,
        }

    return jsonify({"comparison": comparison}), 200


@sector_bp.get("/<path:sector_name>")
def sector_detail(sector_name: str) -> Any:
    """Return detailed metrics for one sector including stock list."""
    normalized = _normalize_sector_name(sector_name)
    scores, stock_map, index_perf, _ = _all_sector_scores(force_refresh=False)
    if normalized not in scores:
        return jsonify({"error": f"Unknown sector: {sector_name}"}), 404

    return jsonify({"sector": scores[normalized], "stocks": stock_map.get(normalized, []), "index": index_perf}), 200


@sector_bp.get("/<path:sector_name>/top-stocks")
def top_stocks(sector_name: str) -> Any:
    """Return top N stocks in sector sorted by score/change/market cap/rsi."""
    normalized = _normalize_sector_name(sector_name)
    limit = int(request.args.get("limit", 5))
    sort_by = str(request.args.get("sort_by", "score")).strip().lower()

    _, stock_map, _, _ = _all_sector_scores(force_refresh=False)
    if normalized not in stock_map:
        return jsonify({"error": f"Unknown sector: {sector_name}"}), 404

    stocks = list(stock_map[normalized])
    key_map = {
        "score": "score",
        "change_1d": "change_1d",
        "market_cap": "market_cap",
        "rsi": "rsi",
        "pe": "pe_ratio",
    }
    key = key_map.get(sort_by, "score")
    stocks.sort(key=lambda row: float(row.get(key) or 0.0), reverse=True)
    return jsonify({"stocks": stocks[: max(1, min(limit, 50))]}), 200


@sector_bp.get("/lookup/<symbol>")
def lookup_symbol(symbol: str) -> Any:
    """Lookup sector context for a stock symbol."""
    target = str(symbol or "").strip().upper().replace(".NS", "").replace(".BO", "")
    scores, stock_map, _, _ = _all_sector_scores(force_refresh=False)

    for sector_name, stocks in stock_map.items():
        ranked = sorted(stocks, key=lambda row: float(row.get("score") or 0.0), reverse=True)
        for idx, item in enumerate(ranked, start=1):
            sym = str(item.get("symbol") or "").upper()
            if sym == target:
                sector_score = scores.get(sector_name, {})
                return (
                    jsonify(
                        {
                            "symbol": target,
                            "sector_name": sector_name,
                            "sector_score": sector_score.get("composite_score", 0),
                            "sector_signal": sector_score.get("signal", "HOLD"),
                            "sector_change_1m": (sector_score.get("performance") or {}).get("change_1m", 0),
                            "stock_rank_in_sector": idx,
                            "stocks_count": len(ranked),
                        }
                    ),
                    200,
                )

    return jsonify({"error": f"Sector context not found for {target}"}), 404


@sector_bp.post("/refresh")
def refresh() -> Any:
    """Force-refresh all sector caches."""
    scores, _, _, _ = _all_sector_scores(force_refresh=True)
    ranked = scorer.rank_sectors(scores)
    return jsonify({"ok": True, "sectors": ranked, "last_updated": datetime.now(timezone("Asia/Kolkata")).isoformat()}), 200
