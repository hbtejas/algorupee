# Deployment Guide: Production AI Stock Analyzer

Follow these steps to deploy the Stock Analyzer platform to production using Render, MongoDB Atlas, and Vercel.

## 1. Deploy the backend to Render (free tier)

Step-by-step for deploying both server/ (Node) and ml-engine/ (Python Flask) to Render.com:

### **API Gateway (Node.js)**
1. Create a "Web Service” for `server/`.
2. Environment: **Node 20**.
3. Build Command: `npm install`.
4. Start Command: `node index.js`.
5. Add required environment variables:
   - `PORT`: 5000
   - `MONGODB_URI`: (From Step 2)
   - `JWT_SECRET`: (Generate a long random string)
   - `ML_ENGINE_URL`: (URL of your deployed ML engine)
   - `REDIS_URL`: (Optional, use Upstash or similar if needed)
   - `ALLOWED_ORIGINS`: `https://algoink.vercel.app,https://your-app.vercel.app`

### **ML Engine (Python Flask)**
1. Create a "Web Service” for `ml-engine/`.
2. Environment: **Python 3.11**.
3. Build Command: `pip install -r requirements.txt`.
4. Start Command: `gunicorn app:app`.
5. Add required environment variables:
   - `ZERODHA_API_KEY`: your_kite_api_key
   - `ZERODHA_API_SECRET`: your_kite_api_secret
   - `NEWS_API_KEY`: get from newsapi.org
   - `ZERODHA_ACCESS_TOKEN`: (Manual fallback)

> [!NOTE]
> Render free tier services spin down after 15 minutes of inactivity. The first request after a spin-down may take 30-60 seconds.

## 2. Set up MongoDB Atlas (free)

1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Go to **Network Access** and whitelist `0.0.0.0/0` (required for Render's dynamic IPs).
3. Create a **Database User** with read/write access.
4. Copy the connection string and replace `<username>` and `<password>` with your user credentials.
5. Set this string as `MONGODB_URI` in the Render dashboard for the API Gateway.

## 3. Deploy frontend to Vercel

1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set the **Root Directory** to: `.` (the project root, NOT the `client/` folder).
3. Framework Preset: **Other**.
4. Set these required environment variables in Vercel:
   - `VITE_API_URL`: `/`
   - `BACKEND_API_URL`: `https://your-server-name.onrender.com`
   - `VITE_WS_URL`: `https://your-server-name.onrender.com` (Socket.IO uses this)
5. Deploy. The `vercel.json` in the root will handle proxying and routing.

## 4. Daily Zerodha token refresh

- Zerodha access tokens expire every day at midnight IST.
- To refresh: visit `https://your-backend.onrender.com/zerodha/login`.
- Complete the Kite Connect login flow.
- The new token is saved automatically to `zerodha_token.json` in the ML service.
- Without this, the app falls back to Yahoo Finance (delayed data).
