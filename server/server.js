import "dotenv/config";
import { createServer } from "node:http";
import app, { allowedOrigins } from "./src/app.js";
import connectDB from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";
import Review from "./src/models/review.model.js";
import { cleanUpChats } from "./src/services/chat.service.js";
import { initSocket } from "./src/socket/index.js";

await connectDB();
await connectRedis();

// Older reviews: fill in which service they were for
try {
  const filled = await Review.backfillCategories();
  if (filled) console.log(`Added the service to ${filled} older review(s)`);
} catch (error) {
  console.error("Review service backfill failed:", error.message);
}

// Delete chats of bookings that have already ended (and old-style chats)
try {
  const removed = await cleanUpChats();
  if (removed) console.log(`Removed ${removed} closed chat(s)`);
} catch (error) {
  console.error("Chat clean-up failed:", error.message);
}

const PORT = process.env.PORT || 5001;

// One HTTP server for both the REST API and the Socket.IO chat
const httpServer = createServer(app);
initSocket(httpServer, { origins: allowedOrigins });

httpServer.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
