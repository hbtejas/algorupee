"""Data collection adapters for stock prices, fundamentals, and news."""

from __future__ import annotations

import os
import time
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
import yfinance as yf
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from data.indian_stocks import INDIAN_STOCK_UNIVERSE

load_dotenv()

try:
    from kiteconnect import KiteConnect
except Exception:  # pragma: no cover
    KiteConnect = None


@dataclass
class CacheEntry:
    """Represents a cache value with timestamp."""

    value: Any
    ts: float


class TTLRUCache:
    """A small in-memory LRU cache with TTL support."""

    def __init__(self, max_size: int = 128, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._store: "OrderedDict[str, CacheEntry]" = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        """Return value if present and fresh; else None."""
        try:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.time() - entry.ts > self.ttl_seconds:
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            return entry.value
        except Exception:
            return None

    def set(self, key: str, value: Any) -> None:
        """Store a value in cache while preserving LRU ordering."""
        try:
            self._store[key] = CacheEntry(value=value, ts=time.time())
            self._store.move_to_end(key)
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)
        except Exception:
            return


class ZerodhaAdapter:
    """Adapter for Zerodha Kite historical/live market data."""

    def __init__(self):
        self.api_key = os.getenv("ZERODHA_API_KEY")
        self.access_token = os.getenv("ZERODHA_ACCESS_TOKEN")
        self.client = None

        try:
            if self.api_key and self.access_token and KiteConnect:
                self.client = KiteConnect(api_key=self.api_key)
                self.client.set_access_token(self.access_token)
        except Exception:
            self.client = None

    @property
    def configured(self) -> bool:
        """Return True when Kite client is available."""
        return self.client is not None

    def get_historical_data(
        self,
        instrument_token: int,
        from_date: datetime,
        to_date: datetime,
        interval: str = "day",
    ) -> pd.DataFrame:
        """Fetch historical OHLCV from Zerodha for an instrument token."""
        if not self.client:
            raise RuntimeError("Zerodha is not configured")

        try:
            rows = self.client.historical_data(
                instrument_token=instrument_token,
                from_date=from_date,
                to_date=to_date,
                interval=interval,
                continuous=False,
                oi=False,
            )
            df = pd.DataFrame(rows)
            if df.empty:
                return df
            df.rename(columns={"date": "Date", "open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"}, inplace=True)
            df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
            df.set_index("Date", inplace=True)
            return df[["Open", "High", "Low", "Close", "Volume"]]
        except Exception as exc:
            raise RuntimeError(f"Zerodha historical fetch failed: {exc}") from exc

    def get_live_quote(self, symbol: str) -> Dict[str, Any]:
        """Fetch live quote using Zerodha quote endpoint."""
        if not self.client:
            raise RuntimeError("Zerodha is not configured")

        try:
            quote = self.client.quote([symbol])
            if symbol in quote:
                return quote[symbol]
            return {}
        except Exception as exc:
            raise RuntimeError(f"Zerodha live quote failed: {exc}") from exc


class YFinanceAdapter:
    """Adapter for Yahoo Finance price and fundamentals."""

    _LOCAL_PROFILE_MAP: Dict[str, Dict[str, Any]] = {
        str(item.get("symbol", "")).upper(): item for item in INDIAN_STOCK_UNIVERSE
    }

    _SECTOR_TO_INDUSTRY: Dict[str, str] = {
        "FMCG": "Consumer Staples",
        "Technology": "Information Technology Services",
        "Financial Services": "Banking & Financial Services",
        "Automobile": "Auto & Auto Components",
        "Energy": "Oil, Gas & Energy",
        "Pharma": "Pharmaceuticals",
        "Healthcare": "Healthcare Services",
        "Utilities": "Power Utilities",
        "Internet": "Internet & Platform Services",
        "Retail": "Retail",
        "Chemicals": "Specialty Chemicals",
        "Metals": "Metals & Mining",
        "Real Estate": "Real Estate",
        "Capital Goods": "Industrial Manufacturing",
        "Cement": "Cement & Building Materials",
    }

    def _base_symbol(self, symbol: str) -> str:
        """Normalize symbol to base exchange-agnostic key."""
        return str(symbol or "").strip().upper().replace(".NS", "").replace(".BO", "")

    def _local_profile(self, symbol: str) -> Dict[str, Any]:
        """Lookup static local profile for known Indian stocks."""
        return self._LOCAL_PROFILE_MAP.get(self._base_symbol(symbol), {})

    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol for Indian exchanges when suffix is absent."""
        s = symbol.strip().upper()
        if "." in s:
            return s
        return f"{s}.NS"

    def _ticker(self, symbol: str) -> yf.Ticker:
        """Create a yfinance ticker object."""
        return yf.Ticker(self._normalize_symbol(symbol))

    def _history_candidates(self, symbol: str) -> List[str]:
        """Build historical data symbol candidates across exchanges."""
        s = str(symbol or "").strip().upper()
        if not s:
            return []
        if s.startswith("^"):
            return [s]
        if "." in s:
            base = s.split(".")[0]
            return [s, f"{base}.NS", f"{base}.BO", base]
        return [f"{s}.NS", f"{s}.BO", s]

    def _quote_candidates(self, symbol: str) -> List[str]:
        """Build candidate Yahoo quote symbols for Indian stocks."""
        s = str(symbol or "").strip().upper()
        if not s:
            return []
        if s.startswith("^") or "." in s:
            return [s]
        return [f"{s}.NS", f"{s}.BO", s]

    def _fetch_quote_snapshot(self, symbol: str) -> Dict[str, Any]:
        """Fetch lightweight quote fields from Yahoo quote endpoint without yfinance info."""
        for candidate in self._quote_candidates(symbol):
            try:
                resp = requests.get(
                    "https://query1.finance.yahoo.com/v7/finance/quote",
                    params={"symbols": candidate},
                    timeout=6,
                )
                resp.raise_for_status()
                payload = resp.json() or {}
                rows = (payload.get("quoteResponse") or {}).get("result") or []
                if not rows:
                    continue
                quote = rows[0] or {}
                if not quote:
                    continue
                return quote
            except Exception:
                continue
        return {}

    def _fetch_quote_summary(self, symbol: str) -> Dict[str, Any]:
        """Fetch quote summary modules for ownership/fundamentals fallback."""
        for candidate in self._quote_candidates(symbol):
            try:
                resp = requests.get(
                    f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{candidate}",
                    params={"modules": "defaultKeyStatistics,summaryProfile,financialData"},
                    timeout=7,
                )
                resp.raise_for_status()
                payload = resp.json() or {}
                result = (payload.get("quoteSummary") or {}).get("result") or []
                if result:
                    return result[0] or {}
            except Exception:
                continue
        return {}

    def _default_fundamentals(self, symbol: str, current_price: float = 0.0) -> Dict[str, Any]:
        """Return safe fallback fundamentals when provider calls fail."""
        profile = self._local_profile(symbol)
        base = self._base_symbol(symbol)
        company_name = profile.get("name") or base
        sector = profile.get("sector") or "Unknown"
        industry = self._SECTOR_TO_INDUSTRY.get(sector, "Unknown") if sector != "Unknown" else "Unknown"
        website = f"https://finance.yahoo.com/quote/{self._normalize_symbol(base)}"
        return {
            "pe_ratio": None,
            "forward_pe": None,
            "pb_ratio": None,
            "roe": None,
            "roa": None,
            "debt_to_equity": None,
            "current_ratio": None,
            "revenue_growth": None,
            "earnings_growth": None,
            "profit_margin": None,
            "market_cap": None,
            "dividend_yield": None,
            "52w_high": None,
            "52w_low": None,
            "beta": None,
            "sector": sector,
            "industry": industry,
            "company_name": company_name,
            "current_price": float(current_price or 0.0),
            "currency": "INR",
            "business_model": f"{company_name} operates in the {industry} segment under the {sector} sector.",
            "promoter_holding_pct": None,
            "institutional_holding_pct": None,
            "website": website,
        }

    def get_historical_data(self, symbol: str, period: str = "2y") -> pd.DataFrame:
        """Return historical OHLCV DataFrame for a stock symbol."""
        candidates = self._history_candidates(symbol)
        intervals = ["1d", "1wk"]

        for candidate in candidates:
            for interval in intervals:
                try:
                    ticker = yf.Ticker(candidate)
                    df = ticker.history(period=period, interval=interval, auto_adjust=False)
                    if df is None or df.empty:
                        continue

                    cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
                    if not cols or "Close" not in cols:
                        continue

                    out = df[cols].copy()
                    for required in ["Open", "High", "Low", "Close", "Volume"]:
                        if required not in out.columns:
                            out[required] = out["Close"] if required != "Volume" else 0

                    idx = pd.to_datetime(out.index)
                    try:
                        idx = idx.tz_localize(None)
                    except Exception:
                        try:
                            idx = idx.tz_convert(None)
                        except Exception:
                            pass
                    out.index = idx
                    return out[["Open", "High", "Low", "Close", "Volume"]]
                except Exception:
                    continue

        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    def get_fundamentals(self, symbol: str) -> Dict[str, Any]:
        """Return standard fundamentals dictionary used by scoring pipeline."""
        try:
            profile = self._local_profile(symbol)
            ticker = self._ticker(symbol)
            info: Dict[str, Any] = {}
            try:
                # yfinance can raise TypeError/HTTP errors here when response payload is malformed.
                info = ticker.info or {}
            except Exception:
                info = {}

            def val(key: str, default: Any = None) -> Any:
                return info.get(key, default)

            def pct_value(raw: Any) -> Any:
                """Normalize ratio values into percentage units when needed."""
                try:
                    n = float(raw)
                    return n * 100 if n <= 1 else n
                except Exception:
                    return None

            quote_snapshot = self._fetch_quote_snapshot(symbol)
            quote_summary = self._fetch_quote_summary(symbol)
            key_stats = quote_summary.get("defaultKeyStatistics") or {}
            summary_profile = quote_summary.get("summaryProfile") or {}
            financial_data = quote_summary.get("financialData") or {}

            def pick(*values: Any, default: Any = None) -> Any:
                for item in values:
                    if item is not None and item != "":
                        return item
                return default

            current_price = pick(
                val("currentPrice"),
                val("regularMarketPrice"),
                quote_snapshot.get("regularMarketPrice"),
                default=0.0,
            )
            if not current_price:
                try:
                    fast = getattr(ticker, "fast_info", {}) or {}
                    current_price = fast.get("last_price") or fast.get("regular_market_price") or 0.0
                except Exception:
                    current_price = 0.0

            if not current_price:
                try:
                    intraday = ticker.history(period="1d", interval="1m", auto_adjust=False)
                    if intraday is not None and not intraday.empty:
                        current_price = float(intraday.iloc[-1]["Close"])
                except Exception:
                    current_price = 0.0

            highs = pick(val("fiftyTwoWeekHigh"), quote_snapshot.get("fiftyTwoWeekHigh"))
            lows = pick(val("fiftyTwoWeekLow"), quote_snapshot.get("fiftyTwoWeekLow"))

            promoter_holding = None
            institutional_holding = None
            try:
                promoter_holding = pct_value(val("heldPercentInsiders"))
                institutional_holding = pct_value(val("heldPercentInstitutions"))
            except Exception:
                promoter_holding = None
                institutional_holding = None

            if promoter_holding is None:
                promoter_holding = pct_value((key_stats.get("heldPercentInsiders") or {}).get("raw"))
            if institutional_holding is None:
                institutional_holding = pct_value((key_stats.get("heldPercentInstitutions") or {}).get("raw"))

            if promoter_holding is None or institutional_holding is None:
                try:
                    holders = ticker.major_holders
                    if holders is not None and not holders.empty and holders.shape[1] >= 2:
                        rows = holders.values.tolist()
                        for row in rows:
                            if len(row) < 2:
                                continue
                            c0 = str(row[0] or "").strip()
                            c1 = str(row[1] or "").strip()

                            raw_val = c0 if "%" in c0 or c0.replace(".", "", 1).isdigit() else c1
                            label = (c1 if raw_val == c0 else c0).lower()

                            raw_val = raw_val.replace("%", "").strip()
                            try:
                                num = float(raw_val)
                            except Exception:
                                continue
                            if "insider" in label and promoter_holding is None:
                                promoter_holding = num
                            if "institution" in label and institutional_holding is None:
                                institutional_holding = num
                except Exception:
                    pass

            company_name = pick(val("longName"), quote_snapshot.get("longName"), profile.get("name"), symbol.upper())
            sector = pick(val("sector"), quote_snapshot.get("sector"), "Unknown")
            industry = pick(val("industry"), quote_snapshot.get("industry"), "Unknown")
            if sector == "Unknown":
                sector = pick(summary_profile.get("sector"), "Unknown")
            if industry == "Unknown":
                industry = pick(summary_profile.get("industry"), "Unknown")
            if sector == "Unknown":
                sector = pick(profile.get("sector"), "Unknown")
            if industry == "Unknown" and sector != "Unknown":
                industry = self._SECTOR_TO_INDUSTRY.get(sector, "Unknown")
            business_model = pick(
                val("longBusinessSummary"),
                val("longDescription"),
                summary_profile.get("longBusinessSummary"),
            )
            if not business_model:
                business_model = f"{company_name} operates in the {industry} segment under the {sector} sector."

            return {
                "pe_ratio": pick(val("trailingPE"), quote_snapshot.get("trailingPE")),
                "forward_pe": pick(val("forwardPE"), quote_snapshot.get("forwardPE")),
                "pb_ratio": pick(val("priceToBook"), quote_snapshot.get("priceToBook")),
                "roe": val("returnOnEquity"),
                "roa": val("returnOnAssets"),
                "debt_to_equity": val("debtToEquity", 0) / 100 if val("debtToEquity") is not None else pct_value((financial_data.get("debtToEquity") or {}).get("raw")),
                "current_ratio": pick(val("currentRatio"), (financial_data.get("currentRatio") or {}).get("raw")),
                "revenue_growth": val("revenueGrowth"),
                "earnings_growth": val("earningsGrowth"),
                "profit_margin": val("profitMargins"),
                "market_cap": pick(val("marketCap"), quote_snapshot.get("marketCap")),
                "dividend_yield": pick(val("dividendYield"), quote_snapshot.get("trailingAnnualDividendYield")),
                "52w_high": highs,
                "52w_low": lows,
                "beta": pick(val("beta"), quote_snapshot.get("beta")),
                "sector": sector,
                "industry": industry,
                "company_name": company_name,
                "current_price": float(current_price or 0.0),
                "currency": val("currency", "INR"),
                "business_model": business_model,
                "promoter_holding_pct": promoter_holding,
                "institutional_holding_pct": institutional_holding,
                "website": pick(val("website"), quote_snapshot.get("website"), f"https://finance.yahoo.com/quote/{self._normalize_symbol(self._base_symbol(symbol))}"),
            }
        except Exception as exc:
            return self._default_fundamentals(symbol=symbol)


class NewsFetcher:
    """Fetches stock-related news from NewsAPI with RSS fallback."""

    def __init__(self):
        self.news_api_key = os.getenv("NEWS_API_KEY")

    def _from_newsapi(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch articles from NewsAPI."""
        if not self.news_api_key:
            return []

        try:
            resp = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": limit,
                    "apiKey": self.news_api_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            payload = resp.json()
            articles = payload.get("articles", [])
            return [
                {
                    "title": a.get("title", ""),
                    "description": a.get("description", ""),
                    "url": a.get("url", ""),
                    "published_at": a.get("publishedAt", ""),
                    "source": (a.get("source") or {}).get("name", "NewsAPI"),
                }
                for a in articles
            ]
        except Exception:
            return []

    def _from_google_rss(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch articles from Google News RSS feed."""
        try:
            resp = requests.get(
                "https://news.google.com/rss/search",
                params={"q": query, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"},
                timeout=10,
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            items = root.findall(".//item")[:limit]
            result: List[Dict[str, Any]] = []
            for item in items:
                title = item.findtext("title", default="")
                description = item.findtext("description", default="")
                link = item.findtext("link", default="")
                pub_date = item.findtext("pubDate", default="")
                result.append(
                    {
                        "title": title,
                        "description": description,
                        "url": link,
                        "published_at": pub_date,
                        "source": "Google News",
                    }
                )
            return result
        except Exception:
            return []

    def _from_yfinance(self, symbol: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch latest articles from yfinance ticker news feed."""
        try:
            ticker = yf.Ticker(self._normalize_symbol(symbol))
            items = getattr(ticker, "news", []) or []
            result: List[Dict[str, Any]] = []
            for item in items[:limit]:
                pub_ts = item.get("providerPublishTime")
                published = ""
                if pub_ts:
                    try:
                        published = datetime.utcfromtimestamp(int(pub_ts)).isoformat() + "Z"
                    except Exception:
                        published = ""
                result.append(
                    {
                        "title": item.get("title", ""),
                        "description": item.get("summary", ""),
                        "url": item.get("link", ""),
                        "published_at": published,
                        "source": (item.get("publisher") or "Yahoo Finance"),
                    }
                )
            return result
        except Exception:
            return []

    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbols for yfinance news lookup."""
        s = str(symbol or "").strip().upper()
        if not s:
            return s
        if "." in s or s.startswith("^"):
            return s
        return f"{s}.NS"

    def fetch_news(self, symbol: str, company_name: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Fetch and deduplicate stock news."""
        query = f"{company_name} OR {symbol} stock India"
        articles = self._from_newsapi(query=query, limit=limit)
        if not articles:
            articles = self._from_google_rss(query=query, limit=limit)
        if not articles:
            articles = self._from_yfinance(symbol=symbol, limit=limit)

        seen = set()
        deduped: List[Dict[str, Any]] = []
        for article in articles:
            key = article.get("url") or article.get("title")
            if key and key not in seen:
                deduped.append(article)
                seen.add(key)
        return deduped[:limit]


class DataManager:
    """Unified data manager for price, fundamentals, and news."""

    def __init__(self):
        self.zerodha = ZerodhaAdapter()
        self.yahoo = YFinanceAdapter()
        self.news = NewsFetcher()
        self.cache = TTLRUCache(max_size=256, ttl_seconds=300)

    def get_all_data(self, symbol: str, force_refresh: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]]:
        """Return (price_df, fundamentals, news_list) with caching."""
        cache_key = f"all::{symbol.upper()}"
        if not force_refresh:
            cached = self.cache.get(cache_key)
            if cached is not None:
                return cached

        try:
            price_df = self.yahoo.get_historical_data(symbol=symbol, period="2y")
            fundamentals = self.yahoo.get_fundamentals(symbol=symbol)
            news_list = self.news.fetch_news(symbol=symbol, company_name=fundamentals.get("company_name", symbol), limit=20)
            result = (price_df, fundamentals, news_list)
            self.cache.set(cache_key, result)
            return result
        except Exception as exc:
            raise RuntimeError(f"DataManager get_all_data failed: {exc}") from exc
