import mongoose from "mongoose";

/**
 * A private one-on-one chat that belongs to ONE booking.
 *
 * - Only the booking's customer and provider can see it.
 * - It exists only while the booking is open (pending / in progress).
 *   When the booking ends (completed, cancelled, rejected, no-show) the
 *   conversation and all its messages are deleted. A new booking starts
 *   a new, empty chat. (see chat.service.js)
 */
const conversationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "provider", required: true },
    // The provider's user account (who actually reads and writes)
    providerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // The booking this chat belongs to (one chat per booking)
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },

    lastMessage: {
      text: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: null },
    },

    // Messages each side has not read yet
    unread: {
      customer: { type: Number, default: 0 },
      provider: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

conversationSchema.index({ booking: 1 }, { unique: true });
conversationSchema.index({ customer: 1, updatedAt: -1 });
conversationSchema.index({ providerUser: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
