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

    // Kiểm tra và xử lý tham số page và limit
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (isNaN(page) || page < 1) {
      return res.status(400).json({ message: "Trang phải là số nguyên dương" });
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: "Giới hạn phải là số nguyên từ 1 đến 100" });
    }

    const offset = (page - 1) * limit;
    type = res.locals?.type || req.query.type || "unknown";

    if (!type || !["products", "users", "orders"].includes(type)) {
      return res.status(400).json({ message: "Vui lòng cung cấp type hợp lệ (products, users hoặc orders)" });
    }

    let data, totalItems;

    if (type === "products") {
      // Lấy id_category từ query nếu có
      const { id_category } = req.query;
      const where = id_category ? { id_category: parseInt(id_category) } : {};

      const result = await model.product.findAndCountAll({
        where,
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
            as: "gallery",
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
          productData.gallery = productData.gallery || null;
        }
        return productData;
      });
    } else if (type === "users") {
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
    } else if (type === "orders") {
      const result = await model.orders.findAndCountAll({
        limit,
        offset,
        include: [
          {
            model: model.user,
            as: "user",
            attributes: ["id_user", "fullname", "email", "phone_number", "address"],
          },
          {
            model: model.order_product,
            as: "order_products",
            include: [
              {
                model: model.product,
                as: "id_product_product",
                attributes: ["title", "size", "price", "discount"],
                include: [
                  {
                    model: model.gallery,
                    as: "gallery",
                    attributes: ["thumbnail"],
                  },
                ],
              },
            ],
          },
        ],
      });

      data = result.rows.map((order) => {
        const orderData = order.toJSON();
        const totalOrderMoney = orderData.order_products.reduce(
          (sum, item) => sum + (item.total_money || 0),
          0
        );
        return {
          order_id: orderData.id_order,
          user: orderData.user,
          order_date: orderData.order_date,
          status: orderData.status,
          note: orderData.note,
          total_money: totalOrderMoney,
          products: orderData.order_products.map((item) => {
            let thumbnail = item.id_product_product.gallery?.thumbnail || null;
            if (thumbnail && typeof thumbnail === "string") {
              try {
                thumbnail = JSON.parse(thumbnail);
              } catch (error) {
                console.error("Lỗi parse thumbnail:", error.message);
                thumbnail = [];
              }
            }
            return {
              product_id: item.id_product,
              quantity: item.quantity,
              total_money: item.total_money,
              product_details: {
                title: item.id_product_product.title,
                size: item.id_product_product.size,
                price: item.id_product_product.price,
                discount: item.id_product_product.discount,
                thumbnail: thumbnail || [],
              },
            };
          }),
        };
      });
      totalItems = result.count;
    }

    const totalPages = Math.ceil(totalItems / limit);
    const pagination = {
      currentPage: page,
      pageSize: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      message: `Lấy danh sách ${type === "products" ? "sản phẩm" : type === "users" ? "người dùng" : "đơn hàng"} thành công`,
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