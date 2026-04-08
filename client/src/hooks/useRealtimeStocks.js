import { useEffect, useMemo, useRef, useState } from "react";
import { analysisApi, getApiError } from "../utils/api";

/**
 * Real-time stock table data for selected sector.
 * @param {string} sectorName
 * @param {number} limit
 * @returns {{stocks:any[], loading:boolean, error:string, lastUpdated:string, refreshNow:()=>Promise<void>}}
 */
export function useRealtimeStocks(sectorName, limit = 10) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const timerRef = useRef(null);

  async function refreshNow() {
    if (!sectorName) {
      setStocks([]);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const { data } = await analysisApi.sectorTopStocks(sectorName, limit);
      setStocks(Array.isArray(data?.stocks) ? data.stocks : []);
      setLastUpdated(data?.timestamp || new Date().toISOString());
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshNow();
  }, [sectorName, limit]);

  useEffect(() => {
    if (!sectorName) {
      return () => {};
    }
    timerRef.current = setInterval(() => {
      refreshNow();
    }, 60 * 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sectorName, limit]);

  return useMemo(
    () => ({ stocks, loading, error, lastUpdated, refreshNow }),
    [stocks, loading, error, lastUpdated]
  );
}
