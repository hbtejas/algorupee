"""Flask application entrypoint for the ML analysis engine."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

from routes.alerts import alerts_bp
from routes.analysis import analysis_bp
from routes.backtest import backtest_bp
from routes.sector import sector_bp
from token_manager import get_kite_client, save_access_token
from kiteconnect import KiteConnect

load_dotenv()


def create_app() -> Flask:
    """Create and configure Flask app."""
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(analysis_bp)
    app.register_blueprint(backtest_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(sector_bp)

    # 1. Add route GET /zerodha/login
    @app.get("/zerodha/login")
    def zerodha_login():
        """Redirect user to KiteConnect login URL."""
        kite = KiteConnect(api_key=os.getenv("ZERODHA_API_KEY"))
        return jsonify({"login_url": kite.login_url()}), 200

    # 2. Add route GET /zerodha/callback
    @app.get("/zerodha/callback")
    def zerodha_callback():
        """Receive request_token and generate daily access_token."""
        import flask
        request_token = flask.request.args.get("request_token")
        if not request_token:
            return jsonify({"error": "request_token missing"}), 400
        
        try:
            kite = KiteConnect(api_key=os.getenv("ZERODHA_API_KEY"))
            session = kite.generate_session(
                request_token, 
                api_secret=os.getenv("ZERODHA_API_SECRET")
            )
            save_access_token(session["access_token"])
            return jsonify({
                "status": "ok", 
                "message": "Token saved successfully"
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.get("/health")
    def health():
        """Healthcheck endpoint."""
        return jsonify({"status": "ok", "service": "ml-engine"}), 200

    @app.errorhandler(404)
    def not_found(_):
        """Return JSON for unknown routes."""
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(500)
    def internal_error(_):
        """Return JSON for uncaught server errors."""
        return jsonify({"error": "Internal server error"}), 500

    return app


if __name__ == "__main__":
    flask_app = create_app()
    flask_app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5001")),
        debug=os.getenv("DEBUG", "false").lower() == "true",
    )
