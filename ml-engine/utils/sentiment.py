"""Sentiment utilities built on VADER and TextBlob."""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List

from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


class HybridSentimentScorer:
    """Scores article text using weighted VADER and TextBlob signals."""

    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()

    def score_text(self, text: str) -> float:
        """Return a compound sentiment score in [-1, 1]."""
        try:
            safe_text = text or ""
            vader_score = self.vader.polarity_scores(safe_text).get("compound", 0.0)
            tb_score = TextBlob(safe_text).sentiment.polarity
            return 0.6 * vader_score + 0.4 * tb_score
        except Exception:
            return 0.0

    def _recency_weight(self, published_at: str, idx: int) -> float:
        """Return higher weights for fresher articles."""
        try:
            if not published_at:
                return max(0.2, 1.0 - idx * 0.03)
            dt = parsedate_to_datetime(published_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days_old = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 86400)
            return max(0.2, 1.5 - min(days_old, 30) * 0.04)
        except Exception:
            return max(0.2, 1.0 - idx * 0.03)

    def score_articles(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return aggregate sentiment score and per-article sentiment details."""
        if not articles:
            return {
                "sentiment_score": 50,
                "label": "NEUTRAL",
                "article_sentiments": [],
            }

        weighted_sum = 0.0
        weight_total = 0.0
        article_sentiments = []

        for idx, article in enumerate(articles):
            text = f"{article.get('title', '')}. {article.get('description', '')}".strip()
            score = self.score_text(text)
            weight = self._recency_weight(article.get("published_at", ""), idx)
            weighted_sum += score * weight
            weight_total += weight

            label = "NEUTRAL"
            if score > 0.05:
                label = "POSITIVE"
            elif score < -0.05:
                label = "NEGATIVE"

            article_sentiments.append(
                {
                    "title": article.get("title", ""),
                    "sentiment": label,
                    "score": round(score, 4),
                    "source": article.get("source", "Unknown"),
                    "url": article.get("url", ""),
                    "published_at": article.get("published_at", ""),
                }
            )

        compound = weighted_sum / weight_total if weight_total else 0.0

        if compound > 0.05:
            mapped = min(85, int(55 + compound * 60))
            label = "POSITIVE"
        elif compound < -0.05:
            mapped = max(15, int(45 + compound * 60))
            label = "NEGATIVE"
        else:
            mapped = 50
            label = "NEUTRAL"

        return {
            "sentiment_score": int(mapped),
            "label": label,
            "article_sentiments": article_sentiments,
        }
