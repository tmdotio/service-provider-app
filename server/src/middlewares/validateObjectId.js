import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

/**
 * Reject requests whose route params are not valid MongoDB ObjectIds.
 *
 * Usage: router.get("/:id", validateObjectId("id"), controller)
 */
export const validateObjectId =
  (...paramNames) =>
  (req, res, next) => {
    for (const name of paramNames) {
      if (!mongoose.isValidObjectId(req.params[name])) {
        return next(new ApiError(400, `Invalid ${name}`));
      }
    }
    next();
  };
