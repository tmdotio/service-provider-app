import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {  becomeProviderValidator } from "../validator/provider.validator.js";
import { validateRequest } from "../validator/validateRequest.js";
import { becomeServiceProvider, getMyProviderProfile } from "../controllers/provder.controller.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const providerRoute = Router();

/**
 * Submit an application to become a service provider.
 * Creates a pending ServiceProvider profile for the
 * authenticated customer. The application must be
 * approved by an admin before the user becomes a provider.
 *
 * @route   POST /api/provider/become-provider
 * @access  Private/Customer
 * @body    businessName, description, experienceYears,
 *          category, serviceAreas, location
 * @returns Created service provider application
 */
providerRoute.post(
  "/become-provider",
  authenticate,
  authorizeRoles("customer"),
  becomeProviderValidator,
  validateRequest,
  becomeServiceProvider
);



/**
 * Get logged-in provider's own profile.
 *
 * @route   GET /api/provider/me
 * @access  Private/Provider
 */
providerRoute.get(
  "/me",
  authenticate,
  authorizeRoles("provider"),
  getMyProviderProfile
);



export default providerRoute;