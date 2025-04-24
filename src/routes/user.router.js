import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  logout,
  getInfoUser,
  getAllUsers,
  updateInfoUser,
  changePassword,
} from "../controllers/user.controller.js";
import { authMiddleware,adminMiddleware } from "../middleware/authMiddleware.js"; // Import middleware

const userRouter = express.Router();

// Route không cần token
userRouter.post("/DangKy", registerUser);
userRouter.post("/DangNhap", loginUser);
userRouter.post("/LamMoiToken", refreshToken);

// Route cần token
userRouter.post("/DangXuat", authMiddleware, logout);

// Route cần token và quyền admin
userRouter.get("/LayDanhSachNguoiDung", authMiddleware, adminMiddleware, getAllUsers);

// Route cần token (người dùng thông thường)
userRouter.get("/LayThongTinTaiKhoan/:id_user", authMiddleware, getInfoUser);
userRouter.put("/CapNhatTaiKhoan", authMiddleware, updateInfoUser);
userRouter.post("/DoiMatKhau", authMiddleware, changePassword);

export default userRouter;