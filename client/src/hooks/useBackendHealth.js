import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

/**
 * Hook to track backend health by pinging /api/health.
 * Returns { online, checking, retry }
 */
export function useBackendHealth() {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      // 1. On mount, ping GET /api/health
      await api.get('/health', { timeout: 5000 });
      // 3. On recovery, set online = true
      setOnline(true);
    } catch (error) {
      // 2. On first check failure, set online = false
      setOnline(false);
    } finally {
      setChecking(false);
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
