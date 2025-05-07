import express from "express";
import {
  placeOrder,
  addToCart,
  getOrderList,
  getAllOrders,
  cancelOrder,
  deleteOrder,
  confirmOrder,
  removeFromCart,
  getOrderByKeyword,
  getOrderByStatus,
} from "../controllers/orders.controller.js";
import { authMiddleware, adminMiddleware, userOnlyMiddleware } from "../middleware/authMiddleware.js";

const ordersRoutes = express.Router();

// Routes chỉ dành cho admin (yêu cầu authMiddleware và adminMiddleware)
ordersRoutes.get("/LayDanhSachTatCaDonHang", authMiddleware, adminMiddleware, getAllOrders);
ordersRoutes.delete("/XoaDonHang/:id_order", authMiddleware, adminMiddleware, deleteOrder);
ordersRoutes.put("/XacNhanDonHang/:id_order", authMiddleware, adminMiddleware, confirmOrder);
ordersRoutes.get("/LayDanhSachDonHangTheoTuKhoa/:keyword", authMiddleware, adminMiddleware, getOrderByKeyword);
ordersRoutes.get("/LayDanhSachDonHangTheoTrangThai/:status", authMiddleware, adminMiddleware, getOrderByStatus);

// Routes cho tất cả người dùng đã đăng nhập (chỉ cần authMiddleware)
ordersRoutes.post("/ThemSanPhamVaoGioHang", authMiddleware, userOnlyMiddleware, addToCart);
ordersRoutes.post("/DatHang", authMiddleware, userOnlyMiddleware, placeOrder);
ordersRoutes.post("/HuyDonHang", authMiddleware, userOnlyMiddleware, cancelOrder);

// Route đặc biệt: cả admin và user đều có thể sử dụng
ordersRoutes.get("/LayDanhSachDonHangCuaNguoiDung/:id_user", authMiddleware, getOrderList);
ordersRoutes.delete("/XoaSanPhamTrongGioHang/:id_user/:id_product", authMiddleware, removeFromCart);

export default ordersRoutes;