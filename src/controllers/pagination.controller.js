import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import dotenv from "dotenv";

dotenv.config();

const model = initModels(sequelize);

const getPaginatedData = async (req, res) => {
  let type = "unknown";
  try {
    console.log("req.query in getPaginatedData:", req.query);
    console.log("res.locals in getPaginatedData:", res.locals);
    const page = Math.max(1, parseInt(req.query.page, 10)) || 1;
    const limit = Math.max(1, parseInt(req.query.limit, 10)) || 10;
    const offset = (page - 1) * limit;
    type = res.locals?.type || req.query.type || "unknown";

    if (!type || !["products", "users"].includes(type)) {
      return res.status(400).json({ message: "Vui lòng cung cấp type hợp lệ (products hoặc users)" });
    }

    let data, totalItems;

    if (type === "products") {
      const result = await model.product.findAndCountAll({
        limit,
        offset,
        include: [
          {
            model: model.category,
            as: "category",
            attributes: ["id_category", "name"],
          },
          {
            model: model.gallery,
            as: "gallery", // Đổi từ "galleries" thành "gallery"
            attributes: ["id_gallery", "name", "thumbnail"],
          },
        ],
      });

      data = result.rows;
      totalItems = result.count;

      data = data.map((product) => {
        const productData = product.toJSON();
        if (productData.gallery && productData.gallery.thumbnail) {
          try {
            productData.gallery.thumbnail = JSON.parse(productData.gallery.thumbnail);
          } catch (error) {
            console.error("Lỗi parse thumbnail:", error.message);
            productData.gallery.thumbnail = [];
          }
        } else {
          productData.gallery = productData.gallery || null; // Đổi từ galleries thành gallery
        }
        return productData;
      });
    } else {
      const result = await model.user.findAndCountAll({
        limit,
        offset,
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

      data = result.rows.map((user) => user.toJSON());
      totalItems = result.count;
    }

    if (data.length === 0) {
      return res.status(404).json({
        message: `Không tìm thấy ${type === "products" ? "sản phẩm" : "người dùng"} nào`,
      });
    }

    const totalPages = Math.ceil(totalItems / limit);
    const pagination = {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      message: `Lấy danh sách ${type === "products" ? "sản phẩm" : "người dùng"} thành công`,
      data,
      pagination,
    });
  } catch (error) {
    console.error(`Lỗi khi lấy danh sách ${type}:`, error.message);
    return res.status(500).json({
      message: `Lỗi khi lấy danh sách ${type}`,
      error: error.message,
    });
  }
};

export { getPaginatedData };