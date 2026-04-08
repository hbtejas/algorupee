"""Prediction models for stock direction and short-term price change."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception:  # pragma: no cover
    XGBClassifier = None
    XGBRegressor = None


MODEL_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


class StockPredictor:
    """Builds features, trains ensemble models, and serves predictions."""

    def __init__(self):
        self.scaler = StandardScaler()
        self.rf_7 = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42)
        self.rf_30 = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42)
        self.rf_reg = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42)

        self.xgb_7 = (
            XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, objective="binary:logistic", eval_metric="logloss", random_state=42)
            if XGBClassifier
            else None
        )
        self.xgb_30 = (
            XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, objective="binary:logistic", eval_metric="logloss", random_state=42)
            if XGBClassifier
            else None
        )
        self.xgb_reg = (
            XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.05, objective="reg:squarederror", random_state=42)
            if XGBRegressor
            else None
        )

        self.is_trained = False
        self.feature_names: List[str] = []

    def _safe_num(self, value: Any, default: float = 0.0) -> float:
        """Convert to finite float."""
        try:
            num = float(value)
            if np.isnan(num) or np.isinf(num):
                return default
            return num
        except Exception:
            return default

    def build_feature_frame(self, feature_frame: pd.DataFrame, fundamentals: Dict[str, Any]) -> pd.DataFrame:
        """Create model-ready feature frame with lagged and rolling features."""
        df = feature_frame.copy()

        df["ma50_dist"] = (df["Close"] - df["ma_50"]) / df["ma_50"].replace(0, np.nan) * 100
        df["ma200_dist"] = (df["Close"] - df["ma_200"]) / df["ma_200"].replace(0, np.nan) * 100
        df["atr_pct"] = df["atr"] / df["Close"].replace(0, np.nan) * 100

        for lag in range(1, 6):
            df[f"ret_lag_{lag}"] = df["ret_1d"].shift(lag)

        df["rolling_vol_5d"] = df["ret_1d"].rolling(5).std()
        df["rolling_vol_20d"] = df["ret_1d"].rolling(20).std()
        df["rolling_ret_mean_5d"] = df["ret_1d"].rolling(5).mean()

        pe = self._safe_num(fundamentals.get("pe_ratio"), 20.0)
        roe = self._safe_num(fundamentals.get("roe"), 0.12)
        debt = self._safe_num(fundamentals.get("debt_to_equity"), 0.8)
        rev = self._safe_num(fundamentals.get("revenue_growth"), 0.06)
        margin = self._safe_num(fundamentals.get("profit_margin"), 0.08)
        mcap = self._safe_num(fundamentals.get("market_cap"), 1e10)

        df["pe_ratio_norm"] = np.log1p(max(pe, 0.0))
        df["roe_norm"] = roe * 100 if roe <= 1 else roe
        df["debt_eq_norm"] = debt
        df["rev_growth_norm"] = rev * 100 if rev <= 1 else rev
        df["profit_margin_norm"] = margin * 100 if margin <= 1 else margin
        df["market_cap_log"] = np.log1p(max(mcap, 1.0))

        df["direction_7d"] = (df["Close"].shift(-7) > df["Close"]).astype(int)
        df["direction_30d"] = (df["Close"].shift(-30) > df["Close"]).astype(int)
        df["price_change_7d"] = (df["Close"].shift(-7) - df["Close"]) / df["Close"].replace(0, np.nan) * 100

        return df

    def feature_columns(self) -> List[str]:
        """Return canonical model feature columns."""
        return [
            "rsi",
            "macd",
            "macd_histogram",
            "bb_percent",
            "ma50_dist",
            "ma200_dist",
            "volume_ratio",
            "atr_pct",
            "ret_1d",
            "ret_5d",
            "ret_30d",
            "golden_cross",
            "pe_ratio_norm",
            "roe_norm",
            "debt_eq_norm",
            "rev_growth_norm",
            "profit_margin_norm",
            "market_cap_log",
            "ret_lag_1",
            "ret_lag_2",
            "ret_lag_3",
            "ret_lag_4",
            "ret_lag_5",
            "rolling_vol_5d",
            "rolling_vol_20d",
            "rolling_ret_mean_5d",
        ]

    def train(self, feature_frame: pd.DataFrame, fundamentals: Dict[str, Any]) -> None:
        """Train ensemble models and persist artifacts."""
        data = self.build_feature_frame(feature_frame, fundamentals)
        cols = self.feature_columns()

        train_df = data.dropna(subset=cols + ["direction_7d", "direction_30d", "price_change_7d"]).copy()
        if len(train_df) < 120:
            raise ValueError("Not enough data to train models")

        train_df["golden_cross"] = train_df["golden_cross"].astype(int)
        X = train_df[cols].astype(float)
        y7 = train_df["direction_7d"].astype(int)
        y30 = train_df["direction_30d"].astype(int)
        yreg = train_df["price_change_7d"].astype(float)

        Xs = self.scaler.fit_transform(X)

        self.rf_7.fit(Xs, y7)
        self.rf_30.fit(Xs, y30)
        self.rf_reg.fit(Xs, yreg)

        if self.xgb_7:
            self.xgb_7.fit(Xs, y7)
        if self.xgb_30:
            self.xgb_30.fit(Xs, y30)
        if self.xgb_reg:
            self.xgb_reg.fit(Xs, yreg)

        self.feature_names = cols
        self.is_trained = True
        self._save()

    def _save(self) -> None:
        """Persist model artifacts to disk."""
        try:
            joblib.dump(
                {
                    "scaler": self.scaler,
                    "rf_7": self.rf_7,
                    "rf_30": self.rf_30,
                    "rf_reg": self.rf_reg,
                    "xgb_7": self.xgb_7,
                    "xgb_30": self.xgb_30,
                    "xgb_reg": self.xgb_reg,
                    "feature_names": self.feature_names,
                },
                MODEL_DIR / "stock_predictor.joblib",
            )
        except Exception:
            return

    def load(self) -> bool:
        """Load model artifacts from disk if available."""
        path = MODEL_DIR / "stock_predictor.joblib"
        if not path.exists():
            return False

        try:
            blob = joblib.load(path)
            self.scaler = blob["scaler"]
            self.rf_7 = blob["rf_7"]
            self.rf_30 = blob["rf_30"]
            self.rf_reg = blob["rf_reg"]
            self.xgb_7 = blob.get("xgb_7")
            self.xgb_30 = blob.get("xgb_30")
            self.xgb_reg = blob.get("xgb_reg")
            self.feature_names = blob.get("feature_names", self.feature_columns())
            self.is_trained = True
            return True
        except Exception:
            return False

    def _ensemble_prob(self, Xs: np.ndarray, rf_model: RandomForestClassifier, xgb_model: Any) -> float:
        """Return ensemble class-1 probability."""
        probs = [rf_model.predict_proba(Xs)[0][1]]
        if xgb_model is not None:
            probs.append(float(xgb_model.predict_proba(Xs)[0][1]))
        return float(np.mean(probs))

    def _ensemble_reg(self, Xs: np.ndarray) -> float:
        """Return ensemble regression output for 7-day change."""
        preds = [float(self.rf_reg.predict(Xs)[0])]
        if self.xgb_reg is not None:
            preds.append(float(self.xgb_reg.predict(Xs)[0]))
        return float(np.mean(preds))

    def predict(self, feature_frame: pd.DataFrame, fundamentals: Dict[str, Any], current_price: float) -> Dict[str, Any]:
        """Return 7d/30d directional and 7d price change predictions."""
        if not self.is_trained and not self.load():
            self.train(feature_frame, fundamentals)

        data = self.build_feature_frame(feature_frame, fundamentals)
        cols = self.feature_names or self.feature_columns()

        latest = data.tail(1).copy()
        latest["golden_cross"] = latest["golden_cross"].astype(int)
        latest = latest.fillna(0)

        X = latest[cols].astype(float)
        Xs = self.scaler.transform(X)

        p7 = self._ensemble_prob(Xs, self.rf_7, self.xgb_7)
        p30 = self._ensemble_prob(Xs, self.rf_30, self.xgb_30)
        delta_7d = self._ensemble_reg(Xs)

        pred_price = float(current_price) * (1 + delta_7d / 100)
        confidence = int(round((abs(p7 - 0.5) * 2 * 100 + abs(p30 - 0.5) * 2 * 100) / 2))

        importances = getattr(self.rf_7, "feature_importances_", np.zeros(len(cols)))
        feature_importance = {
            cols[i]: round(float(importances[i]), 4)
            for i in range(len(cols))
        }

        return {
            "direction_7d": {
                "prediction": "UP" if p7 >= 0.5 else "DOWN",
                "probability": round(p7, 4),
            },
            "direction_30d": {
                "prediction": "UP" if p30 >= 0.5 else "DOWN",
                "probability": round(p30, 4),
            },
            "predicted_price_7d": round(pred_price, 2),
            "price_change_pct_7d": round(delta_7d, 2),
            "confidence": confidence,
            "feature_importance": feature_importance,
        }
