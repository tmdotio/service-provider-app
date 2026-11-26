import { body } from "express-validator";

export const createPostValidator = [
  body("text")
    .isString()
    .withMessage("Post text is required")
    .bail()
    .trim()
    .isLength({ min: 3, max: 2000 })
    .withMessage("Post text must be between 3 and 2000 characters"),
];

export const updatePostValidator = [
  body("text")
    .isString()
    .withMessage("Post text is required")
    .bail()
    .trim()
    .isLength({ min: 3, max: 2000 })
    .withMessage("Post text must be between 3 and 2000 characters"),
];

export const commentValidator = [
  body("parentId")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("Invalid comment to reply to"),

  body("text")
    .isString()
    .withMessage("Comment text is required")
    .bail()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Comment must be between 1 and 500 characters"),
];

export const reportValidator = [
  body("reason")
    .isIn(["spam", "fake", "abusive", "inappropriate", "other"])
    .withMessage("Reason must be spam, fake, abusive, inappropriate or other"),

  body("details")
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Details cannot exceed 500 characters"),
];
