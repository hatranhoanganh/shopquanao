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
} from "../controllers/orders.controller.js";
import { authMiddleware, adminMiddleware, userOnlyMiddleware } from "../middleware/authMiddleware.js"; // Import middleware

const ordersRoutes = express.Router();

// Routes chỉ dành cho admin (yêu cầu authMiddleware và adminMiddleware)
ordersRoutes.get("/LayDanhSachTatCaDonHang", authMiddleware, adminMiddleware, getAllOrders);
ordersRoutes.delete("/XoaDonHang/:id_order", authMiddleware, adminMiddleware, deleteOrder);
ordersRoutes.put("/XacNhanDonHang/:id_order", authMiddleware, adminMiddleware, confirmOrder);

// Routes cho tất cả người dùng đã đăng nhập (chỉ cần authMiddleware)
ordersRoutes.post("/ThemSanPhamVaoGioHang", authMiddleware, userOnlyMiddleware, addToCart);
ordersRoutes.post("/DatHang", authMiddleware, userOnlyMiddleware, placeOrder);
ordersRoutes.post("/HuyDonHang", authMiddleware, userOnlyMiddleware, cancelOrder);

// Route đặc biệt: cả admin và user đều có thể sử dụng, nhưng user chỉ lấy được danh sách đơn hàng và xóa sản phẩm trong giỏ hàng của chính mình
ordersRoutes.get("/LayDanhSachDonHangCuaNguoiDung/:id_user", authMiddleware, getOrderList);
ordersRoutes.delete("/XoaSanPhamTrongGioHang/:id_user/:id_product", authMiddleware, removeFromCart);

export default ordersRoutes;