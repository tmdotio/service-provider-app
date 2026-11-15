import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import api from "../api/axios";
import useAuth from "../hooks/useAuth";
import { timeAgo } from "../utils/format";

const POLL_MS = 30000;

/** Where to go when a notification is clicked. */
const linkFor = (n, role) => {
  if (n.type.startsWith("booking_") || n.type === "review_received") {
    return role === "provider" ? "/provider" : "/bookings";
  }
  if (n.type.startsWith("post_")) return "/feed";
  if (n.type.startsWith("provider_")) return role === "provider" ? "/provider" : "/become-provider";
  return "/";
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/notifications", { params: { limit: 10 } });
      setItems(res.data.notifications);
      setUnread(res.data.unreadCount);
    } catch {
      // ignore: the bell is not critical
    }
  }, []);

  // Check for new notifications every 30 seconds
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllRead = async () => {
    await api.patch("/notifications/read-all");
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      api.patch(`/notifications/${n._id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    }
    navigate(linkFor(n, user?.role));
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="btn-ghost relative p-2"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet</li>
            )}
            {items.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => openItem(n)}
                  className={`w-full border-b px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                    n.isRead ? "text-gray-600" : "bg-brand-50/60 font-medium text-gray-900"
                  }`}
                >
                  <p>{n.message}</p>
                  <p className="mt-1 text-xs font-normal text-gray-400">{timeAgo(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
