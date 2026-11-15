import Notification from "../models/notification.model.js";

/**
 * Create a notification for a user.
 *
 * Never throws: if saving a notification fails, the main action
 * (booking, review, ...) should still succeed.
 */
export const notify = async (userId, type, message, data = {}) => {
  try {
    await Notification.create({ user: userId, type, message, data });
  } catch (error) {
    console.error("Notification Error:", error.message);
  }
};
