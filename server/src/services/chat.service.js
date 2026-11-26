import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Conversation from "../models/conversation.model.js";
import Message, { MAX_MESSAGE_LENGTH } from "../models/message.model.js";
import ServiceProvider from "../models/serviceProvider.model.js";
import ApiError from "../utils/ApiError.js";
import { emitToUser } from "../socket/emitter.js";

/*
 * Chat rules (used by both the REST routes and the socket, so they
 * always behave the same):
 *
 * - Each booking has its own private chat, open only while the booking
 *   is pending or in progress.
 * - Only the booking's customer and provider can read or write in it;
 *   anyone else gets "not found" (we don't even say it exists).
 * - When the booking ends, the chat and every message are deleted.
 * - Every new message is pushed live only to those two people.
 */

// A booking in one of these states can be chatted about
export const OPEN_STATUSES = ["pending", "in_progress"];

const PEOPLE = [
  { path: "customer", select: "name avatar" },
  { path: "providerUser", select: "name avatar" },
  { path: "provider", select: "businessName" },
  {
    path: "booking",
    select: "status description createdAt category",
    populate: { path: "category", select: "name" },
  },
];

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

/** "customer" or "provider": which side of the conversation this user is. */
export const sideOf = (conversation, userId) => {
  if (sameId(conversation.customer, userId)) return "customer";
  if (sameId(conversation.providerUser, userId)) return "provider";
  return null;
};

/** Shape sent to the browser: the other person + my unread count. */
export const toView = (conversation, userId) => {
  const obj = conversation.toObject ? conversation.toObject() : conversation;
  const side = sideOf(obj, userId);
  const other =
    side === "customer"
      ? { ...obj.providerUser, businessName: obj.provider?.businessName, role: "provider", providerId: obj.provider?._id }
      : { ...obj.customer, role: "customer" };
  return {
    _id: obj._id,
    other,
    booking: obj.booking,
    lastMessage: obj.lastMessage,
    unread: side ? obj.unread?.[side] || 0 : 0,
    updatedAt: obj.updatedAt,
  };
};

/** Load a conversation the user is part of, or throw 404. */
export const getConversationFor = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) throw new ApiError(400, "Invalid conversation");
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !sideOf(conversation, userId)) {
    // Same answer for "not found" and "not yours": don't reveal it exists
    throw new ApiError(404, "Conversation not found");
  }
  return conversation;
};

/** Open (or reuse) the chat of a booking. Either side of the booking may call. */
export const openForBooking = async (bookingId, userId) => {
  if (!mongoose.isValidObjectId(bookingId)) throw new ApiError(400, "Invalid booking");
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");

  const provider = await ServiceProvider.findById(booking.provider).select("user");
  if (!provider) throw new ApiError(404, "Provider not found");

  if (!sameId(booking.customer, userId) && !sameId(provider.user, userId)) {
    throw new ApiError(403, "You can only message people you have a booking with");
  }
  if (sameId(booking.customer, provider.user)) {
    throw new ApiError(400, "You cannot message yourself");
  }
  if (!OPEN_STATUSES.includes(booking.status)) {
    throw new ApiError(410, "This booking has ended, so its chat is closed");
  }

  const conversation = await Conversation.findOneAndUpdate(
    { booking: booking._id },
    {
      $setOnInsert: {
        booking: booking._id,
        customer: booking.customer,
        provider: provider._id,
        providerUser: provider.user,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).populate(PEOPLE);

  return conversation;
};

/** My conversations, newest activity first. */
export const listConversations = async (userId) => {
  const conversations = await Conversation.find({
    $or: [{ customer: userId }, { providerUser: userId }],
  })
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate(PEOPLE);
  return conversations.map((c) => toView(c, userId));
};

export const getConversationView = async (conversationId, userId) => {
  const conversation = await getConversationFor(conversationId, userId);
  await conversation.populate(PEOPLE);
  return toView(conversation, userId);
};

/** Total unread messages for the navbar badge. */
export const unreadTotal = async (userId) => {
  const id = new mongoose.Types.ObjectId(String(userId));
  const [row] = await Conversation.aggregate([
    { $match: { $or: [{ customer: id }, { providerUser: id }] } },
    {
      $group: {
        _id: null,
        total: {
          $sum: { $cond: [{ $eq: ["$customer", id] }, "$unread.customer", "$unread.provider"] },
        },
      },
    },
  ]);
  return row?.total || 0;
};

/** Messages, newest page first; pass `before` (a date) to load older ones. */
export const listMessages = async (conversationId, userId, { before, limit = 30 } = {}) => {
  const conversation = await getConversationFor(conversationId, userId);
  const size = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const filter = { conversation: conversation._id };
  if (before && !Number.isNaN(Date.parse(before))) filter.createdAt = { $lt: new Date(before) };

  const page = await Message.find(filter).sort({ createdAt: -1 }).limit(size + 1).lean();
  const hasMore = page.length > size;
  return { messages: page.slice(0, size).reverse(), hasMore };
};

/** Save a message and push it live to both people. */
export const sendMessage = async (conversationId, sender, rawText) => {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) throw new ApiError(400, "Message cannot be empty");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  const conversation = await getConversationFor(conversationId, sender._id);
  // Double check: never write into the chat of a booking that has ended
  const booking = await Booking.findById(conversation.booking).select("status");
  if (!booking || !OPEN_STATUSES.includes(booking.status)) {
    await closeChat(conversation);
    throw new ApiError(410, "This booking has ended, so its chat is closed");
  }
  const side = sideOf(conversation, sender._id);
  const otherSide = side === "customer" ? "provider" : "customer";

  const message = await Message.create({ conversation: conversation._id, sender: sender._id, text });

  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: { lastMessage: { text, sender: sender._id, createdAt: message.createdAt } },
      $inc: { [`unread.${otherSide}`]: 1 },
    },
    { returnDocument: "after" },
  ).populate(PEOPLE);

  const payload = message.toObject();
  for (const userId of [updated.customer._id, updated.providerUser._id]) {
    emitToUser(userId, "chat:message", { message: payload, conversation: toView(updated, userId) });
  }
  return payload;
};

/** I have read everything in this conversation. */
export const markRead = async (conversationId, userId) => {
  const conversation = await getConversationFor(conversationId, userId);
  const side = sideOf(conversation, userId);
  const readAt = new Date();

  await Promise.all([
    Message.updateMany(
      { conversation: conversation._id, sender: { $ne: userId }, readAt: null },
      { $set: { readAt } },
    ),
    Conversation.updateOne({ _id: conversation._id }, { $set: { [`unread.${side}`]: 0 } }),
  ]);

  // Tell the other person (blue ticks), and my other tabs (clear badge)
  const other = side === "customer" ? conversation.providerUser : conversation.customer;
  emitToUser(other, "chat:read", { conversationId: String(conversation._id), readAt, by: String(userId) });
  emitToUser(userId, "chat:read", { conversationId: String(conversation._id), readAt, by: String(userId) });
  return readAt;
};

/** The other person in a conversation (for typing indicators). */
export const otherPerson = (conversation, userId) =>
  sideOf(conversation, userId) === "customer" ? conversation.providerUser : conversation.customer;

/** Delete a conversation with all its messages and tell both people. */
const closeChat = async (conversation, status = "closed") => {
  await Message.deleteMany({ conversation: conversation._id });
  await Conversation.deleteOne({ _id: conversation._id });
  const payload = { conversationId: String(conversation._id), bookingId: String(conversation.booking), status };
  emitToUser(conversation.customer, "chat:closed", payload);
  emitToUser(conversation.providerUser, "chat:closed", payload);
};

/**
 * Called after every booking change. When the booking has ended, its
 * chat and all messages are deleted for good (privacy: nothing stays).
 * Never throws: the booking change itself already succeeded.
 */
export const closeChatIfBookingEnded = async (booking) => {
  try {
    if (!booking || OPEN_STATUSES.includes(booking.status)) return;
    const conversation = await Conversation.findOne({ booking: booking._id });
    if (conversation) await closeChat(conversation, booking.status);
  } catch (error) {
    console.error("Close Chat Error:", error.message);
  }
};

/** A deleted account: remove every chat they were part of (both sides). */
export const deleteChatsOfUser = async (userId) => {
  const conversations = await Conversation.find({
    $or: [{ customer: userId }, { providerUser: userId }],
  });
  for (const conversation of conversations) await closeChat(conversation, "closed");
  return conversations.length;
};

/**
 * Startup clean-up: removes chats from older versions (one chat per
 * customer+provider) and any chat whose booking has already ended,
 * then makes the indexes match the schema (drops the old pair index).
 */
export const cleanUpChats = async () => {
  const conversations = await Conversation.find().select("booking customer providerUser").lean();
  const open = new Set(
    (
      await Booking.find({
        _id: { $in: conversations.map((c) => c.booking).filter(Boolean) },
        status: { $in: OPEN_STATUSES },
      }).select("_id").lean()
    ).map((b) => String(b._id)),
  );
  const stale = conversations.filter((c) => !c.booking || !open.has(String(c.booking)));
  if (stale.length) {
    const ids = stale.map((c) => c._id);
    await Message.deleteMany({ conversation: { $in: ids } });
    await Conversation.deleteMany({ _id: { $in: ids } });
  }
  // Messages whose conversation no longer exists
  const live = await Conversation.distinct("_id");
  await Message.deleteMany({ conversation: { $nin: live } });
  await Conversation.syncIndexes();
  await Message.syncIndexes();
  return stale.length;
};
