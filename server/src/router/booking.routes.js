import { Router } from "express";
import { body } from "express-validator";
import {
  cancelBooking,
  createBooking,
  getBookingById,
  getMyBookings,
  getProviderBookings,
  markBookingComplete,
  reportNoShow,
  respondToBooking,
} from "../controllers/booking.controller.js";
import { createReview } from "../controllers/review.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";
import { createBookingValidator } from "../validator/booking.validator.js";
import { createReviewValidator } from "../validator/review.validator.js";
import { validateRequest } from "../validator/validateRequest.js";

const bookingRoute = Router();

const reasonRequired = [
  body("reason")
    .isString()
    .withMessage("Reason is required")
    .bail()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Reason must be between 3 and 500 characters"),
];

/**
 * @route   GET /api/booking/customer
 * @desc    Bookings I made (as a customer)
 * @access  Private (Customer, Provider: a customer who became a provider keeps their bookings)
 */
bookingRoute.get(
  "/customer",
  authenticate,
  authorizeRoles("customer", "provider"),
  getMyBookings,
);

/**
 * @route   GET /api/booking/provider
 * @desc    Get all booking requests received by the logged-in provider
 * @access  Private (Provider)
 */
bookingRoute.get(
  "/provider",
  authenticate,
  authorizeRoles("provider"),
  getProviderBookings,
);

/**
 * @route   GET /api/booking/:bookingId
 * @desc    Get one booking (customer, provider of it, or admin)
 * @access  Private
 */
bookingRoute.get(
  "/:bookingId",
  authenticate,
  validateObjectId("bookingId"),
  getBookingById,
);

/**
 * @route   POST /api/booking/:providerId
 * @desc    Create a booking request for a service provider
 * @access  Private (Customer, Provider: providers can hire other providers, never themselves)
 * @body    category, description, serviceAddress
 */
bookingRoute.post(
  "/:providerId",
  authenticate,
  authorizeRoles("customer", "provider"),
  createBookingValidator,
  validateRequest,
  createBooking,
);

/**
 * @route   PATCH /api/booking/:bookingId/respond
 * @desc    Provider accepts or rejects a pending booking
 * @access  Private (Provider)
 * @body    action - "accept" | "reject", reason? (for reject)
 * @status  pending -> in_progress (accept) | rejected (reject)
 */
bookingRoute.patch(
  "/:bookingId/respond",
  authenticate,
  authorizeRoles("provider"),
  respondToBooking,
);

/**
 * @route   PATCH /api/booking/:bookingId/complete
 * @desc    Provider completes an in-progress booking
 * @access  Private (Provider)
 * @status  in_progress -> completed
 */
bookingRoute.patch(
  "/:bookingId/complete",
  authenticate,
  authorizeRoles("provider"),
  markBookingComplete,
);

/**
 * @route   PATCH /api/booking/:bookingId/cancel
 * @desc    Customer cancels (pending/in_progress) or provider cancels (in_progress)
 * @access  Private (customer or provider of the booking)
 * @body    reason
 * @status  pending | in_progress -> cancelled
 */
bookingRoute.patch(
  "/:bookingId/cancel",
  authenticate,
  validateObjectId("bookingId"),
  reasonRequired,
  validateRequest,
  cancelBooking,
);

/**
 * @route   PATCH /api/booking/:bookingId/no-show
 * @desc    Customer reports the provider did not come (1 hour after accept)
 * @access  Private (customer of the booking)
 * @body    reason?
 * @status  in_progress -> no_show
 */
bookingRoute.patch(
  "/:bookingId/no-show",
  authenticate,
  validateObjectId("bookingId"),
  body("reason").optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
  reportNoShow,
);

/**
 * @route   POST /api/booking/:bookingId/review
 * @desc    Customer reviews a completed (or no-show) booking, once
 * @access  Private (customer of the booking)
 * @body    rating (1-5), comment?
 */
bookingRoute.post(
  "/:bookingId/review",
  authenticate,
  validateObjectId("bookingId"),
  createReviewValidator,
  validateRequest,
  createReview,
);

export default bookingRoute;
