import os
import json
import logging
from datetime import datetime, timedelta
from kiteconnect import KiteConnect

logger = logging.getLogger(__name__)

TOKEN_FILE = os.path.join(os.path.dirname(__file__), "zerodha_token.json")

def get_access_token():
    """
    Retrieves the Zerodha access token with daily expiry logic.
    1. Reads from zerodha_token.json
    2. Validates 23-hour window
    3. Falls back to env ZERODHA_ACCESS_TOKEN
    """
    token_data = None
    
    # a. Reads zerodha_token.json if it exists
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r") as f:
                token_data = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read token file: {e}")

    # b. Checks if generated_at is within last 23 hours
    if token_data and "access_token" in token_data and "generated_at" in token_data:
        try:
            gen_at = datetime.fromisoformat(token_data["generated_at"])
            if datetime.now() - gen_at < timedelta(hours=23):
                # c. If valid, returns that token
                return token_data["access_token"]
        except (ValueError, TypeError):
            pass

    # d. Else falls back to env var ZERODHA_ACCESS_TOKEN
    env_token = os.getenv("ZERODHA_ACCESS_TOKEN")
    if env_token:
        return env_token

    # e. Logs warning if env var is also missing
    logger.warning("Zerodha access token is missing or expired. Please visit /zerodha/login.")
    return None

def save_access_token(token):
    """Saves the access token with current timestamp."""
    data = {
        "access_token": token,
        "generated_at": datetime.now().isoformat()
    }
    with open(TOKEN_FILE, "w") as f:
        json.dump(data, f)
    return data

def get_kite_client():
    """Returns a KiteConnect instance with the current access token."""
    api_key = os.getenv("ZERODHA_API_KEY")
    client = KiteConnect(api_key=api_key)
    token = get_access_token()
    if token:
        client.set_access_token(token)
    return client
