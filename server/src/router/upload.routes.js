import { Router } from "express";
import { uploadProfileImage } from "../controllers/upload.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

const uploadRoutes = Router();

/**
 * Upload and set profile picture (JPG/PNG/WEBP, max 1 MB).
 *
 * @route   PATCH /api/upload/avatar   (form-data field: "image")
 * @access  Private
 */
uploadRoutes.patch("/avatar", authenticate, uploadSingleImage, uploadProfileImage);

export default uploadRoutes;
