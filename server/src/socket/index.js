import { Server } from "socket.io";
import { verifyAccessToken } from "../config/access-refresh-token.js";
import User from "../models/user.model.js";
import { getConversationFor, markRead, otherPerson, sendMessage } from "../services/chat.service.js";
import { emitToUser, roomOf, setIO } from "./emitter.js";

// Per-socket flood limit: at most this many messages per window
const MAX_MESSAGES = 15;
const WINDOW_MS = 10_000;

/** Turn any error into a short message for the ack callback. */
const fail = (ack, error) => {
  if (typeof ack === "function") {
    ack({ ok: false, message: error.statusCode ? error.message : "Something went wrong" });
  }
  if (!error.statusCode) console.error("Socket Error:", error.message);
};

/**
 * Real-time chat over Socket.IO.
 *
 * The browser connects with its access token (socket.handshake.auth.token).
 * Each user joins their own room, so a message reaches every tab and
 * device they have open.
 *
 * Client -> server
 *   chat:send   { conversationId, text }  ack({ ok, message })
 *   chat:read   { conversationId }        ack({ ok })
 *   chat:typing { conversationId, typing }
 *
 * Server -> client
 *   chat:message { message, conversation }
 *   chat:read    { conversationId, readAt, by }
 *   chat:typing  { conversationId, userId, typing }
 */
export const initSocket = (httpServer, { origins } = {}) => {
  const io = new Server(httpServer, {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 16 * 1024, // chat text only
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      const { userId } = verifyAccessToken(token);
      const user = await User.findById(userId).select("_id name role isActive");
      if (!user || !user.isActive) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket.data;
    socket.join(roomOf(user._id));
    let sent = [];

    socket.on("chat:send", async ({ conversationId, text } = {}, ack) => {
      try {
        const now = Date.now();
        sent = sent.filter((t) => now - t < WINDOW_MS);
        if (sent.length >= MAX_MESSAGES) {
          return fail(ack, Object.assign(new Error("You are sending messages too fast"), { statusCode: 429 }));
        }
        sent.push(now);
        // The account may have been deactivated after this socket connected
        if (!(await User.exists({ _id: user._id, isActive: true }))) {
          socket.disconnect(true);
          return fail(ack, Object.assign(new Error("Your account is inactive"), { statusCode: 403 }));
        }
        const message = await sendMessage(conversationId, user, text);
        if (typeof ack === "function") ack({ ok: true, message });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("chat:read", async ({ conversationId } = {}, ack) => {
      try {
        await markRead(conversationId, user._id);
        if (typeof ack === "function") ack({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on("chat:typing", async ({ conversationId, typing } = {}) => {
      try {
        const conversation = await getConversationFor(conversationId, user._id);
        emitToUser(otherPerson(conversation, user._id), "chat:typing", {
          conversationId: String(conversation._id),
          userId: String(user._id),
          typing: Boolean(typing),
        });
      } catch {
        // typing is best-effort
      }
    });
  });

  setIO(io);
  return io;
};
