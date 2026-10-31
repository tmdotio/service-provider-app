import express from "express"
import authRoute from "./router/auth.routes.js";
import cookieParser from "cookie-parser";
import providerRoute from "./router/provider.route.js";
import uploadRoutes from "./router/upload.routes.js";
import adminRoute from "./router/admin.routes.js";



const app = express();
app.use(express.json());
app.use(cookieParser())

app.use("/api/auth",authRoute);

app.use("/api/provider",providerRoute)

app.use("/api/upload",uploadRoutes)

app.use("/api/admin",adminRoute)

export default app;