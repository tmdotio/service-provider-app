import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import api from "../api/axios";
import useAuth from "../hooks/useAuth";
import { useSocketEvent } from "../hooks/useChat";
import { timeAgo } from "../utils/format";

const POLL_MS = 30000;

// Notifications a provider gets about their own jobs (older ones have no "side")
const PROVIDER_TYPES = ["booking_created", "booking_cancelled", "booking_no_show", "review_received"];
// Which tab of the provider's Workspace / customer's Bookings to open
// (a cancelled booking is not listed anywhere, so that one opens the default view)
const PROVIDER_TAB = { booking_created: "requests", booking_no_show: "history" };
const CUSTOMER_PAST = ["booking_completed", "booking_rejected"];

/** Where to go when a notification is clicked. */
const linkFor = (n, role) => {
  if (n.type.startsWith("booking_") || n.type === "review_received") {
    const side = n.data?.side || (role === "provider" && PROVIDER_TYPES.includes(n.type) ? "provider" : "customer");
    if (side === "provider") {
      if (n.type === "review_received") return "/provider?section=reviews";
      if (n.type === "booking_cancelled") return "/provider?section=jobs";
      return `/provider?section=jobs&tab=${PROVIDER_TAB[n.type] || "active"}`;
    }
    if (n.type === "booking_cancelled") return "/bookings";
    return `/bookings?tab=${CUSTOMER_PAST.includes(n.type) ? "past" : "active"}`;
  }
  if (n.type === "post_removed") return "/feed";
  if (n.type.startsWith("post_") || n.type === "comment_replied") {
    if (!n.data?.post) return "/feed";
    return `/posts/${n.data.post}${n.data.comment ? `?comment=${n.data.comment}` : ""}`;
  }
  if (n.type.startsWith("provider_")) return role === "provider" ? "/provider" : "/account";
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

  // New notifications arrive live over the socket (polling stays as a backup)
  useSocketEvent(
    "notification:new",
    useCallback((n) => {
      setItems((list) => [n, ...list.filter((x) => x._id !== n._id)].slice(0, 10));
      setUnread((u) => u + 1);
    }, []),
  );

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
        className="icon-btn relative h-10 w-10"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 z-40 mt-3 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[24px] shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-bold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-accent hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul data-lenis-prevent className="max-h-96 overflow-y-auto overscroll-contain">
            {items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted">No notifications yet</li>
            )}
            {items.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 border-b border-line px-5 py-3.5 text-left text-sm transition hover:bg-surface-2 ${
                    n.isRead ? "text-muted" : "font-semibold text-fg"
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-accent"}`} />
                  <span>
                    <span className="block">{n.message}</span>
                    <span className="mt-1 block text-xs font-normal text-muted">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
