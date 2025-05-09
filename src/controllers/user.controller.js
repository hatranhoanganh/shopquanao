import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config(); // Đọc file .env

const model = initModels(sequelize);

// Khóa bí mật cho Access Token và Refresh Token (lấy từ file .env)
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const registerUser = async (req, res) => {
  try {
    const { fullname, email, phone_number, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!fullname || !email || !phone_number || !password) {
      return res.status(400).json({
        message: "Thông tin không được để trống",
      });
    }

    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email không hợp lệ",
      });
    }

    // Kiểm tra định dạng số điện thoại
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ (phải có 10-15 chữ số)",
      });
    }

    // Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    // Kiểm tra email đã tồn tại
    const existingEmail = await model.user.findOne({
      where: { email },
    });
    if (existingEmail) {
      return res.status(400).json({
        message: "Email đã được sử dụng",
      });
    }

    // Mã hóa mật khẩu
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo người dùng mới với role mặc định là "user"
    const newUser = await model.user.create({
      fullname,
      email,
      phone_number,
      password: hashedPassword,
      role: "user",
    });

    // Trả về thông tin người dùng
    const userData = {
      id_user: newUser.id_user,
      fullname: newUser.fullname,
      email: newUser.email,
      createdAt: newUser.createdAt,
      role: newUser.role,
    };

    return res.status(201).json({
      message: "Đăng ký tài khoản thành công",
      data: userData,
    });
  } catch (err) {
    console.error("Error registering user:", err.message);
    return res.status(500).json({
      message: "Lỗi khi đăng ký tài khoản",
      error: err.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email và password không được để trống",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email không hợp lệ",
      });
    }

    const user = await model.user.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({
        message: "Email hoặc mật khẩu không đúng",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Email hoặc mật khẩu không đúng",
      });
    }

    console.log("ACCESS_TOKEN_SECRET in loginUser:", process.env.ACCESS_TOKEN_SECRET);
    console.log("REFRESH_TOKEN_SECRET in loginUser:", process.env.REFRESH_TOKEN_SECRET);

    const accessToken = jwt.sign(
      { id_user: user.id_user, email: user.email, role: user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "30s" }
    );

    const refreshToken = jwt.sign(
      { id_user: user.id_user, email: user.email, role: user.role },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "1m" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userData = {
      id_user: user.id_user,
      fullname: user.fullname,
      email: user.email,
      phone_number: user.phone_number,
      created_at: user.created_at,
      role: user.role,
    };

    return res.status(200).json({
      message: "Đăng nhập thành công",
      data: {
        user: userData,
        accessToken,
      },
    });
  } catch (error) {
    console.error("Error logging in user:", error.message);
    return res.status(500).json({
      message: "Lỗi khi đăng nhập",
      error: error.message,
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Vui lòng cung cấp refresh token" });
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
      const newAccessToken = jwt.sign(
        { id_user: decoded.id_user, email: decoded.email, role: decoded.role },
        ACCESS_TOKEN_SECRET,
        { expiresIn: "30s" }
      );

      return res.status(200).json({
        message: "Làm mới token thành công",
        accessToken: newAccessToken,
      });
    } catch (error) {
      return res.status(403).json({ message: "Refresh token không hợp lệ hoặc đã hết hạn" });
    }
  } catch (error) {
    console.error("Error refreshing token:", error.message);
    return res.status(500).json({
      message: "Lỗi khi làm mới token",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      expires: new Date(0),
    });

    return res.status(200).json({
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    console.error("Error logging out:", error.message);
    return res.status(500).json({
      message: "Lỗi khi đăng xuất",
      error: error.message,
    });
  }
};

const getInfoUser = async (req, res) => {
  try {
    const { id_user } = req.params;
    const userIdFromToken = req.user.id_user;
    const userRole = req.user.role;

    if (!id_user || isNaN(id_user)) {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }

    if (userRole !== "admin" && parseInt(id_user) !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền xem thông tin của người dùng khác" });
    }

    const user = await model.user.findOne({
      where: { id_user },
      attributes: ["id_user", "fullname", "email", "phone_number", "address", "createdAt", "role"],
    });

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    return res.status(200).json({
      message: "Lấy thông tin người dùng thành công",
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user info:", error.message);
    return res.status(500).json({
      message: "Lỗi khi lấy thông tin người dùng",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await model.user.findAll({
      attributes: [
        "id_user",
        "fullname",
        "email",
        "phone_number",
        "address",
        "createdAt",
        "updatedAt",
        "role",
      ],
    });

    if (!users || users.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng nào",
      });
    }

    const userList = users.map(user => ({
      id_user: user.id_user,
      fullname: user.fullname,
      email: user.email,
      phone_number: user.phone_number,
      address: user.address,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role,
    }));

    return res.status(200).json({
      message: "Lấy danh sách người dùng thành công",
      data: userList,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error.message);
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách người dùng",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Mật khẩu hiện tại và mới không được để trống",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    const user = await model.user.findOne({ where: { id_user: userId } });
    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
      });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Mật khẩu hiện tại không đúng",
      });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await model.user.update(
      { password: hashedNewPassword },
      { where: { id_user: userId } }
    );

    return res.status(200).json({
      message: "Thay đổi mật khẩu thành công",
    });
  } catch (error) {
    console.error("Lỗi khi thay đổi mật khẩu:", error.message);
    return res.status(500).json({
      message: "Lỗi khi thay đổi mật khẩu",
      error: error.message,
    });
  }
};

const updateInfoUser = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { fullname, email, phone_number, address } = req.body;

    let user = await model.user.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    if (!fullname || !email || !phone_number || !address) {
      return res.status(400).json({
        message: "Các thông tin không được để trống",
        data: null,
      });
    }

    const existingEmail = await model.user.findOne({
      where: { email, id_user: { [Op.ne]: userId } },
    });
    if (existingEmail) {
      return res.status(400).json({
        message: "Email đã được sử dụng",
      });
    }

    await model.user.update(
      {
        fullname,
        email,
        phone_number,
        address,
      },
      { where: { id_user: userId } }
    );

    user = await model.user.findByPk(userId);

    const userData = {
      fullname: user.fullname,
      email: user.email,
      phone_number: user.phone_number,
      address: user.address,
      updatedAt: user.updatedAt,
    };

    return res.status(200).json({ message: "Cập nhật thông tin thành công", data: userData });
  } catch (err) {
    return res.status(400).json({ message: "Lỗi khi cập nhật thông tin", error: err.message });
  }
};

const searchUsersByKeyword = async (req, res) => {
  try {
    const { keyword, page = 1, limit = 10 } = req.query;

    // Kiểm tra từ khóa
    if (!keyword || typeof keyword !== "string" || keyword.trim() === "") {
      return res.status(400).json({
        message: "Vui lòng cung cấp từ khóa tìm kiếm hợp lệ",
      });
    }

    // Chuẩn hóa page và limit
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    // Tìm kiếm người dùng theo từ khóa trong fullname, email, phone_number
    const result = await model.user.findAndCountAll({
      where: {
        [Op.or]: [
          { fullname: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } },
          { phone_number: { [Op.like]: `%${keyword}%` } },
          { address: { [Op.like]: `%${keyword}%` } },
        ],
      },
      attributes: [
        "id_user",
        "fullname",
        "email",
        "phone_number",
        "address",
        "createdAt",
        "updatedAt",
        "role",
      ],
      limit: limitNum,
      offset,
    });

    const users = result.rows.map((user) => user.toJSON());
    const totalItems = result.count;

    if (users.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng nào phù hợp với từ khóa",
      });
    }

    const totalPages = Math.ceil(totalItems / limitNum);
    const pagination = {
      currentPage: pageNum,
      itemsPerPage: limitNum,
      totalItems,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    };

    return res.status(200).json({
      message: "Tìm kiếm người dùng thành công",
      data: users,
      pagination,
    });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm người dùng:", error.message);
    return res.status(500).json({
      message: "Lỗi khi tìm kiếm người dùng",
      error: error.message,
    });
  }
};

export {
  registerUser,
  loginUser,
  refreshToken,
  logout,
  getInfoUser,
  getAllUsers,
  changePassword,
  updateInfoUser,
  searchUsersByKeyword,
};