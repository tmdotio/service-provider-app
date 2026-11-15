import Notification from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

/**
 * My notifications (newest first) + unread count.
 *
 * @route   GET /api/notifications
 * @access  Private
 * @query   unread=true, page, limit
 */
export const getMyNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);

  const filter = { user: req.user._id };
  if (req.query.unread === "true") {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.status(200).json({
    success: true,
    unreadCount,
    notifications,
    pagination: paginationMeta(total, page, limit),
  });
};

/**
 * Mark one notification as read.
 *
 * @route   PATCH /api/notifications/:id/read
 * @access  Private (owner)
 */
export const markAsRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true },
    { returnDocument: "after" },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.status(200).json({ success: true, notification });
};

/**
 * Mark all my notifications as read.
 *
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true },
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} notifications marked as read`,
  });
};
