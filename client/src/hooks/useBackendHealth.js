import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';

/**
 * Hook to track backend health by pinging /api/health.
 * Returns { online, checking, retry }
 */
export function useBackendHealth() {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkHealth = useCallback(async () => {
    if (mountedRef.current) {
      setChecking(true);
    }
    try {
      await api.get('/api/health', { timeout: 5000 });
      if (mountedRef.current) {
        setOnline(true);
      }
    } catch (error) {
      if (mountedRef.current) {
        setOnline(false);
      }
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // 1. Every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { online, checking, retry: checkHealth };
}
