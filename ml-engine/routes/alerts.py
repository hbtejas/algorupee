"""Flask routes for evaluating alert trigger conditions from analysis output."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

alerts_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


@alerts_bp.route("/evaluate", methods=["POST"])
def evaluate_alert():
    """Evaluate whether a given alert should trigger for current analysis."""
    try:
        body = request.get_json(silent=True) or {}
        alert_type = body.get("type")
        threshold = body.get("threshold")
        analysis = body.get("analysis") or {}

        if not alert_type or threshold is None:
            return jsonify({"error": "type and threshold are required"}), 400

        current_price = float(analysis.get("current_price", 0))
        final_score = float((analysis.get("recommendation") or {}).get("final_score", 0))

        triggered = False
        if alert_type == "PRICE_ABOVE":
            triggered = current_price > float(threshold)
        elif alert_type == "PRICE_BELOW":
            triggered = current_price < float(threshold)
        elif alert_type == "SCORE_BUY":
            triggered = final_score >= float(threshold)
        elif alert_type == "SCORE_SELL":
            triggered = final_score <= float(threshold)
        else:
            return jsonify({"error": "Invalid alert type"}), 400

        return jsonify({"triggered": triggered}), 200
    except Exception as exc:
        return jsonify({"error": f"alert evaluation failed: {exc}"}), 500
