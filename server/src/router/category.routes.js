import { Router } from "express";
import { getAllCategories } from "../controllers/category.controller.js";

const categoryRoute = Router();

/**
 * List all categories with provider counts (cached in Redis).
 *
 * @route   GET /api/categories
 * @access  Public
 *
 * Providers of one category: GET /api/provider/category/:categoryId
 * Admin create/update/delete: /api/admin/categories
 */
categoryRoute.get("/", getAllCategories);

export default categoryRoute;
