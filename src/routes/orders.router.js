import express from "express";
import {
  placeOrder,
  addToCart,
  getOrderByKeyWordUser,
  // getAllOrders,
  cancelOrder,
  deleteOrder,
  confirmOrder,
  removeFromCart,
  getOrderByStatus,
  GetOrderByID,
  getCartItems,
} from "../controllers/orders.controller.js";
import { getPaginatedData } from "../controllers/pagination.controller.js";
import { authMiddleware, adminMiddleware, userOnlyMiddleware } from "../middleware/authMiddleware.js";

const ordersRoutes = express.Router();

// Routes chỉ dành cho admin (yêu cầu authMiddleware và adminMiddleware)
// ordersRoutes.get("/LayDanhSachTatCaDonHang", authMiddleware, adminMiddleware, getAllOrders);
ordersRoutes.get("/LayDanhSachTatCaDonHang", authMiddleware, adminMiddleware, (req, res) => {
  res.locals.type = "orders";
  getPaginatedData(req, res);
});
ordersRoutes.delete("/XoaDonHang/:id_order", authMiddleware, adminMiddleware, deleteOrder);
ordersRoutes.put("/XacNhanDonHang/:id_order", authMiddleware, adminMiddleware, confirmOrder);
ordersRoutes.get("/LayDanhSachDonHangTheoTrangThai/:status", authMiddleware, adminMiddleware, getOrderByStatus);

// Routes cho tất cả người dùng đã đăng nhập (chỉ cần authMiddleware)
ordersRoutes.post("/ThemSanPhamVaoGioHang", authMiddleware, userOnlyMiddleware, addToCart);
ordersRoutes.post("/DatHang", authMiddleware, userOnlyMiddleware, placeOrder);
ordersRoutes.post("/HuyDonHang", authMiddleware, userOnlyMiddleware, cancelOrder);

// Route đặc biệt: cả admin và user đều có thể sử dụng
ordersRoutes.get("/LayDanhSachDonHangCuaNguoiDung/:keyword", authMiddleware, getOrderByKeyWordUser);
ordersRoutes.get("/LayDonHangTheoMaDonHang/:id_order", authMiddleware, GetOrderByID );
ordersRoutes.get("/LayDanhSachSanPhamTrongGioHang/:id_user", authMiddleware, userOnlyMiddleware, getCartItems);

ordersRoutes.delete("/XoaSanPhamTrongGioHang/:id_user/:id_product", authMiddleware, removeFromCart);




export default ordersRoutes;