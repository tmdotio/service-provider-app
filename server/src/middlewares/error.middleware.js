import multer from "multer";
import ApiError from "../utils/ApiError.js";

/**
 * 404 for routes that do not exist.
 */
export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler.
 *
 * Every error that is thrown (or passed to next) ends here, so all
 * error responses look the same: { success: false, message, errors? }
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors;

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    const multerMessages = {
      LIMIT_FILE_SIZE: `Each image must be smaller than ${req.maxImageMB || 1} MB`,
      LIMIT_FILE_COUNT: "Too many images. Maximum is 4",
      LIMIT_UNEXPECTED_FILE: `Unexpected file field: ${err.field}`,
    };
    message = multerMessages[err.code] || err.message;
    errors = undefined;
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already exists` : "Duplicate value";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON body";
  } else if (
    err.code === 112 ||
    err.hasErrorLabel?.("TransientTransactionError")
  ) {
    statusCode = 409;
    message = "Data changed by another request. Please retry.";
  }

  if (statusCode >= 500) {
    console.error("Unhandled Error:", err);
    if (process.env.NODE_ENV === "production") {
      message = "Internal server error";
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
