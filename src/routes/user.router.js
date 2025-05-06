import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  logout,
  getInfoUser,
  updateInfoUser,
  changePassword,
} from "../controllers/user.controller.js";
import { getPaginatedData } from "../controllers/pagination.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware.js";

const userRouter = express.Router();

// Route không cần token
userRouter.post("/DangKy", registerUser);
userRouter.post("/DangNhap", loginUser);
userRouter.post("/LamMoiToken", refreshToken);

// Route cần token
userRouter.post("/DangXuat", authMiddleware, logout);

// Route cần token và quyền admin
userRouter.get("/LayDanhSachNguoiDung", authMiddleware, adminMiddleware, (req, res) => {
  console.log("req.query before setting:", req.query);
  res.locals.type = "users";
  console.log("res.locals after setting type:", res.locals);
  console.log("req.query:", req.query);
  getPaginatedData(req, res);
});

// Route cần token (người dùng thông thường)
userRouter.get("/LayThongTinTaiKhoan/:id_user", authMiddleware, getInfoUser);
userRouter.put("/CapNhatTaiKhoan", authMiddleware, updateInfoUser);
userRouter.post("/DoiMatKhau", authMiddleware, changePassword);

export default userRouter;