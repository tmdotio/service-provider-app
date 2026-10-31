import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";




await connectDB()

const PORT = 5000;

app.listen(PORT,()=>{
    console.log(`Server is running at port ${PORT}`)
})