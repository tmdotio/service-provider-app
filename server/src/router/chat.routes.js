import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getChat,
  getChats,
  getMessages,
  getUnreadCount,
  openChat,
  postMessage,
  readChat,
} from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";

const chatRoute = Router();

chatRoute.use(authenticate);

// Private messages: browsers and proxies must never store them
chatRoute.use((req, res, next) => {
  res.set("Cache-Control", "no-store, private");
  next();
});

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { success: false, message: "You are sending messages too fast" },
});

chatRoute.get("/", getChats);
chatRoute.get("/unread-count", getUnreadCount);
chatRoute.post("/", openChat);
chatRoute.get("/:id", validateObjectId("id"), getChat);
chatRoute.get("/:id/messages", validateObjectId("id"), getMessages);
chatRoute.post("/:id/messages", validateObjectId("id"), sendLimiter, postMessage);
chatRoute.patch("/:id/read", validateObjectId("id"), readChat);

export default chatRoute;
