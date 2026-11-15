
import { body } from "express-validator";

/**
 * Validate service provider application.
 *
 * @route POST /api/provider/become-provider
 * @access Private (Customer)
 */
export const becomeProviderValidator = [
  body("businessName")
    .isString()
    .withMessage("Business name must be a string")
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters"),

  body("businessPhone")
    .isString()
    .withMessage("Business phone must be a string")
    .bail()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Please provide a valid business phone number"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("experienceYears")
    .notEmpty()
    .withMessage("Experience years is required")
    .bail()
    .isFloat({ min: 0 })
    .withMessage("Experience years must be 0 or greater"),

  // Multiple provider categories
  body("categories")
    .isArray({ min: 1 })
    .withMessage("Select at least one category")
    .bail()
    .custom((categories) => {
      const uniqueCategories = new Set(categories.map(String));

      if (uniqueCategories.size !== categories.length) {
        throw new Error("Duplicate categories are not allowed");
      }

      return true;
    }),

  body("categories.*")
    .isMongoId()
    .withMessage("Each category must be a valid MongoDB ID"),

  // New location structure
  body("location")
    .isObject()
    .withMessage("Location must be an object")
    .bail(),

  body("location.city")
    .isString()
    .withMessage("City must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("City is required"),

  body("location.province")
    .isString()
    .withMessage("Province must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Province is required"),

  body("location.country")
    .isString()
    .withMessage("Country must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Country is required"),
];


/**
 * Validate provider profile update (all fields optional).
 *
 * @route PATCH /api/provider/me
 * @access Private (Provider)
 */
export const updateProviderValidator = [
  body("businessName")
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters"),

  body("businessPhone")
    .optional()
    .isString()
    .bail()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Please provide a valid business phone number"),

  body("description")
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("experienceYears")
    .optional()
    .isFloat({ min: 0, max: 60 })
    .withMessage("Experience years must be between 0 and 60")
    .toFloat(),

  body("categories")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Select at least one category")
    .bail()
    .custom((categories) => {
      if (new Set(categories.map(String)).size !== categories.length) {
        throw new Error("Duplicate categories are not allowed");
      }
      return true;
    }),

  body("categories.*")
    .optional()
    .isMongoId()
    .withMessage("Each category must be a valid MongoDB ID"),

  body("location").optional().isObject().withMessage("Location must be an object"),

  body(["location.city", "location.province", "location.country"])
    .optional()
    .isString()
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Location fields cannot be empty"),
];
