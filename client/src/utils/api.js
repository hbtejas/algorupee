/** Axios API client and endpoint wrappers for backend communication. */

import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/";

export const api = axios.create({
  baseURL,
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Extract API error message safely.
 * @param {any} error
 * @returns {string}
 */
export function getApiError(error) {
  if (error?.code === "ECONNABORTED") {
    return "Request timed out. Live provider is slow, please retry.";
  }
  const message = error?.response?.data?.error || error?.message || "Request failed";
  if (String(message).toLowerCase().includes("ml engine unavailable")) {
    return "Live AI engine is warming up. Showing fallback data.";
  }
  return message;
}

export const authApi = {
  register: (payload) => api.post("/api/auth/register", payload),
  login: (payload) => api.post("/api/auth/login", payload),
  me: () => api.get("/api/auth/me"),
};

export const analysisApi = {
  analyze: (payload) => api.post("/api/analysis/analyze", payload, { timeout: 90000 }),
  priceHistory: (symbol, period = "1y") => api.get(`/api/analysis/price-history/${symbol}?period=${period}`, { timeout: 60000 }),
  search: (q) => api.get(`/api/analysis/search?q=${encodeURIComponent(q)}`),
  backtest: (payload) => api.post("/api/backtest/run", payload, { timeout: 90000 }),
  marketOverview: () => api.get("/api/market/overview"),
  quote: (symbol) => api.get(`/api/market/quote/${encodeURIComponent(symbol)}`, { timeout: 30000 }),
  marketHeatmap: async (index = "nifty50") => {
    const query = `index=${encodeURIComponent(index)}`;
    try {
      return await api.get(`/api/market/heatmap?${query}`, { timeout: 90000 });
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const message = String(error?.response?.data?.error || "").toLowerCase();
      const looksLikeMissingRoute = status === 404 || message.includes("route not found") || message.includes("not found");
      if (!looksLikeMissingRoute) {
        throw error;
      }
      // Backward-compatibility fallback for older gateway route names.
      return api.get(`/api/heatmap?${query}`, { timeout: 90000 });
    }
  },
  sectorOverview: () => api.get("/api/sector/overview", { timeout: 60000 }),
  sectorHeatmap: () => api.get("/api/sector/heatmap", { timeout: 60000 }),
  sectorRotation: () => api.get("/api/sector/rotation", { timeout: 60000 }),
  sectorCompare: (sectors) => api.get(`/api/sector/compare?sectors=${encodeURIComponent((sectors || []).join(","))}`, { timeout: 60000 }),
  sectorDetail: (sectorName) => api.get(`/api/sector/${encodeURIComponent(sectorName)}`, { timeout: 60000 }),
  sectorTopStocks: (sectorName, limit = 10, sortBy = "score") =>
    api.get(`/api/sector/${encodeURIComponent(sectorName)}/top-stocks?limit=${encodeURIComponent(limit)}&sort_by=${encodeURIComponent(sortBy)}`, {
      timeout: 60000,
    }),
  sectorLookup: (symbol) => api.get(`/api/sector/lookup/${encodeURIComponent(symbol)}`, { timeout: 60000 }),
  sectorRefresh: () => api.post("/api/sector/refresh", {}, { timeout: 60000 }),
};

export const portfolioApi = {
  list: () => api.get("/api/portfolio"),
  add: (payload) => api.post("/api/portfolio/add", payload),
  remove: (id) => api.delete(`/api/portfolio/${id}`),
  summary: () => api.get("/api/portfolio/summary"),
  optimize: () => api.get("/api/portfolio/optimize"),
};

export const alertsApi = {
  list: () => api.get("/api/alerts"),
  create: (payload) => api.post("/api/alerts/create", payload),
  remove: (id) => api.delete(`/api/alerts/${id}`),
};
