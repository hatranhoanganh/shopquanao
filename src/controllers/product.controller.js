import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import { Op } from "sequelize";
import fs from "fs";
import moment from "moment";
import product from "../models/product.js";
import { title } from "process";

const model = initModels(sequelize);

// Lấy tất cả sản phẩm
const getProducts = async (req, res) => {
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

    // Parse thumbnail từ chuỗi JSON thành mảng
    const parsedProducts = listProducts.map((product) => {
      const productData = product.toJSON(); // Chuyển instance Sequelize thành object thuần
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(
            productData.gallery.thumbnail
          );
        } catch (error) {
          console.error("Lỗi parse thumbnail:", error.message);
          productData.gallery.thumbnail = []; // Trả về mảng rỗng nếu parse thất bại
        }
      }
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

// Xóa khóa học
const deleteProduct = async (req, res) => {
  try {
    const { id_product } = req.params;

    // Kiểm tra sản phẩm tồn tại
    const product = await model.product.findByPk(id_product);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Xóa các bản ghi liên quan trong bảng gallery
    await model.order_product.destroy({
      where: { id_product },
    });

    // Xóa sản phẩm
    await model.product.destroy({
      where: { id_product },
    });

    // Xóa ảnh nếu có
    if (product.id_gallery) {
      try {
        deleteUploadedFile("public/image/" + product.id_gallery);
      } catch (fileError) {
        console.error("Error deleting file:", fileError.message);
      }
    }

    return res.status(200).json({ message: "Xóa sản phẩm thành công!" });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    return res.status(400).json({
      message: "Error deleting product",
      error: error.message,
    });
  }
};

// Hàm xóa file đã upload done
const deleteUploadedFile = (filePath) => {
  try {
    if (filePath) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Error deleting course", error: error.message });
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

    // 1. Kiểm tra dữ liệu đầu vào
    if (
      !id_category ||
      !id_gallery ||
      !title ||
      !price ||
      !discount ||
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

    // 2. Kiểm tra danh mục tồn tại
    const category = await model.category.findByPk(id_category);
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    // 3. Kiểm tra gallery tồn tại
    const gallery = await model.gallery.findByPk(id_gallery);
    if (!gallery) {
      return res.status(404).json({ message: "Gallery không tồn tại" });
    }

    // 4. Validate price
    if (isNaN(price) || price < 1000) {
      deleteUploadedFile(req.file?.path); // Xóa file nếu giá không hợp lệ
      return res.status(400).json({
        message: "Giá phải là một số dương và ít nhất là 1,000",
        data: null,
      });
    }

    // 5. Tạo sản phẩm mới
    const newProduct = await model.product.create({
      id_category,
      id_gallery,
      title,
      price,
      discount,
      size,
      description,
    });

    // 6. Trả về thông tin sản phẩm với dữ liệu gallery
    const productData = {
      id_product: newProduct.id_product,
      id_category: newProduct.id_category,
      category_name: category.category_name, // Lấy tên danh mục
      gallery: {
        id_gallery: gallery.id_gallery,
        thumbnail: gallery.thumbnail, // Lấy thumbnail từ gallery
      },
      title: newProduct.title,
      price: newProduct.price,
      discount: newProduct.discount,
      size: newProduct.size,
      description: newProduct.description,
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

    // 1. Kiểm tra xem sản phẩm có tồn tại không
    let product = await model.product.findByPk(id_product);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // 2. Kiểm tra các trường cần thiết
    if (
      !id_category ||
      !id_gallery ||
      !title ||
      !price ||
      !discount ||
      !size ||
      !description
    ) {
      return res.status(400).json({
        message: "Các thông tin không được để trống",
        data: null,
      });
    }

    // 3. Kiểm tra danh mục tồn tại
    const category = await model.category.findByPk(id_category);
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    // 4. Kiểm tra gallery tồn tại
    const gallery = await model.gallery.findByPk(id_gallery);
    if (!gallery) {
      return res.status(404).json({ message: "Gallery không tồn tại" });
    }

    // 5. Cập nhật sản phẩm
    await model.product.update(
      {
        id_category,
        id_gallery,
        title,
        price,
        discount,
        size,
        description,
      },
      { where: { id_product } }
    );

    // 6. Lấy lại thông tin sản phẩm đã cập nhật
    product = await model.product.findByPk(id_product);

    // 7. Trả về thông tin sản phẩm với dữ liệu gallery
    const productData = {
      id_product: product.id_product,
      id_category: product.id_category,
      category_name: category.category_name, // Lấy tên danh mục
      gallery: {
        id_gallery: gallery.id_gallery,
        thumbnail: gallery.thumbnail, // Lấy thumbnail từ gallery
      },
      title: product.title,
      price: product.price,
      discount: product.discount,
      size: product.size,
      description: product.description,
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

//Lấy danh sách sản phẩm theo danh mục done
const getProductByCategory = async (req, res) => {
  try {
    const { id_category } = req.params;

    const category = await model.category.findByPk(id_category);
    if (!category) {
      return res.status(404).json({ message: "Danh mục không tồn tại" });
    }

    const listProduct = await model.product.findAll({
      where: { id_category },
      include: [
        {
          model: model.category,
          as: "category",
          attributes: ["name"],
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
        .json({ message: "Không có sản phẩm nào trong danh mục này" });
    }

    // Parse thumbnail từ chuỗi JSON thành mảng
    const parsedProducts = listProduct.map(product => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(productData.gallery.thumbnail);
        } catch (error) {
          console.error('Lỗi parse thumbnail:', error.message);
          productData.gallery.thumbnail = []; // Trả về mảng rỗng nếu parse thất bại
        }
      }
      return productData;
    });

    return res.status(200).json({ message: "success", data: parsedProducts });
  } catch (err) {
    return res.status(400).json({ message: "error", error: err.message });
  }
};

//Lấy thông tin sản phẩm theo id done
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

    // Parse thumbnail từ chuỗi JSON thành mảng
    const productData = product.toJSON(); // Chuyển instance Sequelize thành object thuần
    if (productData.gallery && productData.gallery.thumbnail) {
      try {
        productData.gallery.thumbnail = JSON.parse(productData.gallery.thumbnail);
      } catch (error) {
        console.error('Lỗi parse thumbnail:', error.message);
        productData.gallery.thumbnail = []; // Trả về mảng rỗng nếu parse thất bại
      }
    }

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

//Lấy danh sách khóa học theo tên sản phẩm
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

    // Parse thumbnail từ chuỗi JSON thành mảng
    const parsedProducts = listProduct.map(product => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(productData.gallery.thumbnail);
        } catch (error) {
          console.error('Lỗi parse thumbnail:', error.message);
          productData.gallery.thumbnail = []; // Trả về mảng rỗng nếu parse thất bại
        }
      }
      return productData;
    });

    return res.status(200).json({ message: "success", data: parsedProducts });
  } catch (err) {
    return res.status(400).json({ message: "error", error: err.message });
  }
};

//Lấy danh sách sản phẩm thông qua từ khóa tìm kiếm
const getProductByKeyword = async (req, res) => {
  try {
    const { keyword } = req.params;
    const listProduct = await model.product.findAll({
      where: {
        [Op.or]: [{ title: { [Op.like]: `%${keyword}%` } }],
      },
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
        .json({ message: "Không tìm thấy sản phẩm nào với từ khóa này" });
    }

    // Parse thumbnail từ chuỗi JSON thành mảng
    const parsedProducts = listProduct.map(product => {
      const productData = product.toJSON();
      if (productData.gallery && productData.gallery.thumbnail) {
        try {
          productData.gallery.thumbnail = JSON.parse(productData.gallery.thumbnail);
        } catch (error) {
          console.error('Lỗi parse thumbnail:', error.message);
          productData.gallery.thumbnail = []; // Trả về mảng rỗng nếu parse thất bại
        }
      }
      return productData;
    });

    return res.status(200).json({ message: "success", data: parsedProducts });
  } catch (err) {
    return res.status(400).json({ message: "error", error: err.message });
  }
};

export {
  getProducts,
  addProduct,
  deleteProduct,
  updateProduct,
  getProductByCategory,
  getProductById,
  getProductByName,
  getProductByKeyword,
};
