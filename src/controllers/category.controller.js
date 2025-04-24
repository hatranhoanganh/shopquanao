import category from "../models/category.js";
import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
// import bcrypt from "bcrypt";
import { Op } from "sequelize";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";
// import transporter from "../config/transporter.js";
// import { createRefToken, createToken } from "../config/jwt.js";

const model = initModels(sequelize);

const getAllCategory = async (req, res) => {
  try {
    const category = await model.category.findAll();
    return res.status(200).json({ message: "success", data: category });
  } catch (error) {
    return res.status(400).json({ message: "error", error: error.message });
  }
};

//hàm thêm
const addCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Kiểm tra rỗng
    if (!name) {
      return res.status(400).json({ message: "Vui lòng nhập tên danh mục" });
    }

    // Kiểm tra danh mục đã tồn tại (dựa trên name)
    const categoryExist = await model.category.findOne({
      where: { name },
    });
    if (categoryExist) {
      return res.status(400).json({ message: "Danh mục đã tồn tại" });
    }

    // Tạo danh mục mới (không cần truyền id_category)
    const newCategory = await model.category.create({
      name,
    });

    return res.status(200).json({ message: "Thêm danh mục thành công", data: newCategory });
  } catch (error) {
    console.error('Error adding category:', error.message);
    return res.status(400).json({ message: "Lỗi khi thêm danh mục", error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id_category } = req.params;
    const categoryExist = await model.category.findOne({
      where: { id_category },
    });
    if (!categoryExist) {
      return res.status(400).json({ message: "Danh mục không tồn tại" });
    }

    // Kiểm tra xem danh mục có sản phẩm  không
    const enrolledCaegory = await model.product.findAll({
      where: { id_category },
    });

    if (enrolledCaegory.length > 0) {
      return res
        .status(400)
        .json({ message: "Danh mục này đã có sản phẩm, không thể xóa" });
    }

    // xóa khóa ngoại trước khi xóa danh mục
    // await model.course.destroy({ where: { categoryId: categoryId } });
    await model.category.destroy({ where: { id_category } });
    return res.status(200).json({ message: "Xóa danh mục thành công!" });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Xóa danh mục thất bại", error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id_category } = req.params; // Lấy id_category từ req.params
    const { name } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!id_category || isNaN(id_category)) {
      return res.status(400).json({
        message: 'id_category không hợp lệ, phải là một số',
      });
    }

    if (!name) {
      return res.status(400).json({
        message: 'Vui lòng nhập tên danh mục',
      });
    }

    // Kiểm tra danh mục tồn tại
    const categoryExist = await model.category.findOne({
      where: { id_category: parseInt(id_category) },
    });
    if (!categoryExist) {
      return res.status(404).json({
        message: 'Danh mục không tồn tại',
      });
    }

    // Kiểm tra name có trùng với danh mục khác không (trừ danh mục hiện tại)
    const duplicateName = await model.category.findOne({
      where: {
        name,
        id_category: { [Op.ne]: parseInt(id_category) }, // Không tính danh mục hiện tại
      },
    });
    if (duplicateName) {
      return res.status(400).json({
        message: 'Tên danh mục đã tồn tại, vui lòng chọn tên khác',
      });
    }

    // Cập nhật danh mục
    await model.category.update(
      { name },
      { where: { id_category: parseInt(id_category) } }
    );

    // Lấy thông tin danh mục sau khi cập nhật
    const updatedCategory = await model.category.findOne({
      where: { id_category: parseInt(id_category) },
    });

    return res.status(200).json({
      message: 'Cập nhật danh mục thành công',
      data: updatedCategory,
    });
  } catch (error) {
    console.error('Error updating category:', error.message);
    return res.status(500).json({
      message: 'Lỗi khi cập nhật danh mục',
      error: error.message,
    });
  }
};

export { getAllCategory, addCategory, deleteCategory, updateCategory };
