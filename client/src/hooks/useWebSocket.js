/** Hook for WebSocket connection status from server Socket.IO endpoint. */

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

/**
 * Connect to backend websocket and track connection state.
 * @returns {{connected: boolean, socketId: string}}
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || "/";
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
