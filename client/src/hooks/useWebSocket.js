/** Hook for WebSocket connection status from server Socket.IO endpoint. */

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

/**
 * Resolve socket server URL for local/dev/prod deployments.
 * @returns {string}
 */
function resolveSocketUrl() {
  const wsUrl = String(import.meta.env.VITE_WS_URL || "wss://algorupee-backend.onrender.com").trim();
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
 * Connect to backend websocket and track connection state.
 * @returns {{connected: boolean, socketId: string}}
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const url = resolveSocketUrl();
    let socketClient;

    try {
      socketClient = io(url, { transports: ["websocket"] });
      socketClient.on("connect", () => {
        setConnected(true);
        setSocketId(socketClient.id || "");
      });
      socketClient.on("disconnect", () => {
        setConnected(false);
      });
      setSocket(socketClient);
    } catch (error) {
      setConnected(false);
    }

    return () => {
      if (socketClient) socketClient.disconnect();
      setSocket(null);
    };
  }, []);

  const api = useMemo(
    () => ({
      connected,
      socketId,
      /**
       * Subscribe to score updates for a symbol.
       * @param {string} symbol
       * @param {(payload:any)=>void} onUpdate
       * @returns {() => void}
       */
      subscribeScore: (symbol, onUpdate) => {
        if (!socket || !symbol) {
          return () => {};
        }
        const normalized = String(symbol).toUpperCase();
        socket.emit("subscribe:score", { symbol: normalized });
        socket.on("score:update", onUpdate);
        return () => {
          socket.off("score:update", onUpdate);
          socket.emit("unsubscribe:score", { symbol: normalized });
        };
      },
    }),
    [connected, socketId, socket]
  );

  return api;
}
