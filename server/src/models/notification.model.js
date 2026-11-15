import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "booking_created",
  "booking_accepted",
  "booking_rejected",
  "booking_completed",
  "booking_cancelled",
  "booking_no_show",
  "review_received",
  "post_liked",
  "post_commented",
  "comment_replied",
  "post_removed",
  "provider_approved",
  "provider_rejected",
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    // IDs the frontend needs to open the right page
    data: {
      booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
      post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// MongoDB deletes notifications automatically after 90 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
