/**
 * Error with an HTTP status code.
 *
 * Throw it from any controller. Express 5 sends errors from async
 * handlers to the central error handler automatically:
 *
 *   throw new ApiError(404, "Post not found");
 */
export default class ApiError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
