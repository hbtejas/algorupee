/**
 * Centralized Socket.IO client instance with production-ready reconnection logic.
 */

import { io } from "socket.io-client";

/**
 * Resolve websocket endpoint with production fallback.
 * @returns {string}
 */
function resolveWebSocketUrl() {
  const envUrl = String(import.meta.env.VITE_WS_URL || "").trim();
  if (envUrl) {
    return envUrl;
  }

  const host = String(window.location.host || "").toLowerCase();
  if (host.endsWith("vercel.app")) {
    return "https://algorupee-backend.onrender.com";
  }

  return window.location.origin;
}

const WS_URL = resolveWebSocketUrl();

// 1. Create socket instance with reconnection options
export const socket = io(WS_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 10000,
  transports: ["websocket"],
});

// Logging and global event handling
socket.on("connect_error", (err) => {
  console.warn("WS error:", err.message);
});

socket.on("disconnect", (reason) => {
  if (reason === "io server disconnect") {
    // If the server disconnected explicitly, we need to manually reconnect
    socket.connect();
  }
});
