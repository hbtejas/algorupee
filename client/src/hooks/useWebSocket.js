import { useEffect, useMemo, useState } from "react";
import { socket } from "../utils/socket";

/**
 * Connect to backend websocket and track connection state.
 * @returns {{connected: boolean, socketId: string}}
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState(socket.id || "");

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setSocketId(socket.id || "");
    };
    const onDisconnect = () => {
      setConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // Initial state
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
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
        if (!socket || !symbol || typeof onUpdate !== "function") {
          return () => {};
        }
        const normalized = String(symbol).toUpperCase();
        const eventName = `score:update:${normalized}`;
        socket.emit("subscribe:score", { symbol: normalized });
        socket.on(eventName, onUpdate);
        return () => {
          socket.off(eventName, onUpdate);
          socket.emit("unsubscribe:score", { symbol: normalized });
        };
      },
    }),
    [connected, socketId]
  );

  return api;
}
