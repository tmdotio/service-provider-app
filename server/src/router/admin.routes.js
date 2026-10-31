import { Router } from "express";
import {
  deleteUserByAdmin,
  getAllProviders,
  getAllUsers,
  getDashboardStats,
  getPendingProviderRequests,
  getSingleCustomer,
  getSingleProvider,
  reviewProviderRequest,
  updateProviderByAdmin,
  updateUserByAdmin,
  updateUserStatus,
} from "../controllers/admin.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";


import {
  validateCategory,
  
} from "../validator/category.validator.js";



const adminRoute = Router();

/**
 * Review a pending service provider application.
 *
 * Allows an admin to approve or reject a provider request.
 *
 * @route   PATCH /api/admin/provider-requests/:id/review
 * @access  Private/Admin
 * @body    action - "approve" or "reject"
 */
adminRoute.patch(
  "/provider-requests/:id/review",
  authenticate,
  authorizeRoles("admin"),
  reviewProviderRequest,
);

/**
 * Get all users.
 *
 * Allows an authenticated admin to fetch
 * all registered users from the system.
 *
 * @route   GET /api/admin/users
 * @access  Private/Admin
 * @returns List of all users
 */
adminRoute.get("/users", authenticate, authorizeRoles("admin"), getAllUsers);

/**
 * Get all providers.
 *
 * Allows an authenticated admin to fetch
 * only users with the provider role.
 *
 * @route   GET /api/admin/providers
 * @access  Private/Admin
 * @returns List of providers
 */
adminRoute.get(
  "/providers",
  authenticate,
  authorizeRoles("admin"),
  getAllProviders,
);

/**
 * Get all pending service provider applications.
 *
 * Allows an authenticated admin to fetch
 * all customers waiting for provider approval.
 *
 * @route   GET /api/admin/provider-requests/pending
 * @access  Private/Admin
 * @returns List of pending provider applications
 */
adminRoute.get(
  "/provider-requests/pending",
  authenticate,
  authorizeRoles("admin"),
  getPendingProviderRequests,
);

/**
 * Update a user's basic profile information.
 *
 * Allows an authenticated admin to update selected
 * fields of a customer or provider's User account.
 *
 * @route   PATCH /api/admin/users/:id
 * @access  Private/Admin
 * @param   id - User ID
 * @body    name, email, phone, avatar, isActive
 * @returns Updated user profile
 */
adminRoute.patch(
  "/users/:id",
  authenticate,
  authorizeRoles("admin"),
  updateUserByAdmin,
);

/**
 * Update a provider's complete profile.
 *
 * @route   PATCH /api/admin/providers/:userId
 * @access  Private/Admin
 */
adminRoute.patch(
  "/providers/:userId",
  authenticate,
  authorizeRoles("admin"),
  updateProviderByAdmin,
);

/**
 * Delete a user account.
 *
 * Allows an authenticated admin to permanently remove
 * a customer or provider account.
 *
 * If the user is a provider, the linked ServiceProvider
 * profile is also deleted.
 *
 * Admin accounts cannot be deleted through this route.
 *
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 * @param   id - User ID
 * @returns Account deletion confirmation
 */
adminRoute.delete(
  "/users/:id",
  authenticate,
  authorizeRoles("admin"),
  deleteUserByAdmin,
);

/**
 * Activate or deactivate a user account.
 *
 * Allows an authenticated admin to control whether
 * a customer or provider can access the application.
 *
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private/Admin
 * @body    isActive - true or false
 * @returns Updated user account status
 */
adminRoute.patch(
  "/users/:id/status",
  authenticate,
  authorizeRoles("admin"),
  updateUserStatus,
);

/**
 * Get a single user's details.
 *
 * Allows an authenticated admin to fetch
 * one non-admin user's safe account information.
 *
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 * @param   id - User ID
 * @returns Single user details
 */
adminRoute.get(
  "/users/:id",
  authenticate,
  authorizeRoles("admin"),
  getSingleCustomer,
);

/**
 * Get a single provider's complete details.
 *
 * Returns both User account information and
 * ServiceProvider professional information.
 *
 * @route   GET /api/admin/providers/:id
 * @access  Private/Admin
 * @param   id - Provider's User ID
 * @returns Complete provider profile
 */
adminRoute.get(
  "/providers/:id",
  authenticate,
  authorizeRoles("admin"),
  getSingleProvider,
);

/**
 * Get admin dashboard statistics.
 *
 * Allows an authenticated admin to view
 * important platform statistics such as
 * total users, customers, providers,
 * pending provider requests, and active/inactive users.
 *
 * @route   GET /api/admin/dashboard-stats
 * @access  Private/Admin
 * @returns Dashboard statistics
 */
adminRoute.get(
  "/dashboard-stats",
  authenticate,
  authorizeRoles("admin"),
  getDashboardStats,
);



/**
 * Create a new service category.
 *
 * @route POST /api/admin/categories
 * @access Private/Admin
 */
adminRoute.post(
  "/categories",
  authenticate,
  authorizeRoles("admin"),
  validateCategory,
  
  createCategory,
);

/**
 * Update an existing category.
 *
 * @route PATCH /api/admin/categories/:id
 * @access Private/Admin
 */
adminRoute.patch(
  "/categories/:id",
  authenticate,
  authorizeRoles("admin"),
  validateCategory,
  
  updateCategory,
);

/**
 * Delete a category.
 *
 * @route DELETE /api/admin/categories/:id
 * @access Private/Admin
 */
adminRoute.delete(
  "/categories/:id",
  authenticate,
  authorizeRoles("admin"),
  deleteCategory,
);

export default adminRoute;
