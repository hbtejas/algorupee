"""Flask routes for running strategy backtests."""

from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request

from data.collector import DataManager
from features.engineer import TechnicalAnalyzer
from utils.backtester import Backtester

backtest_bp = Blueprint("backtest", __name__, url_prefix="/api/backtest")


data_manager = DataManager()
technical_analyzer = TechnicalAnalyzer()
backtester = Backtester()


@backtest_bp.route("/run", methods=["POST"])
def run_backtest():
    """Run backtest for selected symbol and strategy/date range."""
    try:
        body = request.get_json(silent=True) or {}
        symbol = str(body.get("symbol", "")).strip().upper()
        strategy = str(body.get("strategy", "Score-Based")).strip()
        start_date = body.get("startDate")
        end_date = body.get("endDate")
        initial_capital = float(body.get("initialCapital", 100000))

        if not symbol:
            return jsonify({"error": "symbol is required"}), 400

        price_df = data_manager.yahoo.get_historical_data(symbol=symbol, period="2y")
        if price_df.empty:
            return jsonify({"error": "No historical data found"}), 404

        if start_date:
            sd = datetime.fromisoformat(start_date)
            price_df = price_df[price_df.index >= sd]
        if end_date:
            ed = datetime.fromisoformat(end_date)
            price_df = price_df[price_df.index <= ed]

        if price_df.empty:
            return jsonify({"error": "No data in selected date range"}), 404

        tech_result = technical_analyzer.analyze(price_df)
        frame = tech_result["feature_frame"]

        result = backtester.run(
            symbol=symbol,
            frame=frame,
            strategy=strategy,
            initial_capital=initial_capital,
        )
        return jsonify(result), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"backtest failed: {exc}"}), 500
