# AI-Powered Stock Analysis System (MERN + Flask ML)

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

### Alerts (protected)
- GET /api/alerts
- POST /api/alerts/create
- DELETE /api/alerts/:id

### Analysis / Backtest (proxied by Node to Flask)
- POST /api/analysis/analyze
- GET /api/analysis/price-history/:symbol?period=1y
- GET /api/analysis/search?q=infosys
- POST /api/backtest/run

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

## 10. Vercel Deployment (Frontend)

Deploy the React app from `stock-analyzer/client` to Vercel.

1. Push this repository to GitHub.
2. In Vercel, create a new project and set the Root Directory to `stock-analyzer/client`.
3. Build settings:
	- Framework Preset: `Vite`
	- Build Command: `npm run build`
	- Output Directory: `dist`
4. Add environment variable in Vercel project:
	- `VITE_API_URL=/`
	- `BACKEND_API_URL=https://<your-backend-domain>`
5. Deploy.

The root `vercel.json` + `api/[...path].js` proxy setup forwards frontend `/api/*` calls to your backend origin.

Important:
- The frontend is Vercel-ready.
- The Node API server and Flask ML engine should run on a backend host (Render/Railway/VM/container) and be referenced via `VITE_API_URL`.
