import { body, validationResult } from "express-validator";

/**
 * Validate category creation and update requests.
 */
export const validateCategory = [
  body("name")
    .isString()
    .withMessage("Category name must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category name must be between 2 and 50 characters"),
];
