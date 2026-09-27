
/**
 * Authorize users based on their roles.
 *
 * Accepts one or more allowed roles and returns
 * an Express middleware function that checks whether
 * the authenticated user's role is permitted.
 *
 * @param {...string} allowedRoles - Roles allowed to access the route.
 * @returns {Function} Express authorization middleware.
 */


export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource",
      });
    }

    next();
  };
};