
import { body, param } from "express-validator";

/**
 * Validate a new booking request.
 *
 * @route POST /api/bookings/:providerId
 * @access Private (Customer)
 */
export const createBookingValidator = [
  param("providerId")
    .isMongoId()
    .withMessage("Invalid provider ID"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category ID"),

  body("description")
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage(
      "Description must be between 10 and 1000 characters"
    ),

  body("serviceAddress")
    .isString()
    .withMessage("Service address must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Service address is required"),
];
