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

    // The service the job was for (from the booking), e.g. "Electrician",
    // so every review says which service it is about
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
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
reviewSchema.index({ provider: 1, category: 1, createdAt: -1 });

/**
 * Older reviews were saved without a service: copy it from their booking.
 * Safe to run many times (only touches reviews that have none).
 */
reviewSchema.statics.backfillCategories = async function () {
  const missing = await this.find({ category: null }).select("booking").lean();
  if (!missing.length) return 0;
  const bookings = await mongoose
    .model("Booking")
    .find({ _id: { $in: missing.map((r) => r.booking) } })
    .select("category")
    .lean();
  const byBooking = new Map(bookings.map((b) => [String(b._id), b.category]));
  const ops = missing
    .filter((r) => byBooking.get(String(r.booking)))
    .map((r) => ({
      updateOne: { filter: { _id: r._id, category: null }, update: { $set: { category: byBooking.get(String(r.booking)) } } },
    }));
  if (ops.length) await this.bulkWrite(ops);
  return ops.length;
};

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
