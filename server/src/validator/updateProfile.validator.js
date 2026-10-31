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







