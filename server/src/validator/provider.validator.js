
import { body } from "express-validator";

export const becomeProviderValidator = [
  body("businessName")
    .notEmpty()
    .withMessage("Business name is required")
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters"),

  body("businessPhone")
    .notEmpty()
    .withMessage("Business phone number is required")
    .bail()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Please provide a valid business phone number"),

  body("description")
    .optional()
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

  body("serviceAreas")
    .notEmpty()
    .withMessage("At least one service area is required")
    .bail()
    .isArray({ min: 1 })
    .withMessage("Service areas must contain at least one area"),

  body("serviceAreas.*.city")
    .notEmpty()
    .withMessage("City is required")
    .bail()
    .trim()
    .isString()
    .withMessage("City must be a valid string"),

  body("serviceAreas.*.area")
    .notEmpty()
    .withMessage("Area is required")
    .bail()
    .trim()
    .isString()
    .withMessage("Area must be a valid string"),

  body("location.type")
    .optional()
    .equals("Point")
    .withMessage("Location type must be Point"),

  body("location.coordinates")
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage("Coordinates must contain exactly [longitude, latitude]"),
];
