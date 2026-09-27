import { verifyAccessToken } from "../config/access-refresh-token.js";
import User from "../models/user.model.js";


/**
 * Authenticate user using access token.
 *
 * Verifies the Bearer token, finds the user,
 * attaches safe user information to req.user,
 * and passes control to the next middleware/controller.
 */


export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    const { userId } = verifyAccessToken(token);

    const user = await User.findById(userId).select(
      "_id name email role phone avatar isActive"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "There was an error while authenticating user:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
};