import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { authenticate } from "./middlewares/auth.middleware.js";
import { invalidateProvidersOnWrite } from "./middlewares/cacheInvalidation.middleware.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { authorizeRoles } from "./middlewares/role.middleware.js";
import User from "./models/user.model.js";
import adminRoute from "./router/admin.routes.js";
import authRoute from "./router/auth.routes.js";
import bookingRoute from "./router/booking.routes.js";
import categoryRoute from "./router/category.routes.js";
import notificationRoute from "./router/notification.routes.js";
import postRoute from "./router/post.routes.js";
import providerRoute from "./router/provider.route.js";
import reviewRoute from "./router/review.routes.js";
import uploadRoutes from "./router/upload.routes.js";
import { CACHE_KEYS, getOrSetCache } from "./services/cache.service.js";

const app = express();

// Security headers
app.use(helmet());

// Allow the frontend (e.g. http://localhost:5173) to call the API with cookies
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ["X-Cache"],
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("g main aa gia hon");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

// Changes to these keep the Redis provider cache fresh (see the middleware)
app.use(
  ["/api/provider", "/api/booking", "/api/reviews", "/api/posts", "/api/admin", "/api/upload", "/api/auth"],
  invalidateProvidersOnWrite,
);

app.use("/api/auth", authRoute);
app.use("/api/provider", providerRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/booking", bookingRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/posts", postRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoute);

/**
 * Redis caching demo: all users (cache for 1 hour).
 *
 * Admin only, because it returns emails and phone numbers.
 * 1. Redis mein dekho  2. Nahi mila to MongoDB se lao  3. Redis mein save karo
 */
app.get("/getusers", authenticate, authorizeRoles("admin"), async (req, res) => {
  const users = await getOrSetCache(CACHE_KEYS.allUsers, 3600, () =>
    User.find({}).lean(),
  );
  res.json(users);
});

// Must be after all routes
app.use(notFound);
app.use(errorHandler);

export default app;
