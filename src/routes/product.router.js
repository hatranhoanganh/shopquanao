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
  getProductByCategoryName,
} from "../controllers/product.controller.js";
import { getPaginatedData } from "../controllers/pagination.controller.js";
import { getAllCategory } from "../controllers/category.controller.js";

const productRoutes = express.Router();

// Routes chỉ dành cho admin (cần authMiddleware và adminMiddleware)
productRoutes.post("/ThemSanPham", upload.none(), addProduct); // Áp dụng upload.none()
productRoutes.delete("/XoaSanPham/:id_product", deleteProduct);
productRoutes.put("/CapNhatSanPham/:id_product", upload.none(), updateProduct); // Áp dụng upload.none()

// Routes cho tất cả người dùng đã đăng nhập (chỉ cần authMiddleware)
productRoutes.get("/LayDanhSachSanPham", (req, res) => {
  res.locals.type = "products";
  getPaginatedData(req, res);
});
productRoutes.get("/LayThongTinSanPhamTheoId/:id_product", getProductById);
productRoutes.get("/LayDanhSachSanPhamTheoDanhMuc/:id_category", getProductByCategory);
productRoutes.get("/LayDanhSachSanPhamTheoTitle/:title", getProductByName);
productRoutes.get("/LayDanhSachSanPhamTheoTuKhoaTimKiem/:keyword", getProductByKeyword);
productRoutes.get("/LayDanhSachSanPhamTheoTenDanhMuc/:name", getProductByCategoryName);
productRoutes.get("/LayDanhSachDanhMuc", getAllCategory);

export default productRoutes;