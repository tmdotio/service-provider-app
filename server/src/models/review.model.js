import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    // One review per booking
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "provider",
      required: true,
    },

    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
    },

    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      default: "",
    },

    providerReply: {
      text: { type: String, trim: true, maxlength: 1000 },
      repliedAt: Date,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ provider: 1, createdAt: -1 });

/**
 * Recalculate a provider's averageRating and totalReviews with an
 * aggregation. Called after a review is created, edited or deleted.
 */
reviewSchema.statics.recalculateProviderRating = async function (providerId) {
  const [stats] = await this.aggregate([
    { $match: { provider: new mongoose.Types.ObjectId(String(providerId)) } },
    {
      $group: {
        _id: "$provider",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  await mongoose.model("provider").findByIdAndUpdate(providerId, {
    averageRating: stats ? Math.round(stats.averageRating * 10) / 10 : 0,
    totalReviews: stats ? stats.totalReviews : 0,
  });
};

const Review = mongoose.model("Review", reviewSchema);

export default Review;
