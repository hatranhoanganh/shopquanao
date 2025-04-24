import express from "express";
import productRoutes from "./product.router.js";
import userRouter from "./user.router.js";
import categoryRouter from "./category.router.js";
import galleryRoutes from './gallery.router.js';
import ordersRoutes from './orders.router.js';
// tạo object router tổng
const rootRoutes = express.Router();


rootRoutes.use("/QuanLySanPham", productRoutes);
rootRoutes.use("/QuanLyNguoiDung", userRouter);
rootRoutes.use("/QuanLyDanhMuc", categoryRouter);
rootRoutes.use('/QuanLyGallery', galleryRoutes);
rootRoutes.use('/QuanLyOrders', ordersRoutes);
// // export rootRoutes cho index.js dùng
export default rootRoutes;
