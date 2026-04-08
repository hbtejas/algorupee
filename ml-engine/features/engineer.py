"""Feature engineering, scoring, and explainability for stock analysis."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator, MACD, SMAIndicator
from ta.volatility import AverageTrueRange, BollingerBands
from ta.volume import OnBalanceVolumeIndicator

from utils.sentiment import HybridSentimentScorer


@dataclass
class ScoreResult:
    """Container for a weighted score and detailed components."""

    score: float
    details: Dict[str, Any]


class TechnicalAnalyzer:
    """Calculates technical indicators and technical score."""

    def analyze(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Compute indicators, chart data, and weighted technical score."""
        if df.empty:
            raise ValueError("Technical analysis received empty dataframe")

        data = df.copy()
        close = data["Close"]
        high = data["High"]
        low = data["Low"]
        volume = data["Volume"]

        data["rsi"] = RSIIndicator(close=close, window=14).rsi()

        macd_obj = MACD(close=close, window_slow=26, window_fast=12, window_sign=9)
        data["macd"] = macd_obj.macd()
        data["macd_signal"] = macd_obj.macd_signal()
        data["macd_histogram"] = macd_obj.macd_diff()

        bb = BollingerBands(close=close, window=20, window_dev=2)
        data["bb_upper"] = bb.bollinger_hband()
        data["bb_lower"] = bb.bollinger_lband()
        data["bb_percent"] = ((close - data["bb_lower"]) / (data["bb_upper"] - data["bb_lower"])) * 100
        data["bb_bandwidth"] = (data["bb_upper"] - data["bb_lower"]) / close.replace(0, np.nan)

        data["ma_50"] = SMAIndicator(close=close, window=50).sma_indicator()
        data["ma_200"] = SMAIndicator(close=close, window=200).sma_indicator()
        data["ema_20"] = EMAIndicator(close=close, window=20).ema_indicator()

        data["golden_cross"] = data["ma_50"] > data["ma_200"]
        data["obv"] = OnBalanceVolumeIndicator(close=close, volume=volume).on_balance_volume()
        data["atr"] = AverageTrueRange(high=high, low=low, close=close, window=14).average_true_range()

        data["volume_avg_20"] = volume.rolling(20).mean()
        data["volume_ratio"] = volume / data["volume_avg_20"].replace(0, np.nan)

        data["ret_1d"] = close.pct_change(1) * 100
        data["ret_5d"] = close.pct_change(5) * 100
        data["ret_30d"] = close.pct_change(30) * 100

        latest = data.iloc[-1].fillna(0)

        rsi_score = self._score_rsi(float(latest["rsi"]))
        macd_score = 75 if float(latest["macd_histogram"]) > 0 else 25
        bb_score = self._score_bollinger(float(latest["bb_percent"]))
        ma_score = 80 if bool(latest["golden_cross"]) else 35
        volume_score = 75 if float(latest["volume_ratio"]) > 1.2 else 55

        technical_score = (
            0.25 * rsi_score
            + 0.25 * macd_score
            + 0.20 * bb_score
            + 0.20 * ma_score
            + 0.10 * volume_score
        )

        chart_cols = [
            "Open",
            "High",
            "Low",
            "Close",
            "Volume",
            "rsi",
            "macd",
            "macd_signal",
            "macd_histogram",
            "bb_upper",
            "bb_lower",
            "bb_percent",
            "ma_50",
            "ma_200",
            "ema_20",
            "volume_ratio",
            "ret_1d",
            "ret_5d",
            "ret_30d",
        ]

        chart_data = []
        sliced = data.tail(180)
        for idx, row in sliced.iterrows():
            chart_data.append(
                {
                    "date": idx.strftime("%Y-%m-%d"),
                    **{
                        col: (None if pd.isna(row[col]) else float(row[col]))
                        for col in chart_cols
                    },
                }
            )

        return {
            "technical_score": round(float(technical_score), 2),
            "metric_scores": {
                "rsi": round(rsi_score, 2),
                "macd": round(macd_score, 2),
                "bollinger": round(bb_score, 2),
                "ma_cross": round(ma_score, 2),
                "volume": round(volume_score, 2),
            },
            "technicals": {
                "rsi": round(float(latest["rsi"]), 2),
                "macd": round(float(latest["macd"]), 4),
                "macd_signal": round(float(latest["macd_signal"]), 4),
                "macd_histogram": round(float(latest["macd_histogram"]), 4),
                "bb_percent": round(float(latest["bb_percent"]), 2),
                "bb_upper": round(float(latest["bb_upper"]), 2),
                "bb_lower": round(float(latest["bb_lower"]), 2),
                "ma_50": round(float(latest["ma_50"]), 2),
                "ma_200": round(float(latest["ma_200"]), 2),
                "ema_20": round(float(latest["ema_20"]), 2),
                "volume_ratio": round(float(latest["volume_ratio"]), 2),
                "golden_cross": bool(latest["golden_cross"]),
                "above_ma50": float(latest["Close"]) >= float(latest["ma_50"]),
                "above_ma200": float(latest["Close"]) >= float(latest["ma_200"]),
                "ret_1d": round(float(latest["ret_1d"]), 2),
                "ret_5d": round(float(latest["ret_5d"]), 2),
                "ret_30d": round(float(latest["ret_30d"]), 2),
            },
            "chart_data": chart_data,
            "feature_frame": data,
        }

    def _score_rsi(self, rsi: float) -> float:
        """Map RSI level to score bands."""
        if rsi < 30:
            return 80
        if 30 <= rsi <= 50:
            return 60
        if rsi > 70:
            return 25
        return 45

    def _score_bollinger(self, bb_percent: float) -> float:
        """Score Bollinger %B where lower band proximity is bullish."""
        if bb_percent < 20:
            return 80
        if bb_percent <= 50:
            return 65
        if bb_percent <= 80:
            return 50
        return 30


class FundamentalScorer:
    """Calculates weighted score from key valuation and quality metrics."""

    def score(self, fundamentals: Dict[str, Any]) -> Dict[str, Any]:
        """Return fundamental score, metric scores, and raw values."""
        pe = fundamentals.get("pe_ratio")
        roe = fundamentals.get("roe")
        debt = fundamentals.get("debt_to_equity")
        rev_growth = fundamentals.get("revenue_growth")
        margin = fundamentals.get("profit_margin")

        metric_scores = {
            "pe_ratio": self._score_pe(pe),
            "roe": self._score_roe(roe),
            "debt_to_equity": self._score_debt(debt),
            "revenue_growth": self._score_revenue_growth(rev_growth),
            "profit_margin": self._score_profit_margin(margin),
        }

        weighted = (
            metric_scores["pe_ratio"] * 0.25
            + metric_scores["roe"] * 0.25
            + metric_scores["debt_to_equity"] * 0.20
            + metric_scores["revenue_growth"] * 0.15
            + metric_scores["profit_margin"] * 0.15
        )

        return {
            "fundamental_score": round(float(weighted), 2),
            "metric_scores": metric_scores,
            "raw": fundamentals,
        }

    def _score_pe(self, pe: Any) -> float:
        """Score PE ratio for Indian market ranges."""
        try:
            val = float(pe)
            if val < 15:
                return 85
            if val <= 25:
                return 70
            if val <= 40:
                return 50
            return 25
        except Exception:
            return 50

    def _score_roe(self, roe: Any) -> float:
        """Score ROE bands."""
        try:
            val = float(roe) * 100 if float(roe) <= 1 else float(roe)
            if val > 20:
                return 85
            if val >= 15:
                return 70
            if val >= 10:
                return 55
            return 30
        except Exception:
            return 50

    def _score_debt(self, debt: Any) -> float:
        """Score debt-to-equity where lower leverage scores higher."""
        try:
            val = float(debt)
            if val < 0.3:
                return 85
            if val <= 0.7:
                return 65
            if val <= 1.5:
                return 45
            return 25
        except Exception:
            return 50

    def _score_revenue_growth(self, growth: Any) -> float:
        """Score revenue growth rates."""
        try:
            val = float(growth) * 100 if float(growth) <= 1 else float(growth)
            if val > 20:
                return 85
            if val >= 10:
                return 70
            if val >= 0:
                return 55
            return 25
        except Exception:
            return 50

    def _score_profit_margin(self, margin: Any) -> float:
        """Score profit margin quality."""
        try:
            val = float(margin) * 100 if float(margin) <= 1 else float(margin)
            if val > 20:
                return 85
            if val >= 10:
                return 70
            if val >= 5:
                return 55
            return 35
        except Exception:
            return 50


class SentimentAnalyzer:
    """Aggregates article sentiment scores into a 0-100 sentiment metric."""

    def __init__(self):
        self.scorer = HybridSentimentScorer()

    def analyze(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return sentiment score and per-article analysis."""
        return self.scorer.score_articles(articles)


class VolumeTrendScorer:
    """Scores volume trend using surge, OBV trend, and momentum."""

    def score(self, feature_frame: pd.DataFrame) -> Dict[str, Any]:
        """Return volume score and details from indicator frame."""
        try:
            latest = feature_frame.iloc[-1]
            base = 60
            if float(latest.get("volume_ratio", 1.0)) > 2.0:
                base = 80

            obv = feature_frame["obv"].tail(5).dropna()
            if len(obv) >= 2:
                slope = np.polyfit(np.arange(len(obv)), obv.values, 1)[0]
                if slope > 0:
                    base += 10

            ret_5d = float(latest.get("ret_5d", 0.0))
            if ret_5d > 0:
                base += 10

            return {
                "volume_score": float(min(100, max(0, base))),
                "details": {
                    "volume_ratio": float(latest.get("volume_ratio", 1.0)),
                    "ret_5d": ret_5d,
                },
            }
        except Exception:
            return {"volume_score": 50.0, "details": {}}


class RecommendationEngine:
    """Combines scores, prediction, and explainability into final output."""

    def final_score(
        self,
        fundamental_score: float,
        technical_score: float,
        sentiment_score: float,
        volume_score: float,
    ) -> float:
        """Compute weighted final score."""
        return round(
            0.4 * fundamental_score
            + 0.3 * technical_score
            + 0.2 * sentiment_score
            + 0.1 * volume_score,
            2,
        )

    def recommendation(self, score: float) -> Tuple[str, str]:
        """Map final score to action and risk level."""
        if score > 75:
            return "BUY", "LOW" if score > 85 else "MEDIUM"
        if score >= 50:
            return "HOLD", "MEDIUM"
        return "SELL", "HIGH"

    def explainability(
        self,
        symbol: str,
        fundamentals: Dict[str, Any],
        technicals: Dict[str, Any],
        sentiment: Dict[str, Any],
    ) -> Dict[str, List[str]]:
        """Generate positive/negative/risk explanation strings."""
        positives: List[str] = []
        negatives: List[str] = []

        roe = fundamentals.get("roe")
        if roe is not None:
            roe_pct = float(roe) * 100 if float(roe) <= 1 else float(roe)
            if roe_pct >= 20:
                positives.append(f"Strong ROE of {roe_pct:.1f}% indicates quality profitability")
            elif roe_pct < 10:
                negatives.append(f"Low ROE of {roe_pct:.1f}% suggests weak capital efficiency")

        debt = fundamentals.get("debt_to_equity")
        if debt is not None:
            if float(debt) < 0.3:
                positives.append(f"Low debt-to-equity ratio ({float(debt):.2f}) indicates balance sheet strength")
            elif float(debt) > 1.5:
                negatives.append(f"Debt-to-Equity ratio of {float(debt):.2f} is elevated and increases risk")

        if bool(technicals.get("golden_cross")):
            positives.append("Golden Cross active: MA50 is above MA200, a bullish long-term trend signal")
        else:
            negatives.append("MA50 remains below MA200, indicating weak long-term momentum")

        rsi = float(technicals.get("rsi", 50))
        if rsi < 30:
            positives.append(f"RSI at {rsi:.1f} is oversold, often a potential reversal zone")
        elif rsi > 70:
            negatives.append(f"RSI at {rsi:.1f} is overbought, which can precede pullbacks")

        sent_score = int(sentiment.get("sentiment_score", 50))
        if sent_score >= 60:
            positives.append(f"News sentiment is supportive at {sent_score}/100")
        elif sent_score <= 45:
            negatives.append(f"Bearish news sentiment over recent days ({sent_score}/100)")

        if not positives:
            positives.append("No major bullish trigger yet, but score components remain stable")
            if 45 < sent_score < 60:
                positives.append("News sentiment is neutral-to-balanced without panic signals")

        if not negatives:
            negatives.append("No critical red flags detected, but upside confirmation is still pending")

        warnings = [
            "NOT financial advice. Predictions are probabilistic and not guaranteed.",
            "Past patterns do not guarantee future returns. Use stop-loss and position sizing.",
        ]

        atr_hint = technicals.get("ret_1d", 0)
        if abs(float(atr_hint)) > 2:
            warnings.append("High short-term volatility detected. Consider reducing position size.")

        return {
            "top_positive_factors": positives[:4],
            "top_negative_factors": negatives[:4],
            "risk_warnings": warnings,
        }
