"""Backtesting utilities for score and indicator-based strategies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import numpy as np
import pandas as pd


@dataclass
class Trade:
    """Represents one completed trade."""

    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float


class Backtester:
    """Simple event-driven backtester for stock strategies."""

    def run(
        self,
        symbol: str,
        frame: pd.DataFrame,
        strategy: str,
        initial_capital: float,
    ) -> Dict[str, Any]:
        """Run selected strategy and return portfolio metrics."""
        if frame.empty:
            raise ValueError("Cannot run backtest on empty dataset")

        strategy_name = (strategy or "Score-Based").strip()
        cash = float(initial_capital)
        shares = 0.0
        in_position = False

        equity_curve = []
        trades: List[Trade] = []
        entry_price = 0.0
        entry_date = ""

        benchmark_shares = initial_capital / float(frame.iloc[0]["Close"]) if float(frame.iloc[0]["Close"]) > 0 else 0
        benchmark_curve = []
        buy_signals = 0
        sell_signals = 0

        for idx, row in frame.iterrows():
            close = float(row["Close"])
            signal, score_value = self._signal(strategy_name, row)

            if signal == 1 and not in_position:
                shares = cash / close if close > 0 else 0
                entry_price = close
                entry_date = idx.strftime("%Y-%m-%d")
                cash = 0.0
                in_position = True
                buy_signals += 1
            elif signal == -1 and in_position:
                cash = shares * close
                pnl = (close - entry_price) * shares
                trades.append(
                    Trade(
                        entry_date=entry_date,
                        exit_date=idx.strftime("%Y-%m-%d"),
                        entry_price=entry_price,
                        exit_price=close,
                        quantity=shares,
                        pnl=pnl,
                    )
                )
                shares = 0.0
                in_position = False
                sell_signals += 1

            equity = cash + shares * close
            benchmark_equity = benchmark_shares * close
            equity_curve.append(
                {
                    "date": idx.strftime("%Y-%m-%d"),
                    "equity": round(equity, 2),
                    "close": round(close, 2),
                    "signal": signal,
                    "score": score_value,
                }
            )
            benchmark_curve.append({"date": idx.strftime("%Y-%m-%d"), "benchmark_equity": round(benchmark_equity, 2)})

        final_value = equity_curve[-1]["equity"]
        total_return = ((final_value - initial_capital) / initial_capital) * 100

        eq = pd.Series([p["equity"] for p in equity_curve])
        returns = eq.pct_change().fillna(0)
        sharpe = float(np.sqrt(252) * returns.mean() / (returns.std() + 1e-9))

        rolling_max = eq.cummax()
        drawdown = (eq - rolling_max) / rolling_max.replace(0, np.nan)
        max_drawdown = float(drawdown.min() * 100)

        wins = [t for t in trades if t.pnl > 0]
        win_rate = (len(wins) / len(trades) * 100) if trades else 0.0

        return {
            "symbol": symbol.upper(),
            "strategy": strategy_name,
            "initial_capital": initial_capital,
            "final_value": round(float(final_value), 2),
            "total_return_pct": round(float(total_return), 2),
            "sharpe_ratio": round(float(sharpe), 2),
            "max_drawdown_pct": round(float(max_drawdown), 2),
            "win_rate_pct": round(float(win_rate), 2),
            "trade_count": len(trades),
            "signal_counts": {"buy": buy_signals, "sell": sell_signals},
            "trades": [
                {
                    "entry_date": t.entry_date,
                    "exit_date": t.exit_date,
                    "entry_price": round(t.entry_price, 2),
                    "exit_price": round(t.exit_price, 2),
                    "quantity": round(t.quantity, 2),
                    "pnl": round(t.pnl, 2),
                }
                for t in trades
            ],
            "equity_curve": equity_curve,
            "benchmark_curve": benchmark_curve,
        }

    def _signal(self, strategy: str, row: pd.Series) -> tuple[int, int]:
        """Return (signal, score_value) where signal is buy/sell/hold."""
        strat = (strategy or "Score-Based").strip().lower()

        if strat == "rsi mean reversion":
            if float(row.get("rsi", 50)) < 30:
                return 1, 0
            if float(row.get("rsi", 50)) > 70:
                return -1, 0
            return 0, 0

        if strat == "macd crossover":
            if float(row.get("macd", 0)) > float(row.get("macd_signal", 0)):
                return 1, 0
            if float(row.get("macd", 0)) < float(row.get("macd_signal", 0)):
                return -1, 0
            return 0, 0

        score = 0
        score += 1 if float(row.get("rsi", 50)) < 45 else 0
        score += 1 if float(row.get("macd_histogram", 0)) > 0 else 0
        score += 1 if bool(row.get("golden_cross", False)) else 0

        if score >= 2:
            return 1, score
        if score == 0:
            return -1, score
        return 0, score
