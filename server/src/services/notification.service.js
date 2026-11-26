import Notification from "../models/notification.model.js";
import { emitToUser } from "../socket/emitter.js";

/**
 * Create a notification for a user, and push it live to their open tabs.
 *
 * Never throws: if saving a notification fails, the main action
 * (booking, review, ...) should still succeed.
 */
export const notify = async (userId, type, message, data = {}) => {
  try {
    const notification = await Notification.create({ user: userId, type, message, data });
    emitToUser(userId, "notification:new", notification.toObject());
  } catch (error) {
    console.error("Notification Error:", error.message);
  }
};
