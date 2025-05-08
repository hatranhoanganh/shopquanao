import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import { Op } from "sequelize";
import Sequelize from 'sequelize';
import { format } from 'date-fns';
import unidecode from 'unidecode';
import fs from "fs";
import moment from "moment";
import product from "../models/orders.js";
import { title } from "process";

const model = initModels(sequelize);

// Hàm thêm sản phẩm vào giỏ hàng
const addToCart = async (req, res) => {
  try {
    const { id_user, id_product, quantity, note } = req.body;
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra vai trò: chỉ user mới được thêm sản phẩm vào giỏ hàng
    if (userRole !== "user") {
      return res.status(403).json({
        message: "Chỉ người dùng thông thường mới có quyền thực hiện hành động này",
      });
    }

    // 2. Kiểm tra dữ liệu đầu vào
    if (!id_user || !id_product || !quantity) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ thông tin: id_user, id_product, quantity",
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "Số lượng phải là số nguyên lớn hơn 0" });
    }

    // 3. Kiểm tra quyền: id_user trong body phải khớp với id_user trong token
    if (parseInt(id_user) !== userIdFromToken) {
      return res.status(403).json({
        message: "Bạn không có quyền thêm sản phẩm vào giỏ hàng của người dùng khác",
      });
    }

    // 4. Kiểm tra người dùng có tồn tại không
    const userExist = await model.user.findOne({
      where: { id_user },
    });
    if (!userExist) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // 5. Kiểm tra sản phẩm có tồn tại không
    const productExist = await model.product.findOne({
      where: { id_product },
      include: [
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["thumbnail"],
        },
      ],
    });
    if (!productExist) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // 6. Kiểm tra giá sản phẩm và áp dụng giảm giá
    if (!productExist.price || productExist.price <= 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ" });
    }

    const discount = productExist.discount || 0;
    const finalPrice = productExist.price * (1 - discount / 100);
    if (finalPrice <= 0) {
      return res.status(400).json({ message: "Giá sản phẩm sau giảm giá không hợp lệ" });
    }

    // 7. Tìm hoặc tạo mới đơn hàng (status: "cart")
    let order = await model.orders.findOne({
      where: {
        id_user,
        status: "cart",
      },
    });

    if (!order) {
      order = await model.orders.create({
        id_user,
        order_date: new Date(),
        status: "cart",
        note: note || null,
      });
    } else if (note) {
      order.note = note;
      await order.save();
    }

    // 8. Kiểm tra xem sản phẩm đã có trong chi tiết đơn hàng chưa
    let orderProduct = await model.order_product.findOne({
      where: {
        id_order: order.id_order,
        id_product,
      },
    });

    if (orderProduct) {
      orderProduct.quantity += quantity;
      orderProduct.total_money = orderProduct.quantity * finalPrice;
      await orderProduct.save();
    } else {
      orderProduct = await model.order_product.create({
        id_order: order.id_order,
        id_product,
        quantity,
        total_money: quantity * finalPrice,
      });
    }

    // 9. Xử lý thumbnail
    let thumbnail = productExist.gallery?.thumbnail || null;
    if (thumbnail && typeof thumbnail === "string") {
      try {
        thumbnail = JSON.parse(thumbnail);
      } catch (error) {
        console.error("Lỗi parse thumbnail:", error.message);
        thumbnail = [];
      }
    }

    // 10. Trả về kết quả
    return res.status(200).json({
      message: "Thêm sản phẩm vào giỏ hàng thành công",
      data: {
        order_id: order.id_order,
        product_id: orderProduct.id_product,
        quantity: orderProduct.quantity,
        total_money: orderProduct.total_money,
        product_details: {
          title: productExist.title,
          size: productExist.size,
          price: productExist.price,
          discount: productExist.discount,
          thumbnail: thumbnail || [],
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi thêm sản phẩm vào giỏ hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi thêm sản phẩm vào giỏ hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Hàm đặt hàng
const placeOrder = async (req, res) => {
  try {
    const { id_user, note } = req.body;
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra vai trò: chỉ user mới được đặt hàng
    if (userRole !== "user") {
      return res.status(403).json({
        message: "Chỉ người dùng thông thường mới có quyền thực hiện hành động này",
      });
    }

    // 2. Kiểm tra dữ liệu đầu vào
    if (!id_user) {
      return res.status(400).json({ message: "Vui lòng cung cấp id_user" });
    }

    // 3. Kiểm tra quyền: id_user trong body phải khớp với id_user trong token
    if (parseInt(id_user) !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền đặt hàng cho người dùng khác" });
    }

    // 4. Kiểm tra người dùng có tồn tại không
    const userExist = await model.user.findOne({
      where: { id_user },
    });
    if (!userExist) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // 5. Tìm đơn hàng có trạng thái "cart"
    const order = await model.orders.findOne({
      where: {
        id_user,
        status: "cart",
      },
    });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng" });
    }

    // 6. Kiểm tra xem đơn hàng có sản phẩm không
    const orderProducts = await model.order_product.findAll({
      where: {
        id_order: order.id_order,
      },
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
    });
    if (!orderProducts || orderProducts.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống, không thể đặt hàng" });
    }

    // 7. Tính tổng tiền của đơn hàng
    const totalOrderMoney = orderProducts.reduce((sum, item) => sum + (item.total_money || 0), 0);

    // 8. Cập nhật trạng thái đơn hàng thành "pending"
    order.status = "pending";
    order.order_date = new Date();
    if (note) {
      order.note = note;
    }
    await order.save();

    // 9. Trả về thông tin đơn hàng đã xác nhận
    return res.status(200).json({
      message: "Đặt hàng thành công, đang chờ xác nhận",
      data: {
        order_id: order.id_order,
        user_id: order.id_user,
        user_fullname: userExist.fullname,
        order_date: order.order_date,
        status: order.status,
        note: order.note,
        total_money: totalOrderMoney,
        products: orderProducts.map((item) => {
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
      },
    });
  } catch (error) {
    console.error("Lỗi khi đặt hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi đặt hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

  // Hàm lấy danh sách đơn hàng của một người dùng dựa trên từ khóa với phân trang
const getOrderByKeyWordUser = async (req, res) => {
  try {
    const { keyword } = req.params; // Lấy keyword từ params
    const { page = 1, limit = 10 } = req.query; // Lấy page, limit từ query
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra dữ liệu đầu vào
    if (!keyword) {
      return res.status(400).json({ message: "Vui lòng cung cấp từ khóa tìm kiếm" });
    }

    const normalizedKeyword = decodeURIComponent(keyword).trim();
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ message: "Trang phải là số nguyên dương" });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: "Giới hạn phải là số nguyên từ 1 đến 100" });
    }

    const offset = (pageNum - 1) * limitNum;

    // 2. Tìm người dùng dựa trên từ khóa
    const userExist = await model.user.findOne({
      where: {
        [Op.or]: [
          { fullname: { [Op.like]: `%${normalizedKeyword}%` } },
          { email: { [Op.like]: `%${normalizedKeyword}%` } },
          { phone_number: { [Op.like]: `%${normalizedKeyword}%` } },
          { address: { [Op.like]: `%${normalizedKeyword}%` } },
        ],
      },
      attributes: ["id_user", "fullname", "email", "phone_number", "address"],
    });

    if (!userExist) {
      return res.status(404).json({ message: "Không tìm thấy người dùng khớp với từ khóa" });
    }

    const userId = userExist.id_user;

    // 3. Kiểm tra quyền: nếu không phải admin và id_user không khớp với id_user trong token
    if (userRole !== "admin" && userId !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền xem đơn hàng của người dùng khác" });
    }

    // 4. Tìm đơn hàng với phân trang
    const { count, rows: orders } = await model.orders.findAndCountAll({
      where: { id_user: userId },
      limit: limitNum,
      offset: offset,
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

    // 5. Nếu không có đơn hàng nào
    if (!orders || orders.length === 0) {
      return res.status(200).json({
        message: "Không tìm thấy đơn hàng đã đặt",
        data: [],
        pagination: {
          totalItems: count,
          currentPage: pageNum,
          pageSize: limitNum,
          totalPages: Math.ceil(count / limitNum),
          hasNextPage: pageNum < Math.ceil(count / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    }

    // 6. Lấy thông tin chi tiết cho từng đơn hàng
    const orderList = orders.map((order) => {
      const orderData = order.toJSON();
      const totalOrderMoney = orderData.order_products.reduce(
        (sum, item) => sum + (item.total_money || 0),
        0
      );
      return {
        order_id: orderData.id_order,
        user: {
          id_user: userExist.id_user,
          fullname: userExist.fullname,
          email: userExist.email,
          phone_number: userExist.phone_number,
          address: userExist.address,
        },
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

    // 7. Trả về danh sách đơn hàng với phân trang
    return res.status(200).json({
      message: "Lấy danh sách đơn hàng thành công",
      data: orderList,
      pagination: {
        totalItems: count,
        currentPage: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(count / limitNum),
        hasNextPage: pageNum < Math.ceil(count / limitNum),
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đơn hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách đơn hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

// const getAllOrders = async (req, res) => {
//   try {
//     // 1. Kiểm tra và xử lý tham số phân trang
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;

//     if (isNaN(page) || page < 1) {
//       return res.status(400).json({ message: "Trang phải là số nguyên dương" });
//     }
//     if (isNaN(limit) || limit < 1 || limit > 100) {
//       return res.status(400).json({ message: "Giới hạn phải là số nguyên từ 1 đến 100" });
//     }

//     const offset = (page - 1) * limit;

//     // 2. Tìm tất cả đơn hàng với phân trang
//     const result = await model.orders.findAndCountAll({
//       where: {
//         status: { [Op.in]: ["pending", "confirmed", "delivering", "delivered", "canceled"] },
//       },
//       include: [
//         {
//           model: model.user,
//           as: "user",
//           attributes: ["id_user", "fullname", "email", "phone_number", "address"],
//         },
//       ],
//       limit,
//       offset,
//     });

//     const orders = result.rows;
//     const totalItems = result.count;

//     // 3. Nếu không có đơn hàng nào
//     if (!orders || orders.length === 0) {
//       return res.status(404).json({ message: "Không tìm thấy đơn hàng đã đặt" });
//     }

//     // 4. Lấy thông tin chi tiết cho từng đơn hàng
//     const orderList = await Promise.all(
//       orders.map(async (order) => {
//         const orderProducts = await model.order_product.findAll({
//           where: { id_order: order.id_order },
//           include: [
//             {
//               model: model.product,
//               as: "id_product_product",
//               attributes: ["title", "size", "price", "discount"],
//             },
//           ],
//         });

//         const totalOrderMoney = orderProducts.reduce(
//           (sum, item) => sum + (item.total_money || 0),
//           0
//         );

//         return {
//           order_id: order.id_order,
//           user: {
//             id_user: order.user.id_user,
//             fullname: order.user.fullname,
//             email: order.user.email,
//             phone_number: order.user.phone_number,
//             address: order.user.address,
//           },
//           order_date: order.order_date,
//           status: order.status,
//           note: order.note,
//           total_money: totalOrderMoney,
//           products: orderProducts.map((item) => ({
//             product_id: item.id_product,
//             quantity: item.quantity,
//             total_money: item.total_money,
//             product_details: {
//               title: item.id_product_product.title,
//               size: item.id_product_product.size,
//               price: item.id_product_product.price,
//               discount: item.id_product_product.discount,
//             },
//           })),
//         };
//       })
//     );

//     // 5. Tính toán thông tin phân trang
//     const totalPages = Math.ceil(totalItems / limit);
//     const pagination = {
//       currentPage: page,
//       pageSize: limit,
//       totalItems,
//       totalPages,
//       hasNextPage: page < totalPages,
//       hasPrevPage: page > 1,
//     };

//     // 6. Trả về danh sách đơn hàng với thông tin phân trang
//     return res.status(200).json({
//       message: "Lấy danh sách tất cả đơn hàng thành công",
//       data: orderList,
//       pagination,
//     });
//   } catch (error) {
//     console.error("Lỗi khi lấy danh sách tất cả đơn hàng:", error);
//     return res.status(500).json({
//       message: "Lỗi server khi lấy danh sách tất cả đơn hàng",
//       error: error.message,
//       stack: error.stack,
//     });
//   }
// };




// Hàm hủy đơn hàng
// Hàm hủy đơn hàng
const cancelOrder = async (req, res) => {
  try {
    const { id_order, id_user } = req.body;
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra vai trò: chỉ user mới được hủy đơn hàng
    if (userRole !== "user") {
      return res.status(403).json({
        message: "Chỉ người dùng thông thường mới có quyền thực hiện hành động này",
      });
    }

    // 2. Kiểm tra dữ liệu đầu vào
    if (!id_order || !id_user) {
      return res.status(400).json({ message: "Vui lòng cung cấp id_order và id_user" });
    }

    const orderId = parseInt(id_order, 10);
    const userId = parseInt(id_user, 10);
    if (isNaN(orderId) || isNaN(userId)) {
      return res.status(400).json({ message: "id_order và id_user phải là số nguyên hợp lệ" });
    }

    // 3. Kiểm tra quyền: id_user trong body phải khớp với id_user trong token
    if (userId !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền hủy đơn hàng của người dùng khác" });
    }

    // 4. Kiểm tra người dùng có tồn tại không
    const userExist = await model.user.findOne({
      where: { id_user: userId },
      attributes: ["id_user", "fullname", "email", "phone_number", "address"],
    });
    if (!userExist) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // 5. Tìm đơn hàng
    const order = await model.orders.findOne({
      where: {
        id_order: orderId,
        id_user: userId,
      },
    });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn hàng này" });
    }

    // 6. Kiểm tra trạng thái đơn hàng
    if (order.status !== "pending" && order.status !== "confirmed") {
      return res.status(400).json({ 
        message: `Chỉ có thể hủy đơn hàng ở trạng thái 'pending' hoặc 'confirmed'. Trạng thái hiện tại: ${order.status}` 
      });
    }

    // 7. Cập nhật trạng thái đơn hàng thành "canceled"
    order.status = "canceled";
    await order.save();

    // 8. Lấy thông tin chi tiết đơn hàng sau khi hủy
    const orderProducts = await model.order_product.findAll({
      where: { id_order: order.id_order },
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
    });

    const totalOrderMoney = orderProducts.reduce(
      (sum, item) => sum + (item.total_money || 0),
      0
    );

    // 9. Trả về thông tin đơn hàng đã hủy
    return res.status(200).json({
      message: "Hủy đơn hàng thành công",
      data: {
        order_id: order.id_order,
        user: {
          id_user: userExist.id_user,
          fullname: userExist.fullname,
          email: userExist.email,
          phone_number: userExist.phone_number,
          address: userExist.address,
        },
        order_date: order.order_date,
        status: order.status,
        note: order.note,
        total_money: totalOrderMoney,
        products: orderProducts.map((item) => {
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
      },
    });
  } catch (error) {
    console.error("Lỗi khi hủy đơn hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi hủy đơn hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Hàm xóa đơn hàng
const deleteOrder = async (req, res) => {
  try {
    const { id_order } = req.params; // Lấy id_order từ URL params

    // 1. Kiểm tra dữ liệu đầu vào
    if (!id_order) {
      return res.status(400).json({ message: "Vui lòng cung cấp id_order trong URL" });
    }

    // Chuyển id_order thành số nguyên và kiểm tra
    const orderId = parseInt(id_order, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "id_order phải là số nguyên hợp lệ" });
    }

    // 2. Tìm đơn hàng và thông tin liên quan trước khi xóa
    const order = await model.orders.findOne({
      where: { id_order: orderId },
      include: [
        {
          model: model.user,
          as: "user",
          attributes: ["id_user", "fullname", "email", "phone_number", "address"],
        },
      ],
    });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // 3. Kiểm tra trạng thái đơn hàng
    if (order.status !== "canceled") {
      return res.status(400).json({ message: "Chỉ có thể xóa đơn hàng đã ở trạng thái 'canceled'" });
    }

    // 4. Lấy chi tiết đơn hàng (order_product) trước khi xóa
    const orderProducts = await model.order_product.findAll({
      where: { id_order: orderId },
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
    });

    // 5. Tính tổng tiền của đơn hàng
    const totalOrderMoney = orderProducts.reduce(
      (sum, item) => sum + (item.total_money || 0),
      0
    );

    // 6. Xóa tất cả chi tiết đơn hàng trong bảng order_product
    await model.order_product.destroy({
      where: { id_order: orderId },
    });

    // 7. Xóa đơn hàng trong bảng orders
    await model.orders.destroy({
      where: { id_order: orderId },
    });

    // 8. Trả về thông tin chi tiết trước khi xóa
    return res.status(200).json({
      message: "Xóa đơn hàng thành công",
      data: {
        order_id: order.id_order,
        user: {
          id_user: order.user.id_user,
          fullname: order.user.fullname,
          email: order.user.email,
          phone_number: order.user.phone_number,
          address: order.user.address,
        },
        order_date: order.order_date,
        status: order.status,
        note: order.note,
        total_money: totalOrderMoney,
        products: orderProducts.map((item) => {
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
      },
    });
  } catch (error) {
    console.error("Lỗi khi xóa đơn hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi xóa đơn hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Hàm cập nhật trạng thái đơn hàng thành "confirmed", "delivering", "delivered" hoặc "failed"
const confirmOrder = async (req, res) => {
  try {
    const { id_order } = req.params; // Lấy id_order từ URL params
    const body = req.body || {}; // Đảm bảo req.body không undefined
    const { deliveryStatus } = body; // Phân rã an toàn

    // 1. Kiểm tra dữ liệu đầu vào
    if (!id_order) {
      return res.status(400).json({ message: "Vui lòng cung cấp id_order trong URL" });
    }

    // Chuyển id_order thành số nguyên và kiểm tra
    const orderId = parseInt(id_order, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "id_order phải là số nguyên hợp lệ" });
    }

    // 2. Tìm đơn hàng và thông tin liên quan
    const order = await model.orders.findOne({
      where: { id_order: orderId },
      include: [
        {
          model: model.user,
          as: "user",
          attributes: ["id_user", "fullname", "email", "phone_number", "address"],
        },
      ],
    });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // 3. Kiểm tra và cập nhật trạng thái đơn hàng
    if (order.status === "pending") {
      order.status = "confirmed";
    } else if (order.status === "confirmed") {
      order.status = "delivering";
    } else if (order.status === "delivering") {
      // Kiểm tra deliveryStatus khi trạng thái là delivering
      if (!deliveryStatus) {
        return res.status(400).json({ 
          message: "Vui lòng cung cấp deliveryStatus (success hoặc failed) khi đơn hàng đang ở trạng thái delivering" 
        });
      }
      if (deliveryStatus === "success") {
        order.status = "delivered";
      } else if (deliveryStatus === "failed") {
        order.status = "failed";
      } else {
        return res.status(400).json({ 
          message: "deliveryStatus không hợp lệ, phải là 'success' hoặc 'failed'" 
        });
      }
    } else {
      return res.status(400).json({ 
        message: `Không thể xác nhận đơn hàng với trạng thái hiện tại: ${order.status}` 
      });
    }

    // 4. Lưu trạng thái đơn hàng đã cập nhật
    await order.save();

    // 5. Lấy chi tiết đơn hàng (order_product)
    const orderProducts = await model.order_product.findAll({
      where: { id_order: orderId },
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
    });

    // 6. Tính tổng tiền của đơn hàng
    const totalOrderMoney = orderProducts.reduce(
      (sum, item) => sum + (item.total_money || 0),
      0
    );

    // 7. Trả về thông tin chi tiết đơn hàng
    return res.status(200).json({
      message: "Cập nhật trạng thái đơn hàng thành công",
      data: {
        order_id: order.id_order,
        user: {
          id_user: order.user.id_user,
          fullname: order.user.fullname,
          email: order.user.email,
          phone_number: order.user.phone_number,
          address: order.user.address,
        },
        order_date: order.order_date,
        status: order.status,
        note: order.note,
        total_money: totalOrderMoney,
        products: orderProducts.map((item) => {
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
      },
    });
  } catch (error) {
    console.error("Lỗi khi xác nhận đơn hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi xác nhận đơn hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Hàm xóa sản phẩm khỏi giỏ hàng
const removeFromCart = async (req, res) => {
  try {
    const { id_user, id_product } = req.params; // Lấy id_user và id_product từ URL params
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra dữ liệu đầu vào
    if (!id_user || !id_product) {
      return res.status(400).json({ message: "Vui lòng cung cấp id_user và id_product trong URL" });
    }

    const userId = parseInt(id_user, 10);
    const productId = parseInt(id_product, 10);
    if (isNaN(userId) || isNaN(productId)) {
      return res.status(400).json({ message: "id_user và id_product phải là số nguyên hợp lệ" });
    }

    // 2. Kiểm tra quyền
    if (userRole !== "user" && userId !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền xóa sản phẩm khỏi giỏ hàng của người dùng khác" });
    }

    // 3. Kiểm tra người dùng có tồn tại không
    const userExist = await model.user.findOne({
      where: { id_user: userId },
    });
    if (!userExist) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // 4. Kiểm tra sản phẩm có tồn tại không
    const productExist = await model.product.findOne({
      where: { id_product: productId },
      include: [
        {
          model: model.gallery,
          as: "gallery",
          attributes: ["thumbnail"],
        },
      ],
    });
    if (!productExist) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // 5. Tìm đơn hàng "cart" của người dùng
    const cartOrder = await model.orders.findOne({
      where: {
        id_user: userId,
        status: "cart",
      },
    });
    if (!cartOrder) {
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng (đơn hàng với trạng thái 'cart') của bạn" });
    }

    // 6. Kiểm tra sản phẩm có trong đơn hàng không
    const orderProduct = await model.order_product.findOne({
      where: {
        id_order: cartOrder.id_order,
        id_product: productId,
      },
    });
    if (!orderProduct) {
      return res.status(404).json({ message: "Sản phẩm không có trong giỏ hàng của bạn" });
    }

    // 7. Xử lý thumbnail
    let thumbnail = productExist.gallery?.thumbnail || null;
    if (thumbnail && typeof thumbnail === "string") {
      try {
        thumbnail = JSON.parse(thumbnail);
      } catch (error) {
        console.error("Lỗi parse thumbnail:", error.message);
        thumbnail = [];
      }
    }

    // 8. Xóa sản phẩm khỏi bảng order_product
    await model.order_product.destroy({
      where: {
        id_order: cartOrder.id_order,
        id_product: productId,
      },
    });

    // 9. Kiểm tra xem đơn hàng còn sản phẩm nào không
    const remainingProducts = await model.order_product.findAll({
      where: { id_order: cartOrder.id_order },
    });

    if (remainingProducts.length === 0) {
      await model.orders.destroy({
        where: { id_order: cartOrder.id_order },
      });
    }

    // 10. Trả về thông báo thành công
    return res.status(200).json({
      message: "Xóa sản phẩm khỏi giỏ hàng thành công",
      data: {
        id_user: userId,
        product_id: productId,
        product_details: {
          title: productExist.title,
          size: productExist.size,
          price: productExist.price,
          discount: productExist.discount,
          thumbnail: thumbnail || [],
        },
      },
    });
  } catch (error) {
    console.error("Lỗi khi xóa sản phẩm khỏi giỏ hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi xóa sản phẩm khỏi giỏ hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};



// Hàm lấy danh sách đơn hàng theo trạng thái
const getOrderByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!status || !["pending", "confirmed", "delivering", "delivered","failed", "canceled"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ (phải là pending, confirmed, delivering, delivered hoặc canceled)" });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: orders } = await model.orders.findAndCountAll({
      where: { status },
      include: [
        {
          model: model.user,
          as: "user",
          attributes: ["id_user", "fullname", "email", "phone_number", "address"],
        },
        {
          model: model.order_product,
          as: "order_products",
          required: false,
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
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        message: `Không tìm thấy đơn hàng nào với trạng thái ${status}`,
        data: [],
        pagination: {
          totalItems: 0,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          totalPages: 0,
        },
      });
    }

    const orderList = orders.map((order) => {
      const orderData = order.toJSON();
      const products = orderData.order_products || [];
      const totalOrderMoney = products.reduce(
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
        products: products.map((item) => {
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
            product_details: item.id_product_product
              ? {
                  title: item.id_product_product.title,
                  size: item.id_product_product.size,
                  price: item.id_product_product.price,
                  discount: item.id_product_product.discount,
                  thumbnail: thumbnail || [],
                }
              : {},
          };
        }),
      };
    });

    return res.status(200).json({
      message: `Lấy danh sách đơn hàng với trạng thái ${status} thành công`,
      data: orderList,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đơn hàng theo trạng thái:", error);
    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách đơn hàng theo trạng thái",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Hàm lấy đơn hàng theo mã đơn hàng với phân trang cho danh sách sản phẩm
const GetOrderByID = async (req, res) => {
  try {
    const { id_order } = req.params; // Lấy id_order từ params
    const { page = 1, limit = 10 } = req.query; // Lấy page, limit từ query
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra dữ liệu đầu vào
    const orderId = parseInt(id_order, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Mã đơn hàng phải là số nguyên hợp lệ" });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ message: "Trang phải là số nguyên dương" });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: "Giới hạn phải là số nguyên từ 1 đến 100" });
    }

    const offset = (pageNum - 1) * limitNum;

    // 2. Tìm đơn hàng
    const order = await model.orders.findOne({
      where: { id_order: orderId },
      include: [
        {
          model: model.user,
          as: "user",
          attributes: ["id_user", "fullname", "email", "phone_number", "address"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }

    // 3. Kiểm tra quyền: nếu không phải admin và id_user không khớp với id_user trong token
    if (userRole !== "admin" && order.id_user !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền xem đơn hàng này" });
    }

    // 4. Lấy danh sách sản phẩm trong đơn hàng với phân trang
    const { count, rows: orderProducts } = await model.order_product.findAndCountAll({
      where: { id_order: orderId },
      limit: limitNum,
      offset: offset,
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
    });

    // 5. Tính tổng tiền của đơn hàng
    const totalOrderMoney = orderProducts.reduce(
      (sum, item) => sum + (item.total_money || 0),
      0
    );

    // 6. Chuẩn bị dữ liệu trả về
    const orderData = {
      order_id: order.id_order,
      user: {
        id_user: order.user.id_user,
        fullname: order.user.fullname,
        email: order.user.email,
        phone_number: order.user.phone_number,
        address: order.user.address,
      },
      order_date: order.order_date,
      status: order.status,
      note: order.note,
      total_money: totalOrderMoney,
      products: orderProducts.map((item) => {
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

    // 7. Tạo thông tin phân trang
    const pagination = {
      totalItems: count,
      currentPage: pageNum,
      pageSize: limitNum,
      totalPages: Math.ceil(count / limitNum),
      hasNextPage: pageNum < Math.ceil(count / limitNum),
      hasPrevPage: pageNum > 1,
    };

    // 8. Trả về kết quả
    return res.status(200).json({
      message: "Lấy thông tin đơn hàng thành công",
      data: orderData,
      pagination,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin đơn hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi lấy thông tin đơn hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Export các hàm
export { addToCart, placeOrder, getOrderByKeyWordUser,  cancelOrder, deleteOrder, confirmOrder, removeFromCart,
  getOrderByStatus,GetOrderByID, };