import { Router } from "express";
import {
  deleteReview,
  replyToReview,
  updateReview,
} from "../controllers/review.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";
import {
  replyValidator,
  updateReviewValidator,
} from "../validator/review.validator.js";
import { validateRequest } from "../validator/validateRequest.js";

/**
 * Create a review:  POST /api/booking/:bookingId/review
 * List reviews:     GET  /api/provider/:id/reviews
 */
const reviewRoute = Router();

/**
 * @route   PATCH /api/reviews/:id
 * @access  Private (review author)
 */
reviewRoute.patch(
  "/:id",
  authenticate,
  validateObjectId("id"),
  updateReviewValidator,
  validateRequest,
  updateReview,
);

/**
 * @route   DELETE /api/reviews/:id
 * @access  Private (review author or admin)
 */
reviewRoute.delete("/:id", authenticate, validateObjectId("id"), deleteReview);

/**
 * @route   PATCH /api/reviews/:id/reply
 * @access  Private/Provider
 */
reviewRoute.patch(
  "/:id/reply",
  authenticate,
  authorizeRoles("provider"),
  validateObjectId("id"),
  replyValidator,
  validateRequest,
  replyToReview,
);

export default reviewRoute;
