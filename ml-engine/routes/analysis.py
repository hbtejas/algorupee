"""Flask routes for stock analysis and price history/search endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request
import pandas as pd
import requests
import yfinance as yf

from data.collector import DataManager
from data.indian_stocks import INDIAN_STOCK_UNIVERSE
from features.engineer import (
    FundamentalScorer,
    RecommendationEngine,
    SentimentAnalyzer,
    TechnicalAnalyzer,
    VolumeTrendScorer,
)
from models.predictor import StockPredictor

analysis_bp = Blueprint("analysis", __name__, url_prefix="/api/analysis")


data_manager = DataManager()
technical_analyzer = TechnicalAnalyzer()
fundamental_scorer = FundamentalScorer()
sentiment_analyzer = SentimentAnalyzer()
volume_scorer = VolumeTrendScorer()
recommendation_engine = RecommendationEngine()
predictor = StockPredictor()


DEFAULT_SEARCH_RESULTS: List[Dict[str, str]] = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Limited", "exchange": "NSE", "sector": "Energy"},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "exchange": "NSE", "sector": "Technology"},
    {"symbol": "INFY", "name": "Infosys Limited", "exchange": "NSE", "sector": "Technology"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Limited", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Limited", "exchange": "NSE", "sector": "Financial Services"},
]


def _norm(value: str) -> str:
    """Normalize text for search matching."""
    return "".join(ch for ch in str(value or "").upper() if ch.isalnum())


def _score_match(query: str, item: Dict[str, Any]) -> int:
    """Return ranking score for stock search result."""
    symbol = _norm(item.get("symbol", ""))
    name = _norm(item.get("name", ""))
    if not query:
        return 1
    if symbol == query:
        return 120
    if name == query:
        return 115
    if symbol.startswith(query):
        return 100
    if name.startswith(query):
        return 90
    if query in symbol:
        return 70
    if query in name:
        return 60
    words = name.split()
    if any(word.startswith(query) for word in words):
        return 55
    return 0


def _rank_local_matches(query: str, limit: int = 40) -> List[Dict[str, Any]]:
    """Return ranked search results from local Indian stock universe."""
    normalized_query = _norm(query)
    if not normalized_query:
        return INDIAN_STOCK_UNIVERSE[:limit]

    scored = []
    for item in INDIAN_STOCK_UNIVERSE:
        score = _score_match(normalized_query, item)
        if score > 0:
            scored.append((score, item))

    scored.sort(key=lambda pair: (-pair[0], pair[1]["symbol"]))
    return [item for _, item in scored[:limit]]


def _normalize_symbol_for_yahoo(symbol: str) -> str:
    """Normalize stock symbols for Indian market Yahoo tickers."""
    s = str(symbol or "").strip().upper()
    if not s:
        return s
    if s.startswith("^"):
        return s
    if "." in s:
        return s
    return f"{s}.NS"


def _safe_number(value: Any, default: float = 0.0) -> float:
    """Convert numeric values safely."""
    try:
        return float(value)
    except Exception:
        return default


def _period_rows(period: str) -> int:
    """Map period string to approximate business-day rows."""
    mapping = {
        "1mo": 22,
        "3mo": 66,
        "6mo": 132,
        "1y": 252,
        "2y": 504,
        "5y": 1260,
    }
    key = str(period or "1y").strip().lower()
    return max(22, mapping.get(key, 252))


def _synthetic_history_df(price: float, rows: int = 252) -> pd.DataFrame:
    """Build fallback OHLCV frame with flat price to keep charts/indicators functional."""
    p = max(_safe_number(price, 0.01), 0.01)
    idx = pd.date_range(end=pd.Timestamp.utcnow().tz_localize(None), periods=max(rows, 22), freq="B")
    return pd.DataFrame(
        {
            "Open": [p] * len(idx),
            "High": [p] * len(idx),
            "Low": [p] * len(idx),
            "Close": [p] * len(idx),
            "Volume": [0] * len(idx),
        },
        index=idx,
    )


def _fallback_price_df(symbol: str, period: str = "1y") -> pd.DataFrame:
    """Create best-effort fallback price frame using realtime quote/fundamentals/cache."""
    price = 0.0

    quote = _fetch_realtime_quote(symbol)
    if quote:
        price = _safe_number(quote.get("price"), 0.0)

    if price <= 0:
        try:
            fundamentals = data_manager.yahoo.get_fundamentals(symbol)
            price = _safe_number(fundamentals.get("current_price"), 0.0)
        except Exception:
            price = 0.0

    if price <= 0:
        try:
            cached = data_manager.cache.get(f"all::{symbol.upper()}")
            if cached and isinstance(cached, tuple) and len(cached) >= 1:
                cached_df = cached[0]
                if cached_df is not None and not cached_df.empty:
                    price = _safe_number(cached_df.iloc[-1]["Close"], 0.0)
        except Exception:
            price = 0.0

    if price <= 0:
        price = 0.01

    return _synthetic_history_df(price=price, rows=_period_rows(period))


def _fetch_realtime_quote(symbol: str) -> Dict[str, Any] | None:
    """Fetch realtime quote using yfinance with intraday fallback."""
    ticker_symbol = _normalize_symbol_for_yahoo(symbol)
    if not ticker_symbol:
        return None

    try:
        ticker = yf.Ticker(ticker_symbol)
        fast = getattr(ticker, "fast_info", {}) or {}
        info = ticker.info or {}

        price = _safe_number(fast.get("last_price") or info.get("currentPrice") or info.get("regularMarketPrice"), 0.0)
        prev_close = _safe_number(
            fast.get("previous_close") or info.get("previousClose") or info.get("regularMarketPreviousClose"),
            0.0,
        )

        if price <= 0:
            intraday = ticker.history(period="1d", interval="1m", auto_adjust=False)
            if intraday is not None and not intraday.empty:
                price = _safe_number(intraday.iloc[-1]["Close"], 0.0)

        if prev_close <= 0:
            hist = ticker.history(period="5d", interval="1d", auto_adjust=False)
            if hist is not None and len(hist) >= 2:
                prev_close = _safe_number(hist.iloc[-2]["Close"], 0.0)
            elif hist is not None and len(hist) == 1:
                prev_close = _safe_number(hist.iloc[-1]["Close"], 0.0)

        if price <= 0:
            return None

        change = price - prev_close if prev_close > 0 else 0.0
        change_pct = (change / prev_close * 100) if prev_close > 0 else 0.0

        market_symbol = ticker_symbol
        base_symbol = market_symbol.replace(".NS", "").replace(".BO", "")
        exchange = "BSE" if market_symbol.endswith(".BO") else "NSE"

        return {
            "inputSymbol": str(symbol or "").upper(),
            "symbol": base_symbol,
            "exchange": exchange,
            "marketSymbol": market_symbol,
            "price": round(price, 2),
            "change": round(change, 2),
            "changePct": round(change_pct, 4),
            "previousClose": round(prev_close, 2),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "yfinance",
        }
    except Exception:
        return None


def _article_sort_key(article: Dict[str, Any]) -> datetime:
    """Return sortable datetime for article recency ordering."""
    raw = str(article.get("published_at", "") or "").strip()
    if not raw:
        return datetime.min.replace(tzinfo=timezone.utc)

    try:
        if raw.endswith("Z"):
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return datetime.fromisoformat(raw)
    except Exception:
        try:
            return parsedate_to_datetime(raw)
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)


@analysis_bp.route("/analyze", methods=["POST"])
def analyze_stock():
    """Analyze stock and return complete AI-based recommendation payload."""
    try:
        body = request.get_json(silent=True) or {}
        symbol = str(body.get("symbol", "")).strip().upper()
        force_refresh = bool(body.get("forceRefresh", False))

        if not symbol:
            return jsonify({"error": "symbol is required"}), 400

        price_df, fundamentals, news_list = data_manager.get_all_data(symbol=symbol, force_refresh=force_refresh)
        if price_df.empty:
            price_df = _fallback_price_df(symbol=symbol, period="2y")
            if fundamentals.get("current_price") in (None, 0, 0.0):
                fundamentals["current_price"] = float(price_df.iloc[-1]["Close"])

        technical_result = technical_analyzer.analyze(price_df)
        fundamental_result = fundamental_scorer.score(fundamentals)
        sentiment_result = sentiment_analyzer.analyze(news_list)
        volume_result = volume_scorer.score(technical_result["feature_frame"])

        current_price = float(fundamentals.get("current_price") or price_df.iloc[-1]["Close"])
        prediction = predictor.predict(
            feature_frame=technical_result["feature_frame"],
            fundamentals=fundamentals,
            current_price=current_price,
        )

        final_score = recommendation_engine.final_score(
            fundamental_score=float(fundamental_result["fundamental_score"]),
            technical_score=float(technical_result["technical_score"]),
            sentiment_score=float(sentiment_result["sentiment_score"]),
            volume_score=float(volume_result["volume_score"]),
        )

        action, risk_level = recommendation_engine.recommendation(final_score)
        explainability = recommendation_engine.explainability(
            symbol=symbol,
            fundamentals=fundamentals,
            technicals=technical_result["technicals"],
            sentiment=sentiment_result,
        )

        response = {
            "symbol": symbol,
            "company_name": fundamentals.get("company_name", symbol),
            "current_price": round(current_price, 2),
            "currency": fundamentals.get("currency", "INR"),
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            "recommendation": {
                "action": action,
                "final_score": final_score,
                "confidence": int(round(final_score)),
                "risk_level": risk_level,
            },
            "scores": {
                "fundamental": {"score": fundamental_result["fundamental_score"], "weight": 0.4},
                "technical": {"score": technical_result["technical_score"], "weight": 0.3},
                "sentiment": {"score": sentiment_result["sentiment_score"], "weight": 0.2},
                "volume": {"score": volume_result["volume_score"], "weight": 0.1},
            },
            "prediction": {
                "direction_7d": prediction["direction_7d"],
                "direction_30d": prediction["direction_30d"],
                "predicted_price_7d": prediction["predicted_price_7d"],
                "price_change_pct_7d": prediction["price_change_pct_7d"],
                "confidence": prediction["confidence"],
            },
            "technicals": technical_result["technicals"],
            "fundamentals": {
                "pe_ratio": fundamentals.get("pe_ratio"),
                "forward_pe": fundamentals.get("forward_pe"),
                "pb_ratio": fundamentals.get("pb_ratio"),
                "roe": fundamentals.get("roe"),
                "roa": fundamentals.get("roa"),
                "debt_to_equity": fundamentals.get("debt_to_equity"),
                "current_ratio": fundamentals.get("current_ratio"),
                "revenue_growth": fundamentals.get("revenue_growth"),
                "earnings_growth": fundamentals.get("earnings_growth"),
                "profit_margin": fundamentals.get("profit_margin"),
                "market_cap": fundamentals.get("market_cap"),
                "dividend_yield": fundamentals.get("dividend_yield"),
                "52w_high": fundamentals.get("52w_high"),
                "52w_low": fundamentals.get("52w_low"),
                "beta": fundamentals.get("beta"),
                "sector": fundamentals.get("sector"),
                "industry": fundamentals.get("industry"),
                "business_model": fundamentals.get("business_model"),
                "promoter_holding_pct": fundamentals.get("promoter_holding_pct"),
                "institutional_holding_pct": fundamentals.get("institutional_holding_pct"),
                "website": fundamentals.get("website"),
            },
            "sentiment": {
                "score": sentiment_result["sentiment_score"],
                "label": sentiment_result["label"],
                "article_count": len(sentiment_result["article_sentiments"]),
                "recent_articles": sorted(
                    sentiment_result["article_sentiments"],
                    key=_article_sort_key,
                    reverse=True,
                )[:20],
            },
            "explainability": explainability,
            "chart_data": technical_result["chart_data"],
        }

        return jsonify(response), 200
    except Exception as exc:
        return jsonify({"error": f"analyze failed: {exc}"}), 500


@analysis_bp.route("/price-history/<symbol>", methods=["GET"])
def price_history(symbol: str):
    """Return chart-friendly price history with indicators."""
    try:
        period = request.args.get("period", "1y")
        data = data_manager.yahoo.get_historical_data(symbol=symbol, period=period)
        if data.empty:
            data = _fallback_price_df(symbol=symbol, period=period)
            technical_result = technical_analyzer.analyze(data)
            return jsonify({"symbol": symbol.upper(), "chart_data": technical_result["chart_data"], "stale": True, "warning": "Using synthetic history fallback"}), 200

        technical_result = technical_analyzer.analyze(data)
        return jsonify({"symbol": symbol.upper(), "chart_data": technical_result["chart_data"]}), 200
    except Exception as exc:
        return jsonify({"error": f"price history failed: {exc}"}), 500


@analysis_bp.route("/search", methods=["GET"])
def search():
    """Search Indian market stocks using Yahoo Finance discovery API."""
    try:
        q = str(request.args.get("q", "")).strip().lower()
        local_results = _rank_local_matches(q, limit=50)
        if not q:
            return jsonify(local_results or DEFAULT_SEARCH_RESULTS), 200

        query_symbol = "".join(ch for ch in q.upper() if ch.isalnum())

        response = requests.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={
                "q": q,
                "quotesCount": 30,
                "newsCount": 0,
                "lang": "en-IN",
                "region": "IN",
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json() or {}
        quotes = payload.get("quotes", [])

        results: List[Dict[str, Any]] = []
        for quote in quotes:
            try:
                if quote.get("quoteType") != "EQUITY":
                    continue

                exchange_raw = str(quote.get("exchange", "")).upper()
                if exchange_raw not in {"NSI", "BSE"}:
                    continue

                raw_symbol = str(quote.get("symbol", "")).upper()
                symbol = raw_symbol.replace(".NS", "").replace(".BO", "")
                if not symbol:
                    continue

                results.append(
                    {
                        "symbol": symbol,
                        "name": quote.get("shortname") or quote.get("longname") or symbol,
                        "exchange": "NSE" if exchange_raw == "NSI" else "BSE",
                        "sector": quote.get("sectorDisp") or "Unknown",
                        "current_price": quote.get("regularMarketPrice") or 0,
                    }
                )
            except Exception:
                continue

        combined = local_results + results
        deduped: List[Dict[str, Any]] = []
        seen = set()
        for item in combined:
            key = _norm(item.get("symbol", ""))
            if not key or key in seen:
                continue
            deduped.append(item)
            seen.add(key)

        if not deduped:
            fallback = local_results or [
                item
                for item in DEFAULT_SEARCH_RESULTS
                if q in item["symbol"].lower() or q in item["name"].lower()
            ]
            if query_symbol and not any(item["symbol"] == query_symbol for item in fallback):
                fallback.insert(
                    0,
                    {
                        "symbol": query_symbol,
                        "name": f"{query_symbol} (NSE/BSE)",
                        "exchange": "NSE",
                        "sector": "Unknown",
                        "current_price": 0,
                    },
                )
            return jsonify(fallback), 200

        return jsonify(deduped[:20]), 200
    except Exception as exc:
        fallback = local_results or [
            item
            for item in DEFAULT_SEARCH_RESULTS
            if q in item["symbol"].lower() or q in item["name"].lower()
        ]
        if query_symbol and not any(item["symbol"] == query_symbol for item in fallback):
            fallback.insert(
                0,
                {
                    "symbol": query_symbol,
                    "name": f"{query_symbol} (NSE/BSE)",
                    "exchange": "NSE",
                    "sector": "Unknown",
                    "current_price": 0,
                },
            )
        if fallback:
            return jsonify(fallback), 200
        return jsonify([]), 200


@analysis_bp.route("/quote/<symbol>", methods=["GET"])
def quote(symbol: str):
    """Return realtime quote for a stock symbol."""
    try:
        q = _fetch_realtime_quote(symbol)
        if not q:
            return jsonify({"error": f"Realtime quote not found for {symbol}"}), 404
        return jsonify(q), 200
    except Exception as exc:
        return jsonify({"error": f"quote failed: {exc}"}), 500


@analysis_bp.route("/market-overview", methods=["GET"])
def market_overview():
    """Return realtime values for NIFTY 50, SENSEX, and NIFTY BANK."""
    try:
        mapping = {
            "^NSEI": "NIFTY 50",
            "^BSESN": "SENSEX",
            "^NSEBANK": "NIFTY BANK",
        }
        output: List[Dict[str, Any]] = []
        for symbol, label in mapping.items():
            q = _fetch_realtime_quote(symbol)
            if not q:
                continue
            output.append(
                {
                    "symbol": symbol,
                    "name": label,
                    "value": q["price"],
                    "change": q["change"],
                    "changePct": q["changePct"],
                    "updatedAt": q["updatedAt"],
                }
            )

        if not output:
            return jsonify({"error": "Live market overview unavailable"}), 503

        return jsonify(output), 200
    except Exception as exc:
        return jsonify({"error": f"market overview failed: {exc}"}), 500
