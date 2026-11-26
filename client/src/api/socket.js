import { io } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "./axios";

/**
 * One Socket.IO connection for the whole app (live chat).
 *
 * - Same origin by default: Vite forwards /socket.io to the API in
 *   development. Set VITE_SOCKET_URL when the API lives elsewhere.
 * - Sends the in-memory access token. The token lives 15 minutes, so
 *   when the server says "unauthorized" we refresh it once and retry.
 */
export const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => cb({ token: getAccessToken() }),
});

let refreshing = false;

socket.on("connect", () => {
  refreshing = false;
});

socket.on("connect_error", async (err) => {
  if (err.message !== "unauthorized" || refreshing || !getAccessToken()) return;
  refreshing = true;
  try {
    await refreshAccessToken();
    socket.connect();
  } catch {
    // logged out: the app will disconnect us
  }
});

/** Send with an acknowledgement, failing after a timeout. */
export const emitWithAck = (event, data, ms = 8000) =>
  new Promise((resolve, reject) => {
    socket.timeout(ms).emit(event, data, (err, res) => {
      if (err) reject(new Error("The server did not answer. Check your connection."));
      else if (!res?.ok) reject(new Error(res?.message || "Something went wrong"));
      else resolve(res);
    });
  });
