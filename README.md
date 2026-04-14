# AlgoInk: AI-Powered Stock Analysis Platform

**Live Deployment:** [https://algoink.vercel.app/](https://algoink.vercel.app/)

Production-ready full-stack stock analysis platform with:
- React 18 + Vite + Tailwind frontend
- Node/Express API gateway for auth, portfolio, alerts, and ML proxy
- Python Flask ML engine for technical/fundamental/sentiment scoring and prediction
- MongoDB for user/portfolio/alerts data
- Redis for ML response caching

## 1. Project Structure

- client: React app
- server: Express API gateway
- ml-engine: Flask ML analysis engine
- api: Vercel serverless proxy functions

## 2. Setup Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB Atlas URI or local MongoDB
- Redis instance (optional but recommended)

## 3. Environment Variables

### ml-engine/.env

```env
ZERODHA_API_KEY=your_key_here
ZERODHA_ACCESS_TOKEN=your_token_here
NEWS_API_KEY=your_newsapi_key
PORT=5001
DEBUG=false
```

### server/.env

```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
ML_ENGINE_URL=http://localhost:5001
REDIS_URL=redis://localhost:6379
```

### client/.env

```env
VITE_API_URL=http://localhost:5000
```

## 4. Install and Run (Local)

### Recommended: One-command run from workspace root

From `D:\Beta`:

```bash
npm install
npm run install:all
npm run dev
```

This starts ML engine, API server, and frontend together.

Health check from `D:\Beta`:

```bash
npm run health
```

Expected:
- server=200
- ml=200
- client=200

### ML engine

```bash
cd ml-engine
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Server

```bash
cd server
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

## 5. Docker Startup

```bash
docker compose up --build
```

Services:
- client: http://localhost:3000
- server: http://localhost:5000
- ml-engine: http://localhost:5001
- mongodb: mongodb://localhost:27017

## 6. API Documentation

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Portfolio (protected)
- GET /api/portfolio
- POST /api/portfolio/add
- DELETE /api/portfolio/:id
- GET /api/portfolio/summary
- GET /api/portfolio/optimize

### Alerts (protected)
- GET /api/alerts
- POST /api/alerts/create
- DELETE /api/alerts/:id

### Analysis / Backtest (proxied by Node to Flask)
- POST /api/analysis/analyze
- GET /api/analysis/price-history/:symbol?period=1y
- GET /api/analysis/search?q=infosys
- POST /api/backtest/run

### Market Data
- GET /api/market/overview
- GET /api/market/quote/:symbol
- GET /api/market/heatmap?index=nifty50

### Sector Analysis
- GET /api/sector/overview
- GET /api/sector/rotation
- GET /api/sector/heatmap
- GET /api/sector/compare?sectors=IT,Banking
- GET /api/sector/lookup/:symbol
- GET /api/sector/:sectorName
- GET /api/sector/:sectorName/top-stocks
- POST /api/sector/refresh

## 7. Zerodha API Key Setup

1. Create a developer account on Zerodha Kite Connect.
2. Create an app and copy API key.
3. Generate access token after login flow.
4. Put values in ml-engine .env as ZERODHA_API_KEY and ZERODHA_ACCESS_TOKEN.
5. If missing, the system automatically falls back to yfinance.

## 8. NewsAPI Key Setup

1. Sign up at https://newsapi.org.
2. Copy your API key into NEWS_API_KEY in ml-engine .env.
3. If missing/unavailable, Google News RSS fallback is used.

## 9. Notes

- Risk disclaimer is shown across analysis-related views.
- JWT is required for portfolio and alerts routes.
- Redis caches analysis and price history responses for 5 minutes.

## 10. Vercel Deployment (Frontend + API Proxy)

Deploy from the `stock-analyzer` root directory:

### Option A: Deploy from project root (Recommended)

1. Push this repository to GitHub.
2. In Vercel, create a new project and set the **Root Directory** to `stock-analyzer`.
3. Build settings are auto-configured via `vercel.json`:
	- Install: `npm --prefix client install`
	- Build: `npm --prefix client run build`
	- Output: `client/dist`
4. Add these environment variables in Vercel:
	- `VITE_API_URL=/` (uses same-origin API proxy)
	- `BACKEND_API_URL=https://<your-backend-domain>` (where your Node server runs)
	- `VITE_WS_URL=https://<your-backend-domain>` (for WebSocket realtime features)
5. Deploy.

### Option B: Deploy client only

1. Set Root Directory to `stock-analyzer/client`.
2. Framework Preset: `Vite`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Add environment variables:
	- `VITE_API_URL=/`
	- `BACKEND_API_URL=https://<your-backend-domain>`
	- `VITE_WS_URL=https://<your-backend-domain>`

### How the API Proxy Works

The `api/proxy.js` Vercel serverless function forwards all `/api/*` requests to your backend. The `vercel.json` rewrites route `/api/(.*)` to `/api/proxy?path=$1`.

### Backend Deployment

The Node API server and Flask ML engine should run on:
- **Render** (recommended free tier)
- **Railway**
- **DigitalOcean App Platform**
- **AWS EC2 / GCP Compute**

Set `BACKEND_API_URL` in Vercel to your backend's public URL.
