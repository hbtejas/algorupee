import React, { createContext, useContext } from 'react';
import { useBackendHealth } from '../hooks/useBackendHealth';

const HealthContext = createContext({ online: true, checking: false, retry: () => {} });

export function HealthProvider({ children }) {
  const health = useBackendHealth();
  return (
    <HealthContext.Provider value={health}>
      {children}
    </HealthContext.Provider>
  );
}

export const useHealth = () => useContext(HealthContext);
