import express from "express";
import rootRoutes from "./src/routes/root.router.js";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors"; // Thêm cors

dotenv.config(); // Đọc file .env

console.log("ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET);
console.log("REFRESH_TOKEN_SECRET:", process.env.REFRESH_TOKEN_SECRET);

const app = express();

// Thêm middleware CORS
app.use(
  cors({
    origin: "http://localhost:5173", // Cho phép origin frontend (dev)
    methods: ["GET", "POST", "OPTIONS"], // Cho phép các phương thức
    allowedHeaders: ["Content-Type", "Authorization"], // Cho phép các header
    credentials: true, // Cho phép gửi cookie nếu cần
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to quanAoBE backend!" });
});

app.use(rootRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
