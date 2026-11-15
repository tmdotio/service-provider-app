import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Review from "../models/review.model.js";
import ServiceProvider from "../models/serviceProvider.model.js";
import { cacheProviders, setCacheHeader, stableQueryKey } from "../services/cache.service.js";
import { notify } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

/**
 * Customer reviews a booking. Only after the job is completed (or
 * the provider did not show up), and only once per booking.
 *
 * @route   POST /api/booking/:bookingId/review
 * @access  Private (customer of the booking)
 * @body    rating (1-5), comment?
 */
export const createReview = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate(
    "provider",
    "user",
  );

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (!booking.customer.equals(req.user._id)) {
    throw new ApiError(403, "Only the customer of this booking can review it");
  }

  if (!["completed", "no_show"].includes(booking.status)) {
    throw new ApiError(
      400,
      "You can review only after the job is completed or the provider did not show up",
    );
  }

  if (booking.isReviewed) {
    throw new ApiError(409, "You have already reviewed this booking");
  }

  let review;
  try {
    review = await Review.create({
      booking: booking._id,
      customer: req.user._id,
      provider: booking.provider._id,
      rating: req.body.rating,
      comment: req.body.comment,
    });
  } catch (error) {
    // Unique index on booking: two requests at the same time
    if (error.code === 11000) {
      throw new ApiError(409, "You have already reviewed this booking");
    }
    throw error;
  }

  await Booking.updateOne({ _id: booking._id }, { isReviewed: true });
  await Review.recalculateProviderRating(booking.provider._id);

  await notify(
    booking.provider.user,
    "review_received",
    `${req.user.name} gave you ${review.rating} star${review.rating > 1 ? "s" : ""}`,
    { booking: booking._id },
  );

  res.status(201).json({
    success: true,
    message: "Thank you for your review",
    review,
  });
};

/**
 * Reviews of a provider, with a star breakdown (how many 5★, 4★...).
 *
 * @route   GET /api/provider/:id/reviews
 * @access  Public
 * @query   rating?, page, limit
 */
export const getProviderReviews = async (req, res) => {
  const providerId = new mongoose.Types.ObjectId(String(req.params.id));
  const { page, limit, skip } = getPagination(req.query);

  const filter = { provider: providerId };
  if (req.query.rating) {
    filter.rating = Number(req.query.rating);
  }

  // Cached in Redis; cleared automatically when reviews change
  const cache = {};
  const data = await cacheProviders(
    `reviews:${req.params.id}:${stableQueryKey(req.query)}`,
    300,
    async () => {
      const [reviews, total, breakdownRaw] = await Promise.all([
        Review.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("customer", "name avatar")
          .lean(),
        Review.countDocuments(filter),
        Review.aggregate([
          { $match: { provider: providerId } },
          { $group: { _id: "$rating", count: { $sum: 1 } } },
        ]),
      ]);

      const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const item of breakdownRaw) {
        breakdown[item._id] = item.count;
      }

      return { reviews, breakdown, pagination: paginationMeta(total, page, limit) };
    },
    cache,
  );
  setCacheHeader(res, cache);

  res.status(200).json({ success: true, ...data });
};

/**
 * Customer edits their review.
 *
 * @route   PATCH /api/reviews/:id
 * @access  Private (review author)
 * @body    rating?, comment?
 */
export const updateReview = async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  if (!review.customer.equals(req.user._id)) {
    throw new ApiError(403, "You can only edit your own review");
  }

  if (req.body.rating !== undefined) review.rating = req.body.rating;
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  await review.save();

  await Review.recalculateProviderRating(review.provider);

  res.status(200).json({
    success: true,
    message: "Review updated",
    review,
  });
};

/**
 * Delete a review (author or admin). The booking can be reviewed again.
 *
 * @route   DELETE /api/reviews/:id
 * @access  Private (review author or admin)
 */
export const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  if (!review.customer.equals(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only delete your own review");
  }

  await review.deleteOne();
  await Booking.updateOne({ _id: review.booking }, { isReviewed: false });
  await Review.recalculateProviderRating(review.provider);

  res.status(200).json({
    success: true,
    message: "Review deleted",
  });
};

/**
 * Provider replies to a review about them.
 *
 * @route   PATCH /api/reviews/:id/reply
 * @access  Private/Provider (the reviewed provider)
 * @body    text
 */
export const replyToReview = async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  const myProfile = await ServiceProvider.findOne({ user: req.user._id }).select(
    "_id",
  );

  if (!myProfile || !review.provider.equals(myProfile._id)) {
    throw new ApiError(403, "You can only reply to reviews about you");
  }

  review.providerReply = { text: req.body.text, repliedAt: new Date() };
  await review.save();

  res.status(200).json({
    success: true,
    message: "Reply added",
    review,
  });
};
