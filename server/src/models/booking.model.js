
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "provider",
      required: [true, "Provider is required"],
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    description: {
      type: String,
      required: [true, "Service description is required"],
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    serviceAddress: {
      type: String,
      required: [true, "Service address is required"],
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "pending",
    },

    // When the provider accepted (used for the no-show rule)
    acceptedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: String,
      enum: ["customer", "provider", null],
      default: null,
    },

    // Reason for reject / cancel / no-show
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
      default: "",
    },

    // Customer already left a review for this booking
    isReviewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ provider: 1, status: 1, createdAt: -1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
