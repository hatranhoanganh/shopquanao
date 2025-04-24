import express from "express";
import {
  getAllCategory,
  addCategory,
  deleteCategory,
  updateCategory,
} from "../controllers/category.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js"; // Thêm authMiddleware,adminMiddleware

const categoryRouter = express.Router();

// Áp dụng authMiddleware và adminMiddleware cho tất cả các route
categoryRouter.get("/LayDanhSachDanhMuc", authMiddleware, adminMiddleware, getAllCategory);
categoryRouter.post("/ThemDanhMuc", authMiddleware, adminMiddleware, addCategory);
categoryRouter.delete("/XoaDanhMuc/:id_category", authMiddleware, adminMiddleware, deleteCategory);
categoryRouter.put("/CapNhatDanhMuc/:id_category", authMiddleware, adminMiddleware, updateCategory);

export default categoryRouter;