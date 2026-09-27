import { body } from "express-validator";

export const updateUserProfileValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Please provide a valid phone number"),
  body("avatar")
    .optional()
    .isString()
    .isURL({
    protocols: ["http", "https"],
    require_protocol: true,
  })
  .withMessage("Avatar must be a valid image URL"),
];







export const updateServiceProviderValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Please provide a valid phone number"),

  body("avatar")
    .optional()
    .trim()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage("Avatar must be a valid image URL"),

  // Service Provider Fields
  body("businessName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("experienceYears")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Experience years must be 0 or greater"),

  body("serviceAreas")
    .optional()
    .isArray()
    .withMessage("Service areas must be an array"),

  body("serviceAreas.*.city")
    .optional()
    .trim()
    .isString()
    .withMessage("City must be a valid string"),

  body("serviceAreas.*.area")
    .optional()
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
    .withMessage(
      "Coordinates must contain exactly [longitude, latitude]"
    ),

  body("availabilityStatus")
    .optional()
    .isIn(["available", "busy", "offline"])
    .withMessage(
      "Availability status must be available, busy, or offline"
    ),
];