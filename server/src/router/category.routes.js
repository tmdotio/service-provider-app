import { getProvidersByCategory } from "../controllers/category.controller.js";


/**
 ** filter by category
 * Get providers by selected category. fileer category
 *
 * @route   GET /api/provider/category/:categoryId
 * @access  Public
 */
providerRoute.get(
  "/category/:categoryId",
  getProvidersByCategory
);
