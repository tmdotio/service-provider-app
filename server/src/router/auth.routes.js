import { Router } from "express";
import { registerValidator } from "../validator/register.validator.js";
import { getMe, login, logout, refreshAccessToken, register, updateUserProfile } from "../controllers/auth.controller.js";
import { loginValidator } from "../validator/login.validator.js";
import { validateRequest } from "../validator/validateRequest.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { updateServiceProviderValidator, updateUserProfileValidator } from "../validator/updateProfile.validator.js";


const authRoute = Router();



/**
 * Registers a new user account.
 * @route   POST /api/auth/register
 * @access  Public
 * @body    name, email, password, role
 * @returns Newly created user information
 */

authRoute.post(
  "/register",
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

authRoute.post("/login",loginValidator,validateRequest,login)



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
authRoute.get("/logout",authenticate,logout)


/**
 * Update the authenticated customer's profile.
 *
 * @route   PATCH /api/update-profile
 * @access  Private/Customer
 * @body    name, phone, avatar
 * @returns Updated customer profile data
 */



authRoute.patch(
  "/update-profile",
  authenticate,
  authorizeRoles("customer"),
  updateUserProfileValidator,
  validateRequest,
  updateUserProfile
);




/**
 * Update the authenticated service provider's profile.
 *
 * Updates basic user fields such as name, phone, and avatar
 * along with service provider-specific profile information.
 *
 * @route   PATCH /api/auth/provider/profile
 * @access  Private/Provider
 * @body    name, phone, avatar, businessName, description,
 *          experienceYears, serviceAreas, location, availabilityStatus
 * @returns Updated service provider profile
 */





export default authRoute;