import { Router } from "express";
import {
  getMyNotifications,
  markAllAsRead,
  markAsRead,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";

const notificationRoute = Router();

notificationRoute.use(authenticate);

/**
 * @route   GET /api/notifications?unread=true
 * @access  Private
 */
notificationRoute.get("/", getMyNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
notificationRoute.patch("/read-all", markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @access  Private (owner)
 */
notificationRoute.patch("/:id/read", validateObjectId("id"), markAsRead);

export default notificationRoute;
