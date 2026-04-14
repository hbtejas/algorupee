/**
 * Centralized Socket.IO client instance with production-ready reconnection logic.
 */

import { io } from "socket.io-client";

// 2. VITE_WS_URL — must default to window.location.origin if not set
const WS_URL = (import.meta.env.VITE_WS_URL || window.location.origin).trim();

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
