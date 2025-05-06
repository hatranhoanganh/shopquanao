import express from "express";
import upload from "../utils/multer.js";
import {
  addProduct,
  deleteProduct,
  updateProduct,
  getProductById,
  getProductByCategory,
  getProductByName,
  getProductByKeyword,
} from "../controllers/product.controller.js";
import { getPaginatedData } from "../controllers/pagination.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js";

const productRoutes = express.Router();

// Routes chỉ dành cho admin (cần authMiddleware và adminMiddleware)
productRoutes.post("/ThemSanPham", authMiddleware, adminMiddleware, addProduct);
productRoutes.delete("/XoaSanPham/:id_product", authMiddleware, adminMiddleware, deleteProduct);
productRoutes.put("/CapNhatSanPham/:id_product", authMiddleware, adminMiddleware, updateProduct);

// Routes cho tất cả người dùng đã đăng nhập (chỉ cần authMiddleware)
productRoutes.get("/LayDanhSachSanPham", authMiddleware, (req, res) => {
  res.locals.type = "products"; // Sử dụng res.locals thay vì req.query
  getPaginatedData(req, res);
});
productRoutes.get("/LayThongTinSanPhamTheoId/:id_product", authMiddleware, getProductById);
productRoutes.get("/LayDanhSachSanPhamTheoDanhMuc/:id_category", authMiddleware, getProductByCategory);
productRoutes.get("/LayDanhSachSanPhamTheoTitle/:title", authMiddleware, getProductByName);
productRoutes.get("/LayDanhSachSanPhamTheoTuKhoaTimKiem/:keyword", authMiddleware, getProductByKeyword);

export default productRoutes;