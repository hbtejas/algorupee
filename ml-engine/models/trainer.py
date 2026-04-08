"""Training pipeline for validating the stock prediction feature set."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover
    XGBClassifier = None

from models.predictor import StockPredictor


class ModelTrainer:
    """Runs time-series cross-validation and returns training diagnostics."""

    def __init__(self):
        self.predictor = StockPredictor()

    def train_with_cv(self, feature_frame: pd.DataFrame, fundamentals: Dict[str, Any]) -> Dict[str, Any]:
        """Train models and evaluate with TimeSeriesSplit(n_splits=5)."""
        engineered = self.predictor.build_feature_frame(feature_frame, fundamentals)
        cols = self.predictor.feature_columns()

        dataset = engineered.dropna(subset=cols + ["direction_7d"]).copy()
        if len(dataset) < 180:
            raise ValueError("Insufficient rows for robust cross-validation")

        dataset["golden_cross"] = dataset["golden_cross"].astype(int)
        X = dataset[cols].astype(float).values
        y = dataset["direction_7d"].astype(int).values

        tscv = TimeSeriesSplit(n_splits=5)
        fold_scores = []

        for train_idx, test_idx in tscv.split(X):
            try:
                X_train, X_test = X[train_idx], X[test_idx]
                y_train, y_test = y[train_idx], y[test_idx]

                scaler = StandardScaler()
                X_train_s = scaler.fit_transform(X_train)
                X_test_s = scaler.transform(X_test)

                rf = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42)
                rf.fit(X_train_s, y_train)
                rf_prob = rf.predict_proba(X_test_s)[:, 1]

                if XGBClassifier:
                    xgb = XGBClassifier(
                        n_estimators=200,
                        max_depth=6,
                        learning_rate=0.05,
                        objective="binary:logistic",
                        eval_metric="logloss",
                        random_state=42,
                    )
                    xgb.fit(X_train_s, y_train)
                    xgb_prob = xgb.predict_proba(X_test_s)[:, 1]
                    ensemble_prob = (rf_prob + xgb_prob) / 2
                else:
                    ensemble_prob = rf_prob

                preds = (ensemble_prob >= 0.5).astype(int)
                fold_scores.append(float(accuracy_score(y_test, preds)))
            except Exception:
                continue

        self.predictor.train(feature_frame, fundamentals)

        return {
            "fold_accuracies": [round(s, 4) for s in fold_scores],
            "mean_accuracy": round(float(np.mean(fold_scores)) if fold_scores else 0.0, 4),
            "trained": True,
        }
