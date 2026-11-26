import { Router } from "express";
import rateLimit from "express-rate-limit";
import { registerValidator } from "../validator/register.validator.js";
import { getMe, login, logout, refreshAccessToken, register, updateUserProfile } from "../controllers/auth.controller.js";
import { loginValidator } from "../validator/login.validator.js";
import { validateRequest } from "../validator/validateRequest.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { updateUserProfileValidator } from "../validator/updateProfile.validator.js";


const authRoute = Router();

/**
 * Max 10 login/register attempts per 15 minutes per IP
 * (stops password guessing). Turned off in tests.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});



/**
 * Registers a new user account.
 * @route   POST /api/auth/register
 * @access  Public
 * @body    name, email, password, phone?  (always registers as customer)
 * @returns Newly created user information
 */

authRoute.post(
  "/register",
  authLimiter,
  registerValidator,
  validateRequest,
  register
);



/**
 * @route   POST /api/auth/login
 * @access  Public
 * @body    email, password
 * @returns Logged-in user information and access token
 */

authRoute.post("/login", authLimiter, loginValidator, validateRequest, login);



/**
 * @route   POST /api/auth/refresh-token
 * @access  Public
 * @returns New access token
 */
authRoute.post(
  "/refresh-token",
  refreshAccessToken
);



/**
 * @route   GET /api/auth/get-me
 * @access  Private
 * @returns user data {id,name,email,role}
 */
authRoute.get("/get-me",authenticate,getMe)




/**
 * @route   GET /api/auth/logout
 * @access  Private
 * @returns clear cookies and refreshToken = null
 */
authRoute.post("/logout", authenticate, logout);
// Old GET version kept so existing clients don't break
authRoute.get("/logout", authenticate, logout);


/**
 * Update the authenticated customer's profile.
 *
 * @route   PATCH /api/update-profile
 * @access  Private (any role)
 * @body    name, phone, avatar
 * @returns Updated customer profile data
 */



authRoute.patch(
  "/update-profile",
  authenticate,
  updateUserProfileValidator,
  validateRequest,
  updateUserProfile
);





export default authRoute;