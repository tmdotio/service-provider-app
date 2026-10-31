import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { uploadProfileImage } from "../controllers/upload.controller.js";
import upload from "../middlewares/upload.middleware.js";

const uploadRoutes = Router();



export default uploadRoutes;




