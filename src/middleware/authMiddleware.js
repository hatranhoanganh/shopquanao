import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Không tìm thấy token. Vui lòng đăng nhập" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token không hợp lệ. Vui lòng đăng nhập" });
  }

  console.log("ACCESS_TOKEN_SECRET in authMiddleware:", process.env.ACCESS_TOKEN_SECRET);
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("Decoded token:", decoded); // Debug thông tin token
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn", error: error.message });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Không tìm thấy thông tin người dùng" });
  }
  const userRole = req.user.role;
  if (userRole !== "admin") {
    return res.status(403).json({ message: "Chỉ admin mới có quyền thực hiện hành động này" });
  }
  next();
};

const userOnlyMiddleware = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng" });
    }
    const userRole = req.user.role;
    if (userRole !== "user") {
      return res.status(403).json({
        message: "Chỉ người dùng thông thường mới có quyền thực hiện hành động này",
      });
    }
    next();
  } catch (error) {
    console.error("Error in userOnlyMiddleware:", error);
    return res.status(500).json({
      message: "Lỗi server khi kiểm tra quyền người dùng",
      error: error.message,
    });
  }
};

export { authMiddleware, adminMiddleware, userOnlyMiddleware };