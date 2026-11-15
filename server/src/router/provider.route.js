import { Router } from "express";
import { body } from "express-validator";
import { getProvidersByCategory } from "../controllers/category.controller.js";
import {
  becomeServiceProvider,
  getMyApplication,
  getMyProviderProfile,
  getProviderPublicProfile,
  searchProviders,
  removeBanner,
  updateAvailability,
  updateBanner,
  updateMyProviderProfile,
} from "../controllers/provder.controller.js";
import { getProviderReviews } from "../controllers/review.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";
import {
  becomeProviderValidator,
  updateProviderValidator,
} from "../validator/provider.validator.js";
import { validateRequest } from "../validator/validateRequest.js";

const providerRoute = Router();

/**
 * Search approved providers.
 *
 * @route   GET /api/provider?q=&category=&city=&province=&minRating=&availability=&sort=&page=&limit=
 * @access  Public
 */
providerRoute.get("/", searchProviders);

/**
 * Submit an application to become a service provider.
 * Creates a pending ServiceProvider profile for the
 * authenticated customer. The application must be
 * approved by an admin before the user becomes a provider.
 *
 * @route   POST /api/provider/become-provider
 * @access  Private/Customer
 * @body    businessName, businessPhone, description, experienceYears,
 *          categories, location{city, province, country}
 */
providerRoute.post(
  "/become-provider",
  authenticate,
  authorizeRoles("customer"),
  becomeProviderValidator,
  validateRequest,
  becomeServiceProvider,
);

/**
 * See my application status (pending / approved).
 *
 * @route   GET /api/provider/application
 * @access  Private
 */
providerRoute.get("/application", authenticate, getMyApplication);

/**
 * Get provider's own profile.
 *
 * @route   GET /api/provider/me
 * @access  Private/Provider
 */
providerRoute.get(
  "/me",
  authenticate,
  authorizeRoles("provider"),
  getMyProviderProfile,
);

/**
 * Update my professional profile.
 *
 * @route   PATCH /api/provider/me
 * @access  Private/Provider
 */
providerRoute.patch(
  "/me",
  authenticate,
  authorizeRoles("provider"),
  updateProviderValidator,
  validateRequest,
  updateMyProviderProfile,
);

/**
 * Go online / offline.
 *
 * @route   PATCH /api/provider/me/availability
 * @access  Private/Provider
 * @body    availabilityStatus: "available" | "offline"
 */
providerRoute.patch(
  "/me/availability",
  authenticate,
  authorizeRoles("provider"),
  body("availabilityStatus")
    .isIn(["available", "offline"])
    .withMessage("availabilityStatus must be available or offline"),
  validateRequest,
  updateAvailability,
);

/**
 * Upload / remove my banner (cover) image, max 1 MB.
 *
 * @route   PATCH /api/provider/me/banner   (form-data field "image")
 * @route   DELETE /api/provider/me/banner
 * @access  Private/Provider
 */
providerRoute.patch("/me/banner", authenticate, authorizeRoles("provider"), uploadSingleImage, updateBanner);
providerRoute.delete("/me/banner", authenticate, authorizeRoles("provider"), removeBanner);

/**
 * Get approved providers by category.
 *
 * @route   GET /api/provider/category/:categoryId
 * @access  Public
 */
providerRoute.get("/category/:categoryId", getProvidersByCategory);

/**
 * Public provider profile (ServiceProvider _id).
 *
 * @route   GET /api/provider/:id
 * @access  Public
 */
providerRoute.get("/:id", validateObjectId("id"), getProviderPublicProfile);

/**
 * Reviews of a provider + star breakdown.
 *
 * @route   GET /api/provider/:id/reviews
 * @access  Public
 */
providerRoute.get("/:id/reviews", validateObjectId("id"), getProviderReviews);

export default providerRoute;
