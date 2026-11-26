import dotenv from "dotenv";
dotenv.config();

import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import chatRoute from "./router/chat.routes.js";
import notificationRoute from "./router/notification.routes.js";
import postRoute from "./router/post.routes.js";
import providerRoute from "./router/provider.route.js";
import reviewRoute from "./router/review.routes.js";
import uploadRoutes from "./router/upload.routes.js";
import { CACHE_KEYS, getOrSetCache } from "./services/cache.service.js";

const app = express();

// Render (and most hosts) sit behind one proxy: trust it, so req.ip is the
// real visitor's IP. Without this every visitor shares the proxy's IP and
// the login rate limit would block the whole site at once.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

// The built React app (client/dist). In production Express serves it, so
// the site and the API share one origin: cookies and the chat just work.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
const clientIndex = path.join(clientDist, "index.html");
const hasClient = process.env.SERVE_CLIENT !== "false" && existsSync(clientIndex);

/** Hashes of the inline <script>s in index.html (the theme script), for the CSP. */
const inlineScriptHashes = () => {
  if (!hasClient) return [];
  const html = readFileSync(clientIndex, "utf8");
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    ([, code]) => `'sha256-${crypto.createHash("sha256").update(code).digest("base64")}'`,
  );
};

// Images come from ImageKit (and data:/blob: for previews before upload)
const imageHosts = ["https://ik.imagekit.io"];
try {
  if (process.env.IMAGEKIT_URL_ENDPOINT) imageHosts.push(new URL(process.env.IMAGEKIT_URL_ENDPOINT).origin);
} catch {
  // ignore a malformed endpoint here; ImageKit itself will complain
}

// Security headers (with a Content Security Policy that fits this app)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", ...inlineScriptHashes()],
        "img-src": ["'self'", "data:", "blob:", ...new Set(imageHosts)],
        "connect-src": ["'self'"],
      },
    },
  }),
);

// Allow the frontend (e.g. http://localhost:5173) to call the API with cookies
export const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
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

if (!hasClient) {
  app.get("/", (req, res) => {
    res.send("Ustaad API is running");
  });
}

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
app.use("/api/chats", chatRoute);
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

// The React app: files from client/dist, and index.html for every page
// route (/providers, /messages/123...). /api stays JSON, even for 404s.
if (hasClient) {
  app.use(
    express.static(clientDist, {
      index: false,
      // File names in /assets contain a content hash, so they can be cached forever
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get(/^\/(?!api\/|api$|socket\.io\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(clientIndex);
  });
}

// Must be after all routes
app.use(notFound);
app.use(errorHandler);

export default app;
