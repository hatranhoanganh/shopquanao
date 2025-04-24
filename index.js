import express from "express";
import rootRoutes from "./src/routes/root.router.js";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config(); // Đọc file .env

console.log("ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET);
console.log("REFRESH_TOKEN_SECRET:", process.env.REFRESH_TOKEN_SECRET);
const app = express();

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