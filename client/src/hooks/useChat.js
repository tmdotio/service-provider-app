import { useEffect, useSyncExternalStore } from "react";
import api from "../api/axios";
import { socket } from "../api/socket";

/*
 * Shared chat state that the navbar badge and the Messages page read:
 * the unread total and whether the socket is connected.
 */
let unread = 0;
let connected = false;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let timer = null;
/** Ask the server for the unread total (debounced: events come in bursts). */
export const refreshUnread = () => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const res = await api.get("/chats/unread-count");
      unread = res.data.unreadCount;
      notify();
    } catch {
      // not critical
    }
  }, 250);
};

export const resetChatState = () => {
  unread = 0;
  notify();
};

socket.on("connect", () => {
  connected = true;
  notify();
  refreshUnread();
});
socket.on("disconnect", () => {
  connected = false;
  notify();
});
socket.on("chat:message", refreshUnread);
socket.on("chat:read", refreshUnread);
socket.on("chat:closed", refreshUnread);

export const useChatUnread = () => useSyncExternalStore(subscribe, () => unread);
export const useSocketConnected = () => useSyncExternalStore(subscribe, () => connected);

/** Listen to a socket event while the component is on screen. */
export const useSocketEvent = (event, handler) => {
  useEffect(() => {
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [event, handler]);
};
