import {
  getConversationView,
  listConversations,
  listMessages,
  markRead,
  openForBooking,
  sendMessage,
  toView,
  unreadTotal,
} from "../services/chat.service.js";

/**
 * Open the chat for a booking (creates it the first time).
 *
 * @route   POST /api/chats
 * @access  Private (the booking's customer or provider)
 * @body    bookingId
 */
export const openChat = async (req, res) => {
  const conversation = await openForBooking(req.body.bookingId, req.user._id);
  res.status(200).json({ success: true, conversation: toView(conversation, req.user._id) });
};

/**
 * @route   GET /api/chats
 * @access  Private
 */
export const getChats = async (req, res) => {
  const conversations = await listConversations(req.user._id);
  res.status(200).json({ success: true, conversations });
};

/**
 * @route   GET /api/chats/unread-count
 * @access  Private
 */
export const getUnreadCount = async (req, res) => {
  res.status(200).json({ success: true, unreadCount: await unreadTotal(req.user._id) });
};

/**
 * @route   GET /api/chats/:id
 * @access  Private (participants)
 */
export const getChat = async (req, res) => {
  const conversation = await getConversationView(req.params.id, req.user._id);
  res.status(200).json({ success: true, conversation });
};

/**
 * @route   GET /api/chats/:id/messages?before=<ISO date>&limit=30
 * @access  Private (participants)
 */
export const getMessages = async (req, res) => {
  const result = await listMessages(req.params.id, req.user._id, req.query);
  res.status(200).json({ success: true, ...result });
};

/**
 * Send a message without the socket (fallback; the socket is preferred).
 *
 * @route   POST /api/chats/:id/messages
 * @access  Private (participants)
 * @body    text
 */
export const postMessage = async (req, res) => {
  const message = await sendMessage(req.params.id, req.user, req.body.text);
  res.status(201).json({ success: true, message });
};

/**
 * @route   PATCH /api/chats/:id/read
 * @access  Private (participants)
 */
export const readChat = async (req, res) => {
  const readAt = await markRead(req.params.id, req.user._id);
  res.status(200).json({ success: true, readAt });
};
