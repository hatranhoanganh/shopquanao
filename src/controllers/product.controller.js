import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import { Op } from "sequelize";
import fs from "fs";
import moment from "moment";

const model = initModels(sequelize);

// Lấy tất cả sản phẩm
const getAllProducts = async (req, res) => {
  try {
    const listProducts = await model.product.findAll({
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["id_category", "name"],
        },
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["id_gallery", "name", "thumbnail"],
        },
      ],
    });

    if (listProducts.length === 0) {
      return res.status(404).json({ message: "Không có sản phẩm nào cả" });
    }

    const parsedProducts = listProducts.map((product) => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(
            productData.gallery.thumbnail
          );
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          productData.gallery.thumbnail = [];
        }
      }
      productData.description = productData.description
        ? productData.description.split(". ").filter(Boolean)
        : [];
      return productData;
    });

    res
      .status(200)
      .json({ message: "Lấy dữ liệu thành công", data: parsedProducts });
  } catch (err) {
    console.log(err);
    res
      .status(400)
      .json({ message: "Lỗi lấy dữ liệu sản phẩm", error: err.message });
  }
};

// Xóa sản phẩm
const deleteProduct = async (req, res) => {
  try {
    const { id_product } = req.params;

    const product = await model.product.findByPk(id_product);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const restrictedStatuses = ["pending", "confirmed", "delivering"];
    console.log("Checking product with id:", id_product);
    const orderProducts = await model.order_product.findOne({
      where: { id_product },
      include: [
        {
          model: model.orders,
          as: "order",
          where: {
            status: {
              [Op.in]: restrictedStatuses,
            },
          },
          required: true,
        },
      ],
    });

    if (orderProducts) {
      console.log("Product found in restricted order:", orderProducts.toJSON());
      return res.status(400).json({
        message: "Sản phẩm đang được khách đặt nên không thể xóa",
      });
    }

    console.log("No restrictions found, proceeding to delete product:", id_product);
    await model.order_product.destroy({
      where: { id_product },
    });

    await model.product.destroy({
      where: { id_product },
    });

    if (product.id_gallery) {
      try {
        deleteUploadedFile("public/image/" + product.id_gallery);
      } catch (fileError) {
        console.error("Error deleting file:", fileError.message);
      }
    }

    return res.status(200).json({ message: "Xóa sản phẩm thành công!" });
  } catch (error) {
    console.error("Error deleting product - Details:", error);
    return res.status(500).json({
      message: "Error deleting product",
      error: error.message,
    });
  }
};

// Hàm xóa file đã upload
const deleteUploadedFile = (filePath) => {
  try {
    if (filePath) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    throw new Error("Lỗi khi xóa file: " + error.message);
  }
};

// Thêm sản phẩm
const addProduct = async (req, res) => {
  try {
    const {
      id_category,
      id_gallery,
      title,
      price,
      discount,
      size,
      description,
    } = req.body;

    if (
      !id_category ||
      !id_gallery ||
      !title ||
      !price ||
      !size ||
      !description
    ) {
      console.error("Thiếu thông tin cần thiết.");
      return res.status(400).json({
        message: "Vui lòng điền đầy đủ thông tin",
        data: null,
      });
    }

    const image = req.file ? req.file.filename : null;
    console.log(image);

    if (discount !== undefined && discount !== null) {
      if (isNaN(discount) || discount >= 100) {
        deleteUploadedFile(req.file?.path);
        return res.status(400).json({
          message: "Giảm giá phải là số và nhỏ hơn 100",
          data: null,
        });
      }
    }

    const category = await model.category.findByPk(id_category);
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const gallery = await model.gallery.findByPk(id_gallery);
    if (!gallery) {
      return res.status(404).json({ message: "Gallery không tồn tại" });
    }

    if (isNaN(price) || price < 1000) {
      deleteUploadedFile(req.file?.path);
      return res.status(400).json({
        message: "Giá phải là một số dương và ít nhất là 1,000",
        data: null,
      });
    }

    const newProduct = await model.product.create({
      id_category,
      id_gallery,
      title,
      price,
      discount: discount || 0,
      size,
      description,
    });

    const productData = {
      id_product: newProduct.id_product,
      id_category: newProduct.id_category,
      name: category.name,
      gallery: {
        id_gallery: gallery.id_gallery,
        thumbnail:
          typeof gallery.thumbnail === "string"
            ? JSON.parse(gallery.thumbnail)
            : gallery.thumbnail,
      },
      title: newProduct.title,
      price: newProduct.price,
      discount: newProduct.discount,
      size: newProduct.size,
      description: newProduct.description
        ? newProduct.description.split(". ").filter(Boolean)
        : [],
      created_at: newProduct.created_at,
    };

    return res
      .status(200)
      .json({ message: "Thêm sản phẩm thành công", data: productData });
  } catch (err) {
    console.error(err);
    return res
      .status(400)
      .json({ message: "Lỗi khi thêm sản phẩm", error: err.message });
  }
};

// Cập nhật sản phẩm
const updateProduct = async (req, res) => {
  const { id_product } = req.params;
  try {
    const {
      id_category,
      id_gallery,
      title,
      price,
      discount,
      size,
      description,
    } = req.body;

    let product = await model.product.findByPk(id_product);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    if (
      !id_category ||
      !id_gallery ||
      !title ||
      !price ||
      !size ||
      !description
    ) {
      return res.status(400).json({
        message: "Các thông tin không được để trống",
        data: null,
      });
    }

    if (discount !== undefined && discount !== null) {
      if (isNaN(discount) || discount >= 100) {
        return res.status(400).json({
          message: "Giảm giá phải là số và nhỏ hơn 100",
          data: null,
        });
      }
    }

    const category = await model.category.findByPk(id_category);
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const gallery = await model.gallery.findByPk(id_gallery);
    if (!gallery) {
      return res.status(404).json({ message: "Gallery không tồn tại" });
    }

    await model.product.update(
      {
        id_category,
        id_gallery,
        title,
        price,
        discount: discount || 0,
        size,
        description,
      },
      { where: { id_product } }
    );

    product = await model.product.findByPk(id_product);

    const productData = {
      id_product: product.id_product,
      id_category: product.id_category,
      name: category.name,
      gallery: {
        id_gallery: gallery.id_gallery,
        thumbnail:
          typeof gallery.thumbnail === "string"
            ? JSON.parse(gallery.thumbnail)
            : gallery.thumbnail,
      },
      title: product.title,
      price: product.price,
      discount: product.discount,
      size: product.size,
      description: product.description
        ? product.description.split(". ").filter(Boolean)
        : [],
      updated_at: product.updated_at,
    };

    return res
      .status(200)
      .json({ message: "Cập nhật sản phẩm thành công", data: productData });
  } catch (err) {
    return res
      .status(400)
      .json({ message: "Lỗi khi cập nhật sản phẩm", error: err.message });
  }
};

// Lấy danh sách sản phẩm theo danh mục
const getProductByCategory = async (req, res) => {
  try {
    const { id_category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const category = await model.category.findByPk(id_category);
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const { count, rows: listProduct } = await model.product.findAndCountAll({
      where: { id_category },
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["id_category", "name"],
        },
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["id_gallery", "name", "thumbnail"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!listProduct || listProduct.length === 0) {
      return res
        .status(404)
        .json({ message: "Không có sản phẩm nào trong danh mục này" });
    }

    const parsedProducts = listProduct.map((product) => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(
            productData.gallery.thumbnail
          );
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          productData.gallery.thumbnail = [];
        }
      }
      productData.description = productData.description
        ? productData.description.split(". ").filter(Boolean)
        : [];
      return productData;
    });

    return res.status(200).json({
      message: "success",
      data: parsedProducts,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return res.status(400).json({ message: "error", error: err.message });
  }
};

// Lấy thông tin sản phẩm theo id
const getProductById = async (req, res) => {
  try {
    const { id_product } = req.params;

    if (!id_product || isNaN(id_product)) {
      return res.status(400).json({ message: "Mã sản phẩm không hợp lệ" });
    }

    const product = await model.product.findOne({
      where: { id_product },
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["id_category", "name"],
        },
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["id_gallery", "name", "thumbnail"],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const productData = product.toJSON();
    if (productData.gallery && productData.gallery.thumbnail) {
      try {
        productData.gallery.thumbnail = JSON.parse(
          productData.gallery.thumbnail
        );
      } catch (error) {
        console.error("Lỗi parse thumbnail:", error.message);
        productData.gallery.thumbnail = [];
      }
    }
    productData.description = productData.description
      ? productData.description.split(". ").filter(Boolean)
      : [];

    return res.status(200).json({
      message: "Lấy thông tin sản phẩm thành công",
      data: productData,
    });
  } catch (err) {
    console.error("Error fetching product by ID:", err.message);
    return res.status(400).json({
      message: "Lỗi khi lấy thông tin sản phẩm",
      error: err.message,
    });
  }
};

// Lấy danh sách sản phẩm theo tên sản phẩm
const getProductByName = async (req, res) => {
  try {
    const { title } = req.params;
    const listProduct = await model.product.findAll({
      where: { title: { [Op.like]: `%${title}%` } },
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["id_category", "name"],
        },
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["id_gallery", "name", "thumbnail"],
        },
      ],
    });

    if (!listProduct || listProduct.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm nào với tên này" });
    }

    const parsedProducts = listProduct.map((product) => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(
            productData.gallery.thumbnail
          );
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          productData.gallery.thumbnail = [];
        }
      }
      productData.description = productData.description
        ? productData.description.split(". ").filter(Boolean)
        : [];
      return productData;
    });

    return res.status(200).json({ message: "success", data: parsedProducts });
  } catch (err) {
    return res.status(400).json({ message: "error", error: err.message });
  }
};

// Lấy danh sách sản phẩm thông qua từ khóa tìm kiếm
const getProductByKeyword = async (req, res) => {
  try {
    const { keyword } = req.params;
    const { id_category, page = 1, limit = 10 } = req.query;
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      return res
        .status(400)
        .json({ message: "Từ khóa tìm kiếm không được để trống" });
    }

    const whereConditions = {
      [Op.or]: [
        { title: { [Op.like]: `%${trimmedKeyword}%` } },
        { price: { [Op.eq]: parseFloat(trimmedKeyword) || 0 } },
        { discount: { [Op.eq]: parseFloat(trimmedKeyword) || 0 } },
        { size: { [Op.like]: `%${trimmedKeyword}%` } },
        { description: { [Op.like]: `%${trimmedKeyword}%` } },
      ],
    };

    if (id_category) {
      whereConditions.id_category = id_category;
    }

    const offset = (page - 1) * limit;
    const { count, rows: listProduct } = await model.product.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["id_category", "name"],
        },
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["id_gallery", "name", "thumbnail"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!listProduct || listProduct.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm nào với từ khóa này" });
    }

    const parsedProducts = listProduct.map((product) => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(
            productData.gallery.thumbnail
          );
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          productData.gallery.thumbnail = [];
        }
      }
      productData.description = productData.description
        ? productData.description.split(". ").filter(Boolean)
        : [];
      return productData;
    });

    return res.status(200).json({
      message: "success",
      data: parsedProducts,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching products by keyword:", err.message);
    return res
      .status(400)
      .json({ message: "Lỗi khi tìm kiếm sản phẩm", error: err.message });
  }
};

// Lấy danh sách sản phẩm theo tên danh mục
const getProductByCategoryName = async (req, res) => {
  try {
    const { name } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const category = await model.category.findOne({
      where: { name: { [Op.like]: `%${name}%` } },
    });

    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const { count, rows: listProduct } = await model.product.findAndCountAll({
      where: { id_category: category.id_category },
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["id_category", "name"],
        },
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["id_gallery", "name", "thumbnail"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!listProduct || listProduct.length === 0) {
      return res
        .status(404)
        .json({ message: "Không có sản phẩm nào trong danh mục này" });
    }

    const parsedProducts = listProduct.map((product) => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(
            productData.gallery.thumbnail
          );
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          productData.gallery.thumbnail = [];
        }
      }
      productData.description = productData.description
        ? productData.description.split(". ").filter(Boolean)
        : [];
      return productData;
    });

    return res.status(200).json({
      message: "success",
      data: parsedProducts,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return res.status(400).json({ message: "error", error: err.message });
  }
};

export {
  getAllProducts,
  addProduct,
  deleteProduct,
  updateProduct,
  getProductByCategory,
  getProductById,
  getProductByName,
  getProductByKeyword,
  getProductByCategoryName,
};