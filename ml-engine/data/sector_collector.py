"""Sector-level market data collection for Indian equities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import pandas as pd
import requests
import yfinance as yf


@dataclass
class _CacheEntry:
    """Cache entry for sector payloads."""

    value: Any
    ts: datetime


class SectorCollector:
    """Collect stock-level and sector-index-level data for sector analytics."""

    SECTORS: Dict[str, List[str]] = {
        "IT & Technology": ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS", "LTIM.NS", "PERSISTENT.NS", "COFORGE.NS"],
        "Banking & Finance": ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS"],
        "FMCG & Consumer": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS", "MARICO.NS", "GODREJCP.NS"],
        "Pharma & Healthcare": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "APOLLOHOSP.NS", "LUPIN.NS", "TORNTPHARM.NS"],
        "Auto & EV": ["MARUTI.NS", "TATAMOTORS.NS", "M&M.NS", "BAJAJ-AUTO.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "TVSMOTOR.NS"],
        "Energy & Oil": ["RELIANCE.NS", "ONGC.NS", "BPCL.NS", "IOC.NS", "NTPC.NS", "POWERGRID.NS", "TATAPOWER.NS"],
        "Metals & Mining": ["TATASTEEL.NS", "HINDALCO.NS", "JSWSTEEL.NS", "SAIL.NS", "VEDL.NS", "COALINDIA.NS", "NMDC.NS"],
        "Infrastructure & Real Estate": ["LT.NS", "ADANIENT.NS", "DLF.NS", "GODREJPROP.NS", "OBEROIRLTY.NS", "PRESTIGE.NS", "BRIGADE.NS"],
        "Chemicals & Specialty": ["PIDILITIND.NS", "ASIANPAINT.NS", "BERGEPAINT.NS", "ATUL.NS", "DEEPAKNTR.NS", "NAVINFLUOR.NS"],
        "Telecom & Media": ["BHARTIARTL.NS", "IDEA.NS", "INDIAMART.NS", "ZOMATO.NS", "NAUKRI.NS"],
        "Capital Goods": ["SIEMENS.NS", "ABB.NS", "BHEL.NS", "CUMMINSIND.NS", "THERMAX.NS", "VOLTAS.NS"],
        "Retail & E-commerce": ["DMART.NS", "TRENT.NS", "TITAN.NS", "JUBLFOOD.NS", "DEVYANI.NS", "NYKAA.NS"],
    }

    INDEX_MAP: Dict[str, str] = {
        "Nifty IT": "^CNXIT",
        "Nifty Bank": "^NSEBANK",
        "Nifty FMCG": "^CNXFMCG",
        "Nifty Pharma": "^CNXPHARMA",
        "Nifty Auto": "^CNXAUTO",
        "Nifty Energy": "^CNXENERGY",
        "Nifty Metal": "^CNXMETAL",
        "Nifty Realty": "^CNXREALTY",
    }

    def __init__(self):
        self._sector_cache: _CacheEntry | None = None
        self._index_cache: _CacheEntry | None = None
        self._flow_cache: _CacheEntry | None = None
        self._ttl_seconds = 300

    def _fresh(self, entry: _CacheEntry | None) -> bool:
        """Check if cache entry is still fresh."""
        if entry is None:
            return False
        age = (datetime.now(timezone.utc) - entry.ts).total_seconds()
        return age <= self._ttl_seconds

    def _safe_float(self, value: Any, default: float = 0.0) -> float:
        """Convert values to float safely."""
        try:
            if value is None:
                return default
            return float(value)
        except Exception:
            return default

    def _rsi(self, close: pd.Series, period: int = 14) -> float:
        """Calculate RSI for close series."""
        if close is None or close.empty or len(close) < period + 2:
            return 50.0
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(period).mean()
        loss = (-delta.clip(upper=0)).rolling(period).mean()
        rs = gain / loss.replace(0, pd.NA)
        rsi = 100 - (100 / (1 + rs))
        val = rsi.dropna().iloc[-1] if not rsi.dropna().empty else 50.0
        return self._safe_float(val, 50.0)

    def _macd_signal(self, close: pd.Series) -> str:
        """Compute MACD bullish/bearish state."""
        if close is None or close.empty or len(close) < 40:
            return "neutral"
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd = ema12 - ema26
        signal = macd.ewm(span=9, adjust=False).mean()
        latest = self._safe_float(macd.iloc[-1])
        latest_sig = self._safe_float(signal.iloc[-1])
        if latest > latest_sig:
            return "bullish"
        if latest < latest_sig:
            return "bearish"
        return "neutral"

    def _download_sector_prices(self, symbols: List[str]) -> pd.DataFrame:
        """Batch download OHLCV data for symbols."""
        joined = " ".join(symbols)
        try:
            df = yf.download(
                tickers=joined,
                period="6mo",
                interval="1d",
                auto_adjust=False,
                group_by="ticker",
                progress=False,
                threads=False,
            )
            return df if df is not None else pd.DataFrame()
        except Exception:
            return pd.DataFrame()

    def _all_tickers(self) -> List[str]:
        """Return de-duplicated ticker universe across sectors."""
        tickers: List[str] = []
        seen = set()
        for symbols in self.SECTORS.values():
            for ticker in symbols:
                if ticker in seen:
                    continue
                seen.add(ticker)
                tickers.append(ticker)
        return tickers

    def _fetch_quote_meta(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """Fetch quote metadata in batch from Yahoo quote endpoint."""
        out: Dict[str, Dict[str, Any]] = {}
        if not symbols:
            return out

        chunks = [symbols[i : i + 30] for i in range(0, len(symbols), 30)]
        for chunk in chunks:
            try:
                resp = requests.get(
                    "https://query1.finance.yahoo.com/v7/finance/quote",
                    params={"symbols": ",".join(chunk)},
                    timeout=8,
                )
                resp.raise_for_status()
                payload = resp.json() or {}
                rows = (payload.get("quoteResponse") or {}).get("result") or []
                for row in rows:
                    sym = str(row.get("symbol") or "").upper()
                    if sym:
                        out[sym] = row
            except Exception:
                continue
        return out

    def _extract_symbol_frame(self, downloaded: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """Extract symbol DataFrame from yfinance multi-index response."""
        if downloaded.empty:
            return pd.DataFrame()

        if isinstance(downloaded.columns, pd.MultiIndex):
            if symbol in downloaded.columns.get_level_values(0):
                frame = downloaded[symbol].copy()
                return frame
            return pd.DataFrame()

        # Single symbol shape
        return downloaded.copy()

    def _returns(self, close: pd.Series, periods: int) -> float:
        """Compute percentage return for period."""
        if close is None or close.empty or len(close) <= periods:
            return 0.0
        prev = self._safe_float(close.iloc[-periods - 1], 0.0)
        curr = self._safe_float(close.iloc[-1], 0.0)
        if prev <= 0:
            return 0.0
        return ((curr - prev) / prev) * 100

    def _ytd_return(self, close: pd.Series) -> float:
        """Compute year-to-date return."""
        if close is None or close.empty:
            return 0.0
        now = datetime.now()
        this_year = close[close.index.year == now.year]
        if this_year.empty:
            return 0.0
        start = self._safe_float(this_year.iloc[0], 0.0)
        end = self._safe_float(this_year.iloc[-1], 0.0)
        if start <= 0:
            return 0.0
        return ((end - start) / start) * 100

    def _build_sector_rows(
        self,
        sector_name: str,
        tickers: List[str],
        downloaded: pd.DataFrame,
        meta_map: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Build one sector stock batch from pre-fetched market data."""
        _ = sector_name
        rows: List[Dict[str, Any]] = []

        for ticker in tickers:
            frame = self._extract_symbol_frame(downloaded, ticker)
            if frame.empty or "Close" not in frame.columns:
                continue

            close = frame["Close"].dropna()
            if close.empty:
                continue

            volume = frame["Volume"].dropna() if "Volume" in frame.columns else pd.Series(dtype=float)
            latest_volume = self._safe_float(volume.iloc[-1], 0.0) if not volume.empty else 0.0
            avg_volume = self._safe_float(volume.tail(20).mean(), 0.0) if not volume.empty else 0.0
            volume_ratio = (latest_volume / avg_volume) if avg_volume > 0 else 1.0

            raw_meta = meta_map.get(ticker.upper(), {})
            symbol_clean = ticker.replace(".NS", "").replace(".BO", "")
            current_price = self._safe_float(raw_meta.get("regularMarketPrice"), self._safe_float(close.iloc[-1], 0.0))
            pe_ratio = self._safe_float(raw_meta.get("trailingPE"), 0.0)
            pb_ratio = self._safe_float(raw_meta.get("priceToBook"), 0.0)
            market_cap = self._safe_float(raw_meta.get("marketCap"), 0.0)
            high_52w = self._safe_float(raw_meta.get("fiftyTwoWeekHigh"), 0.0)
            low_52w = self._safe_float(raw_meta.get("fiftyTwoWeekLow"), 0.0)
            dist_from_high = ((current_price - high_52w) / high_52w * 100) if high_52w > 0 else 0.0

            ma50 = self._safe_float(close.tail(50).mean(), 0.0)
            above_ma50 = bool(current_price >= ma50) if ma50 > 0 else False
            rsi = self._rsi(close)
            macd_signal = self._macd_signal(close)

            stock_score = (
                self._returns(close, 21) * 0.35
                + self._returns(close, 63) * 0.35
                + (10 if above_ma50 else -10) * 0.2
                + (volume_ratio - 1) * 100 * 0.1
            )

            rows.append(
                {
                    "symbol": symbol_clean,
                    "ticker": ticker,
                    "name": raw_meta.get("shortName") or symbol_clean,
                    "current_price": round(current_price, 2),
                    "change_1d": round(self._safe_float(raw_meta.get("regularMarketChangePercent"), self._returns(close, 1)), 2),
                    "change_5d": round(self._returns(close, 5), 2),
                    "change_1m": round(self._returns(close, 21), 2),
                    "change_3m": round(self._returns(close, 63), 2),
                    "ytd": round(self._ytd_return(close), 2),
                    "volume": round(latest_volume),
                    "avg_volume": round(avg_volume),
                    "volume_ratio": round(volume_ratio, 3),
                    "market_cap": round(market_cap),
                    "pe_ratio": round(pe_ratio, 2) if pe_ratio > 0 else None,
                    "pb_ratio": round(pb_ratio, 2) if pb_ratio > 0 else None,
                    "52w_high": round(high_52w, 2) if high_52w > 0 else None,
                    "52w_low": round(low_52w, 2) if low_52w > 0 else None,
                    "distance_from_52w_high": round(dist_from_high, 2),
                    "rsi": round(rsi, 2),
                    "macd_signal": macd_signal,
                    "above_ma50": above_ma50,
                    "score": round(stock_score, 2),
                }
            )

        return rows

    def fetch_sector_batch(self, sector_name: str) -> List[Dict[str, Any]]:
        """Fetch one sector stock batch with price, momentum, valuation, and technical fields."""
        tickers = self.SECTORS.get(sector_name, [])
        if not tickers:
            return []

        downloaded = self._download_sector_prices(tickers)
        meta_map = self._fetch_quote_meta(tickers)
        return self._build_sector_rows(sector_name=sector_name, tickers=tickers, downloaded=downloaded, meta_map=meta_map)

    def fetch_all_sectors(self, force_refresh: bool = False) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch all sectors with a single bulk data pull and cache results for 5 minutes."""
        if not force_refresh and self._fresh(self._sector_cache):
            return self._sector_cache.value

        result: Dict[str, List[Dict[str, Any]]] = {}
        all_tickers = self._all_tickers()
        downloaded = self._download_sector_prices(all_tickers)
        meta_map = self._fetch_quote_meta(all_tickers)

        for sector_name, tickers in self.SECTORS.items():
            try:
                result[sector_name] = self._build_sector_rows(
                    sector_name=sector_name,
                    tickers=tickers,
                    downloaded=downloaded,
                    meta_map=meta_map,
                )
            except Exception:
                result[sector_name] = []

        populated = sum(len(rows) for rows in result.values())
        if populated == 0 and self._sector_cache is not None:
            return self._sector_cache.value

        self._sector_cache = _CacheEntry(value=result, ts=datetime.now(timezone.utc))
        return result

    def get_sector_index_performance(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch major NSE sector index performance and 30-day chart snapshots."""
        if not force_refresh and self._fresh(self._index_cache):
            return self._index_cache.value

        payload: Dict[str, Any] = {}
        for index_name, ticker in self.INDEX_MAP.items():
            try:
                data = yf.download(
                    tickers=ticker,
                    period="4mo",
                    interval="1d",
                    auto_adjust=False,
                    progress=False,
                )
                if data is None or data.empty or "Close" not in data.columns:
                    continue

                close = data["Close"].dropna()
                if close.empty:
                    continue

                curr = self._safe_float(close.iloc[-1], 0.0)
                ch_1d = self._returns(close, 1)
                ch_1m = self._returns(close, 21)
                ch_3m = self._returns(close, 63)

                chart_points = [
                    {
                        "date": idx.strftime("%Y-%m-%d"),
                        "value": round(self._safe_float(val, 0.0), 2),
                    }
                    for idx, val in close.tail(30).items()
                ]

                payload[index_name] = {
                    "ticker": ticker,
                    "current": round(curr, 2),
                    "change_1d": round(ch_1d, 2),
                    "change_1m": round(ch_1m, 2),
                    "change_3m": round(ch_3m, 2),
                    "chart_30d": chart_points,
                }
            except Exception:
                continue

        self._index_cache = _CacheEntry(value=payload, ts=datetime.now(timezone.utc))
        return payload

    def get_fii_dii_sector_flows(self, sector_market_caps: Dict[str, float], force_refresh: bool = False) -> Dict[str, Dict[str, float]]:
        """Estimate sector-wise FII/DII flow distribution from NSE participant totals weighted by sector market cap."""
        if not force_refresh and self._fresh(self._flow_cache):
            return self._flow_cache.value

        total_fii = 0.0
        total_dii = 0.0

        try:
            resp = requests.get("https://www.nseindia.com/api/fiidiiTradeReact", timeout=8)
            if resp.ok:
                rows = resp.json() or []
                if rows:
                    latest = rows[-1] or {}
                    total_fii = self._safe_float(latest.get("fiiNet"), 0.0)
                    total_dii = self._safe_float(latest.get("diiNet"), 0.0)
        except Exception:
            total_fii = 0.0
            total_dii = 0.0

        cap_total = sum(max(v, 0.0) for v in sector_market_caps.values())
        flows: Dict[str, Dict[str, float]] = {}
        for sector, cap in sector_market_caps.items():
            weight = (cap / cap_total) if cap_total > 0 else (1.0 / max(len(sector_market_caps), 1))
            flows[sector] = {
                "fii_net": round(total_fii * weight, 2),
                "dii_net": round(total_dii * weight, 2),
                "net": round((total_fii + total_dii) * weight, 2),
            }

        self._flow_cache = _CacheEntry(value=flows, ts=datetime.now(timezone.utc))
        return flows
