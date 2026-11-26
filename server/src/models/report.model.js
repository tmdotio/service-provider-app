import mongoose from "mongoose";

/**
 * A user reports a post (spam, fake, abusive...).
 * Admins review reports and can remove the post.
 */
const reportSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reason: {
      type: String,
      enum: ["spam", "fake", "abusive", "inappropriate", "other"],
      required: [true, "Reason is required"],
    },

    details: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "dismissed", "action_taken"],
      default: "pending",
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  { timestamps: true },
);

// A user can report the same post only once
reportSchema.index({ post: 1, reportedBy: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
