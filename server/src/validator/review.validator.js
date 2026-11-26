import { body } from "express-validator";

export const createReviewValidator = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be a whole number from 1 to 5")
    .toInt(),

  body("comment")
    .optional()
    .isString()
    .withMessage("Comment must be a string")
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
];

export const updateReviewValidator = [
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be a whole number from 1 to 5")
    .toInt(),

  body("comment")
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
];

export const replyValidator = [
  body("text")
    .isString()
    .withMessage("Reply text is required")
    .bail()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Reply must be between 1 and 1000 characters"),
];
