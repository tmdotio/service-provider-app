import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";

await connectDB();
await connectRedis();

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
