import { ArrowLeft, Check, CheckCheck, Clock, Loader2, Lock, MessageCircle, Send, WifiOff } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import { emitWithAck, socket } from "../api/socket";
import { Avatar, StatusBadge } from "../components/ui";
import useAuth from "../hooks/useAuth";
import { useSocketConnected, useSocketEvent } from "../hooks/useChat";
import { timeAgo } from "../utils/format";

const MAX_LENGTH = 1000;
const TYPING_IDLE_MS = 2500;

const displayName = (other) => other?.businessName || other?.name || "Deleted user";

/** "Electrician · Fan makes noise…" — which booking a chat is about. */
const bookingLabel = (booking) =>
  [booking?.category?.name, booking?.description].filter(Boolean).join(" · ");

const ENDED_TEXT = {
  completed: "The job is complete",
  cancelled: "The booking was cancelled",
  rejected: "The booking was rejected",
  no_show: "The booking ended (no-show)",
};

const timeOf = (date) =>
  new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const dayOf = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

/** Add messages, skipping ones we already have (ack + live echo both arrive). */
const mergeMessages = (list, incoming) => {
  const byId = new Map(list.map((m) => [m._id, m]));
  for (const m of incoming) byId.set(m._id, { ...byId.get(m._id), ...m });
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

/* ------------------------------------------------------------------ */
/* Conversation list                                                   */
/* ------------------------------------------------------------------ */

function ConversationList({ conversations, activeId, myId, typingIn }) {
  if (!conversations) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl p-3">
            <div className="h-11 w-11 rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded-full bg-surface-2" />
              <div className="h-3 w-3/4 rounded-full bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <MessageCircle className="h-8 w-8 text-muted" />
        <p className="font-semibold">No chats yet</p>
        <p className="text-sm text-muted">
          Press “Message” on an open booking to start a private chat. It is deleted when the booking ends.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 p-2">
      {conversations.map((c) => {
        const mine = String(c.lastMessage?.sender) === String(myId);
        // The open chat is being read right now, so it never shows a badge
        const unread = c._id === activeId ? 0 : c.unread;
        return (
          <li key={c._id}>
            <Link
              to={`/messages/${c._id}`}
              className={`flex items-center gap-3 rounded-2xl p-3 transition ${
                c._id === activeId ? "bg-surface-2" : "hover:bg-surface-2/60"
              }`}
            >
              <Avatar user={c.other} size="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${unread ? "font-bold" : "font-semibold"}`}>{displayName(c.other)}</span>
                  {c.lastMessage?.createdAt && (
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessage.createdAt)}</span>
                  )}
                </div>
                {bookingLabel(c.booking) && (
                  <p className="truncate text-[11px] text-muted/80">{bookingLabel(c.booking)}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${unread ? "font-semibold text-fg" : "text-muted"}`}>
                    {typingIn.has(c._id) ? (
                      <span className="text-accent">typing…</span>
                    ) : c.lastMessage?.text ? (
                      `${mine ? "You: " : ""}${c.lastMessage.text}`
                    ) : (
                      "Say hello 👋"
                    )}
                  </span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-ink">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* One chat                                                            */
/* ------------------------------------------------------------------ */

function ChatWindow({ conversationId, conversation, myId, typing, onSeen }) {
  const connected = useSocketConnected();
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const keepOffset = useRef(null);
  const typingTimer = useRef(null);
  const typingSent = useRef(false);

  const other = conversation?.other;

  // Load the latest page when the chat opens
  useEffect(() => {
    // (the page remounts this component per chat, so state starts fresh)
    let active = true;
    api
      .get(`/chats/${conversationId}/messages`)
      .then((res) => {
        if (!active) return;
        setMessages(res.data.messages);
        setHasMore(res.data.hasMore);
      })
      .catch((err) => {
        if (active) {
          setMessages([]);
          toast.error(getErrorMessage(err));
        }
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  // Tell the server I have seen this chat (clears my badge, gives them ✓✓)
  const markSeen = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    if (socket.connected) socket.emit("chat:read", { conversationId });
    else api.patch(`/chats/${conversationId}/read`).catch(() => {});
    onSeen(conversationId);
  }, [conversationId, onSeen]);

  useEffect(() => {
    if (messages !== null) markSeen();
  }, [messages === null, markSeen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVisible = () => markSeen();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markSeen]);

  // Live: new messages and read receipts for this chat
  useSocketEvent(
    "chat:message",
    useCallback(
      ({ message }) => {
        if (String(message.conversation) !== String(conversationId)) return;
        setMessages((list) => mergeMessages(list || [], [message]));
        if (String(message.sender) !== String(myId)) markSeen();
      },
      [conversationId, myId, markSeen],
    ),
  );
  useSocketEvent(
    "chat:read",
    useCallback(
      ({ conversationId: id, readAt, by }) => {
        if (String(id) !== String(conversationId) || String(by) === String(myId)) return;
        setMessages((list) =>
          list?.map((m) => (String(m.sender) === String(myId) && !m.readAt && !m.pending ? { ...m, readAt } : m)),
        );
      },
      [conversationId, myId],
    ),
  );

  // Keep the view at the bottom for new messages; keep position when older ones load
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing]);

  const onScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!messages?.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await api.get(`/chats/${conversationId}/messages`, {
        params: { before: messages[0].createdAt },
      });
      keepOffset.current = scrollRef.current.scrollHeight - scrollRef.current.scrollTop;
      setMessages((list) => mergeMessages(list, res.data.messages));
      setHasMore(res.data.hasMore);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendTyping = (value) => {
    if (!socket.connected) return;
    if (value && !typingSent.current) {
      socket.emit("chat:typing", { conversationId, typing: true });
      typingSent.current = true;
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (typingSent.current) socket.emit("chat:typing", { conversationId, typing: false });
      typingSent.current = false;
    }, value ? TYPING_IDLE_MS : 0);
  };

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;

    // Show it right away, replace with the saved message when the server answers
    const tempId = `temp-${Date.now()}`;
    const temp = { _id: tempId, sender: myId, text: body, createdAt: new Date().toISOString(), pending: true };
    stickToBottom.current = true;
    setMessages((list) => [...(list || []), temp]);
    setText("");
    sendTyping("");

    try {
      const saved = socket.connected
        ? (await emitWithAck("chat:send", { conversationId, text: body })).message
        : (await api.post(`/chats/${conversationId}/messages`, { text: body })).data.message;
      setMessages((list) => mergeMessages(list.filter((m) => m._id !== tempId), [saved]));
    } catch (err) {
      setMessages((list) => list.map((m) => (m._id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error(err.response ? getErrorMessage(err) : err.message);
    }
  };

  const retry = (m) => {
    setMessages((list) => list.filter((x) => x._id !== m._id));
    setText(m.text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
        <Link to="/messages" className="icon-btn h-9 w-9 shrink-0 md:hidden" aria-label="Back to chats">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Avatar user={other} size="h-10 w-10" />
        <div className="min-w-0 flex-1">
          {other?.providerId ? (
            <Link to={`/providers/${other.providerId}`} className="block truncate font-semibold hover:text-accent">
              {displayName(other)}
            </Link>
          ) : (
            <p className="truncate font-semibold">{displayName(other)}</p>
          )}
          <p className="truncate text-xs text-muted">
            {typing ? (
              <span className="text-accent">typing…</span>
            ) : other?.role === "provider" ? (
              `Provider · ${other?.name || ""}`
            ) : (
              "Customer"
            )}
          </p>
        </div>
        {conversation?.booking?.status && <StatusBadge status={conversation.booking.status} />}
      </div>

      <p className="flex items-center gap-1.5 border-b border-line bg-surface-2/50 px-4 py-1.5 text-[11px] text-muted">
        <Lock className="h-3 w-3 shrink-0" />
        <span className="truncate">
          Private: only you and {other?.name || "them"} can see this. Deleted when the booking ends
          {bookingLabel(conversation?.booking) ? ` · ${bookingLabel(conversation.booking)}` : ""}.
        </span>
      </p>

      {!connected && (
        <p className="flex items-center justify-center gap-1.5 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
          <WifiOff className="h-3.5 w-3.5" /> Reconnecting… messages still send, live updates are paused
        </p>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-lenis-prevent
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        aria-live="polite"
      >
        {messages === null && (
          <div className="flex h-full items-center justify-center text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {hasMore && (
          <div className="mb-3 text-center">
            <button onClick={loadOlder} className="btn-outline h-8 px-3 text-xs" disabled={loadingOlder}>
              {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Older messages
            </button>
          </div>
        )}

        {messages?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Avatar user={other} size="h-14 w-14" />
            <p className="font-semibold">{displayName(other)}</p>
            <p className="max-w-xs text-sm text-muted">
              Ask about timing, price or directions for this booking. Only the two of you can read this chat, and
              it is deleted when the booking is finished.
            </p>
          </div>
        )}

        <div className="space-y-1">
          {messages?.map((m, i) => {
            const mine = String(m.sender) === String(myId);
            const prev = messages[i - 1];
            const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
            const grouped = prev && !newDay && String(prev.sender) === String(m.sender);
            return (
              <div key={m._id}>
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted">{dayOf(m.createdAt)}</span>
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "pt-1.5"}`}>
                  <div
                    className={`max-w-[80%] rounded-[20px] px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                      mine
                        ? `bg-accent text-accent-ink ${grouped ? "rounded-tr-md" : "rounded-br-md"}`
                        : `bg-surface-2 text-fg ${grouped ? "rounded-tl-md" : "rounded-bl-md"}`
                    } ${m.failed ? "opacity-60 ring-2 ring-rose-500" : ""}`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-accent-ink/70" : "text-muted"}`}>
                      {timeOf(m.createdAt)}
                      {mine &&
                        (m.pending ? (
                          <Clock className="h-3 w-3" aria-label="Sending" />
                        ) : m.failed ? null : m.readAt ? (
                          <CheckCheck className="h-3.5 w-3.5" aria-label="Seen" />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-label="Sent" />
                        ))}
                    </span>
                  </div>
                </div>
                {m.failed && (
                  <button onClick={() => retry(m)} className="ml-auto block pt-1 text-right text-xs font-semibold text-rose-500">
                    Not sent · tap to edit and retry
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {typing && (
          <div className="flex pt-2">
            <span className="flex items-center gap-1 rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-3" aria-label="typing">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
        <textarea
          className="input max-h-32 min-h-11 flex-1 resize-none rounded-[22px] py-2.5"
          rows={1}
          placeholder="Write a message…"
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(e) => {
            setText(e.target.value);
            sendTyping(e.target.value);
          }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
          }}
          aria-label="Message"
        />
        <button className="btn-primary h-11 w-11 shrink-0 p-0" disabled={!text.trim()} aria-label="Send message">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Messages() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(null);
  const [fetched, setFetched] = useState(null);
  const [typingIn, setTypingIn] = useState(() => new Set());
  const typingTimers = useRef({});
  const myId = user?._id;

  useEffect(() => {
    api
      .get("/chats")
      .then((res) => setConversations(res.data.conversations))
      .catch(() => setConversations([]));
  }, []);

  // The open chat: from the list, or loaded on its own if not in it
  const fromList = id ? conversations?.find((c) => c._id === id) : null;
  const current = fromList || (fetched?._id === id ? fetched : null);
  const missing = Boolean(id && conversations && !fromList);

  useEffect(() => {
    if (!missing) return undefined;
    let active = true;
    api
      .get(`/chats/${id}`)
      .then((res) => active && setFetched(res.data.conversation))
      .catch((err) => {
        toast.error(getErrorMessage(err));
        navigate("/messages", { replace: true });
      });
    return () => {
      active = false;
    };
  }, [id, missing, navigate]);

  // Live: move the chat to the top with its new last message
  useSocketEvent(
    "chat:message",
    useCallback(({ conversation }) => {
      setConversations((list) => [conversation, ...(list || []).filter((c) => c._id !== conversation._id)]);
      setTypingIn((s) => {
        if (!s.has(conversation._id)) return s;
        const next = new Set(s);
        next.delete(conversation._id);
        return next;
      });
    }, []),
  );

  // I read a chat (here or in another tab): clear its badge in the list
  useSocketEvent(
    "chat:read",
    useCallback(
      ({ conversationId, by }) => {
        if (String(by) !== String(myId)) return;
        setConversations((list) => list && list.map((c) => (c._id === conversationId ? { ...c, unread: 0 } : c)));
      },
      [myId],
    ),
  );

  // The booking ended: its chat was deleted on the server
  useSocketEvent(
    "chat:closed",
    useCallback(
      ({ conversationId, status }) => {
        setConversations((list) => list && list.filter((c) => c._id !== conversationId));
        if (conversationId === id) {
          toast(`${ENDED_TEXT[status] || "The booking ended"}, so this chat was deleted.`, { icon: "🔒" });
          navigate("/messages", { replace: true });
        }
      },
      [id, navigate],
    ),
  );

  useSocketEvent(
    "chat:typing",
    useCallback(({ conversationId, typing }) => {
      clearTimeout(typingTimers.current[conversationId]);
      setTypingIn((s) => {
        const next = new Set(s);
        if (typing) next.add(conversationId);
        else next.delete(conversationId);
        return next;
      });
      // If the "stopped typing" event is lost, clear it anyway
      if (typing) {
        typingTimers.current[conversationId] = setTimeout(() => {
          setTypingIn((s) => {
            const next = new Set(s);
            next.delete(conversationId);
            return next;
          });
        }, 6000);
      }
    }, []),
  );

  useEffect(() => {
    const timers = typingTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const onSeen = useCallback((conversationId) => {
    setConversations((list) => list && list.map((c) => (c._id === conversationId ? { ...c, unread: 0 } : c)));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-4">
      <div className="card grid h-[calc(100dvh-13rem)] min-h-[26rem] overflow-hidden md:h-[calc(100dvh-8.5rem)] grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <aside className={`min-h-0 flex-col border-line md:flex md:border-r ${id ? "hidden" : "flex"}`}>
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
          <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ConversationList conversations={conversations} activeId={id} myId={myId} typingIn={typingIn} />
          </div>
        </aside>

        <section className={`min-h-0 ${id ? "block" : "hidden md:block"}`}>
          {id ? (
            <ChatWindow
              key={id}
              conversationId={id}
              conversation={current}
              myId={myId}
              typing={typingIn.has(id)}
              onSeen={onSeen}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted">
              <MessageCircle className="h-10 w-10" />
              <p className="font-semibold text-fg">Your messages</p>
              <p className="max-w-xs text-sm">
                Pick a chat on the left. Each booking has its own private chat, deleted when the booking ends.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
