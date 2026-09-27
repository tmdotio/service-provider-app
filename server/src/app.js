import express from "express"
import authRoute from "./router/auth.routes.js";
import dotenv from "dotenv"
import cookieParser from "cookie-parser";

dotenv.config();


const app = express();
app.use(express.json());
app.use(cookieParser())

app.use("/api/auth",authRoute)


export default app;