import { useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";
import { socket } from "../api/socket";
import useAuth from "../hooks/useAuth";
import { resetChatState, useSocketEvent } from "../hooks/useChat";

/**
 * Keeps the chat socket connected while someone is logged in, and shows
 * a small popup for new messages when that chat is not open.
 */
export default function ChatConnector() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const userId = user?._id;

  useEffect(() => {
    if (!userId) {
      socket.disconnect();
      resetChatState();
      return undefined;
    }
    socket.connect();
    return () => socket.disconnect();
  }, [userId]);

  const onMessage = useCallback(
    ({ message, conversation }) => {
      if (String(message.sender) === String(userId)) return;
      if (pathname === `/messages/${conversation._id}`) return;
      const name = conversation.other?.businessName || conversation.other?.name || "Someone";
      toast(
        (t) => (
          <button
            className="text-left"
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/messages/${conversation._id}`);
            }}
          >
            <span className="block">💬 {name}</span>
            <span className="block max-w-60 truncate font-normal opacity-80">{message.text}</span>
          </button>
        ),
        { id: `chat-${conversation._id}`, duration: 5000 },
      );
    },
    [userId, pathname, navigate],
  );
  useSocketEvent("chat:message", onMessage);

  return null;
}
