/** Real-time sector overview hook with Socket.IO updates and change tracking. */

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { analysisApi, getApiError } from "../utils/api";

/**
 * Resolve socket server URL for local/dev/prod deployments.
 * @returns {string}
 */
function resolveSocketUrl() {
  const wsUrl = String(import.meta.env.VITE_WS_URL || "").trim();
  if (wsUrl) {
    return wsUrl;
  }

  const apiUrl = String(import.meta.env.VITE_API_URL || "").trim();
  if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
    return apiUrl;
  }

  return window.location.origin;
}

/**
 * Compare old/new sector scores and return changed names.
 * @param {any[]} prev
 * @param {any[]} next
 * @returns {string[]}
 */
function diffChangedSectors(prev, next) {
  const prevMap = new Map((prev || []).map((s) => [String(s.sector_name || s.name), Number(s.composite_score || 0)]));
  const out = [];
  for (const item of next || []) {
    const name = String(item.sector_name || item.name || "");
    const curr = Number(item.composite_score || 0);
    const before = prevMap.get(name);
    if (before == null || Math.abs(curr - before) >= 0.2) {
      out.push(name);
    }
  }
  return out;
}

/**
 * Fetch and stream sector overview in real time.
 * @returns {{sectors:any[], loading:boolean, error:string, lastUpdated:string, isMarketOpen:boolean, changedSectors:string[], reconnecting:boolean, autoRefresh:boolean, setAutoRefresh:(v:boolean)=>void, refreshNow:()=>Promise<void>, sectorIndices:any}}
 */
export function useRealtimeSectors() {
  const [sectors, setSectors] = useState([]);
  const [sectorIndices, setSectorIndices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [changedSectors, setChangedSectors] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const socketRef = useRef(null);
  const clearChangedTimerRef = useRef(null);
  const sectorsRef = useRef([]);
  const autoRefreshRef = useRef(true);

  useEffect(() => {
    sectorsRef.current = sectors;
  }, [sectors]);

  useEffect(() => {
    autoRefreshRef.current = autoRefresh;
  }, [autoRefresh]);

  /**
   * Load sector overview once.
   * @returns {Promise<void>}
   */
  async function refreshNow() {
    try {
      setError("");
      const { data } = await analysisApi.sectorOverview();
      const next = Array.isArray(data?.sectors) ? data.sectors : [];
      setChangedSectors(diffChangedSectors(sectorsRef.current, next));
      setSectors(next);
      setSectorIndices(data?.sector_indices || {});
      setIsMarketOpen(Boolean(data?.market_open));
      setLastUpdated(data?.last_updated || new Date().toISOString());
    } catch (err) {
      const msg = String(getApiError(err) || "");
      if (msg.toLowerCase().includes("route not found")) {
        setError("Sector API is starting up. Retrying automatically...");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshNow();
  }, []);

  useEffect(() => {
    if (clearChangedTimerRef.current) {
      clearTimeout(clearChangedTimerRef.current);
    }
    if (!changedSectors.length) {
      return;
    }
    clearChangedTimerRef.current = setTimeout(() => {
      setChangedSectors([]);
    }, 1600);
    return () => {
      if (clearChangedTimerRef.current) {
        clearTimeout(clearChangedTimerRef.current);
      }
    };
  }, [changedSectors]);

  useEffect(() => {
    const url = resolveSocketUrl();
    const socket = io(url, { transports: ["websocket"], reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      setReconnecting(false);
    });

    socket.on("disconnect", () => {
      setReconnecting(true);
    });

    socket.on("sector_update", (payload) => {
      if (!payload || !autoRefreshRef.current) {
        return;
      }
      const next = Array.isArray(payload.sectors) ? payload.sectors : [];
      setChangedSectors((prev) => {
        const merged = new Set([...prev, ...diffChangedSectors(sectorsRef.current, next)]);
        return Array.from(merged);
      });
      setSectors(next);
      setSectorIndices(payload.sector_indices || {});
      setIsMarketOpen(Boolean(payload.market_open));
      setLastUpdated(payload.last_updated || payload.timestamp || new Date().toISOString());
      setError("");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return () => {};
    }

    const timer = setInterval(() => {
      refreshNow();
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    if (!error) {
      return () => {};
    }
    const retry = setTimeout(() => {
      refreshNow();
    }, 15000);
    return () => clearTimeout(retry);
  }, [error]);

  return useMemo(
    () => ({
      sectors,
      loading,
      error,
      lastUpdated,
      isMarketOpen,
      changedSectors,
      reconnecting,
      autoRefresh,
      setAutoRefresh,
      refreshNow,
      sectorIndices,
    }),
    [sectors, loading, error, lastUpdated, isMarketOpen, changedSectors, reconnecting, autoRefresh, sectorIndices]
  );
}
