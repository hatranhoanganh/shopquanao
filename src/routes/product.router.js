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


const productRoutes = express.Router();

// Routes chỉ dành cho admin (cần authMiddleware và adminMiddleware)
productRoutes.post("/ThemSanPham",  addProduct);
productRoutes.delete("/XoaSanPham/:id_product",  deleteProduct);
productRoutes.put("/CapNhatSanPham/:id_product", updateProduct);

// Routes cho tất cả người dùng đã đăng nhập (chỉ cần authMiddleware)
productRoutes.get("/LayDanhSachSanPham", (req, res) => {
  res.locals.type = "products"; // Sử dụng res.locals thay vì req.query
  getPaginatedData(req, res);
});
productRoutes.get("/LayThongTinSanPhamTheoId/:id_product", getProductById);
productRoutes.get("/LayDanhSachSanPhamTheoDanhMuc/:id_category", getProductByCategory);
productRoutes.get("/LayDanhSachSanPhamTheoTitle/:title", getProductByName);
productRoutes.get("/LayDanhSachSanPhamTheoTuKhoaTimKiem/:keyword", getProductByKeyword);

export default productRoutes;