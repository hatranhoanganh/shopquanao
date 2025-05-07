import sequelize from "../models/connect.js";
import initModels from "../models/init-models.js";
import { Op } from "sequelize";
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

    // 9. Trả về kết quả
    return res.status(200).json({
      message: "Thêm sản phẩm vào giỏ hàng thành công",
      data: {
        order_id: order.id_order,
        product_id: orderProduct.id_product,
        quantity: orderProduct.quantity,
        total_money: orderProduct.total_money,
        title: productExist.title,
        size: productExist.size,
        price: productExist.price,
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
        products: orderProducts.map((item) => ({
          product_id: item.id_product,
          quantity: item.quantity,
          total_money: item.total_money,
        })),
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

// Hàm lấy danh sách đơn hàng đã đặt của một người dùng
const getOrderList = async (req, res) => {
  try {
    const { id_user } = req.params; // Lấy id_user từ tham số URL
    const userIdFromToken = req.user.id_user; // Lấy id_user từ token
    const userRole = req.user.role; // Lấy role từ token

    // 1. Kiểm tra dữ liệu đầu vào
    if (!id_user) {
      return res.status(400).json({ message: "Vui lòng cung cấp id_user trong URL" });
    }

    const userId = parseInt(id_user, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "id_user phải là một số nguyên hợp lệ" });
    }

    // 2. Kiểm tra quyền: nếu không phải admin và id_user không khớp với id_user trong token
    if (userRole !== "admin" && userId !== userIdFromToken) {
      return res.status(403).json({ message: "Bạn không có quyền xem đơn hàng của người dùng khác" });
    }

    // 3. Kiểm tra người dùng có tồn tại không và lấy đầy đủ thông tin
    const userExist = await model.user.findOne({
      where: { id_user: userId },
      attributes: ["id_user", "fullname", "email", "phone_number", "address"],
    });
    if (!userExist) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // 4. Tìm tất cả đơn hàng có trạng thái "pending" hoặc "confirmed"
    const orders = await model.orders.findAll({
      where: {
        id_user: userId,
        status: { [Op.in]: ["pending", "confirmed"] },
      },
    });

    // 5. Nếu không có đơn hàng nào
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng đã đặt" });
    }

    // 6. Lấy thông tin chi tiết cho từng đơn hàng
    const orderList = await Promise.all(
      orders.map(async (order) => {
        const orderProducts = await model.order_product.findAll({
          where: { id_order: order.id_order },
          include: [
            {
              model: model.product,
              as: "id_product_product",
              attributes: ["title", "size", "price", "discount"],
            },
          ],
        });

        const totalOrderMoney = orderProducts.reduce(
          (sum, item) => sum + (item.total_money || 0),
          0
        );

        return {
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
          products: orderProducts.map((item) => ({
            product_id: item.id_product,
            quantity: item.quantity,
            total_money: item.total_money,
            product_details: {
              title: item.id_product_product.title,
              size: item.id_product_product.size,
              price: item.id_product_product.price,
              discount: item.id_product_product.discount,
            },
          })),
        };
      })
    );

    // 7. Trả về danh sách đơn hàng
    return res.status(200).json({
      message: "Lấy danh sách đơn hàng thành công",
      data: orderList,
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

// Hàm lấy danh sách tất cả đơn hàng của tất cả người dùng
const getAllOrders = async (req, res) => {
  try {
    // 1. Tìm tất cả đơn hàng có trạng thái "pending" hoặc "confirmed"
    const orders = await model.orders.findAll({
      where: {
        status: { [Op.in]: ["pending", "confirmed"] },
      },
      include: [
        {
          model: model.user,
          as: "user",
          attributes: ["id_user", "fullname", "email", "phone_number", "address"],
        },
      ],
    });

    // 2. Nếu không có đơn hàng nào
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng đã đặt" });
    }

    // 3. Lấy thông tin chi tiết cho từng đơn hàng
    const orderList = await Promise.all(
      orders.map(async (order) => {
        const orderProducts = await model.order_product.findAll({
          where: { id_order: order.id_order },
          include: [
            {
              model: model.product,
              as: "id_product_product",
              attributes: ["title", "size", "price", "discount"],
            },
          ],
        });

        const totalOrderMoney = orderProducts.reduce(
          (sum, item) => sum + (item.total_money || 0),
          0
        );

        return {
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
          products: orderProducts.map((item) => ({
            product_id: item.id_product,
            quantity: item.quantity,
            total_money: item.total_money,
            product_details: {
              title: item.id_product_product.title,
              size: item.id_product_product.size,
              price: item.id_product_product.price,
              discount: item.id_product_product.discount,
            },
          })),
        };
      })
    );

    // 4. Trả về danh sách đơn hàng
    return res.status(200).json({
      message: "Lấy danh sách tất cả đơn hàng thành công",
      data: orderList,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tất cả đơn hàng:", error);
    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách tất cả đơn hàng",
      error: error.message,
      stack: error.stack,
    });
  }
};

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
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Chỉ có thể hủy đơn hàng đang ở trạng thái 'pending'" });
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
        products: orderProducts.map((item) => ({
          product_id: item.id_product,
          quantity: item.quantity,
          total_money: item.total_money,
          product_details: {
            title: item.id_product_product.title,
            size: item.id_product_product.size,
            price: item.id_product_product.price,
            discount: item.id_product_product.discount,
          },
        })),
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
        products: orderProducts.map((item) => ({
          product_id: item.id_product,
          quantity: item.quantity,
          total_money: item.total_money,
          product_details: {
            title: item.id_product_product.title,
            size: item.id_product_product.size,
            price: item.id_product_product.price,
            discount: item.id_product_product.discount,
          },
        })),
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

// Hàm cập nhật trạng thái đơn hàng thành "confirmed"
const confirmOrder = async (req, res) => {
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

    // 3. Kiểm tra trạng thái đơn hàng
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Chỉ có thể xác nhận đơn hàng đang ở trạng thái 'pending'" });
    }

    // 4. Cập nhật trạng thái đơn hàng thành "confirmed"
    order.status = "confirmed";
    await order.save();

    // 5. Lấy chi tiết đơn hàng (order_product)
    const orderProducts = await model.order_product.findAll({
      where: { id_order: orderId },
      include: [
        {
          model: model.product,
          as: "id_product_product",
          attributes: ["title", "size", "price", "discount"],
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
      message: "Xác nhận đơn hàng thành công",
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
        products: orderProducts.map((item) => ({
          product_id: item.id_product,
          quantity: item.quantity,
          total_money: item.total_money,
          product_details: {
            title: item.id_product_product.title,
            size: item.id_product_product.size,
            price: item.id_product_product.price,
            discount: item.id_product_product.discount,
          },
        })),
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

// Hàm xóa sản phẩm khỏi giỏ hàng (từ bảng order_product và orders nếu cần)
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

    // 2. Kiểm tra quyền (đã được xử lý bởi userOnlyMiddleware, nhưng có thể thêm kiểm tra nếu mở rộng quyền sau này)
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

    // 7. Xóa sản phẩm khỏi bảng order_product
    await model.order_product.destroy({
      where: {
        id_order: cartOrder.id_order,
        id_product: productId,
      },
    });

    // 8. Kiểm tra xem đơn hàng còn sản phẩm nào không
    const remainingProducts = await model.order_product.findAll({
      where: { id_order: cartOrder.id_order },
    });

    if (remainingProducts.length === 0) {
      await model.orders.destroy({
        where: { id_order: cartOrder.id_order },
      });
    }

    // 9. Trả về thông báo thành công
    return res.status(200).json({
      message: "Xóa sản phẩm khỏi giỏ hàng thành công",
      data: {
        id_user: userId,
        id_product: productId,
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

// Hàm lấy danh sách đơn hàng theo từ khóa
const getOrderByKeyword = async (req, res) => {
  try {
    const { keyword } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      return res.status(400).json({ message: "Từ khóa tìm kiếm không được để trống" });
    }

    const offset = (page - 1) * limit;

    const whereConditions = {
      [Op.or]: [
        { id_order: { [Op.eq]: parseInt(trimmedKeyword) || 0 } },
        { note: { [Op.like]: `%${trimmedKeyword}%` } },
        { status: { [Op.like]: `%${trimmedKeyword}%` } },
        { total_money: { [Op.eq]: parseFloat(trimmedKeyword) || 0 } },
        {
          '$user.fullname$': { [Op.like]: `%${trimmedKeyword}%` },
        },
        {
          '$user.email$': { [Op.like]: `%${trimmedKeyword}%` },
        },
        {
          '$user.phone_number$': { [Op.like]: `%${trimmedKeyword}%` },
        },
        {
          '$user.address$': { [Op.like]: `%${trimmedKeyword}%` },
        },
      ],
    };

    const { count, rows: orders } = await model.orders.findAndCountAll({
      where: whereConditions,
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
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng nào với từ khóa này" });
    }

    const orderList = orders.map((order) => {
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
        products: orderData.order_products.map((item) => ({
          product_id: item.id_product,
          quantity: item.quantity,
          total_money: item.total_money,
          product_details: {
            title: item.id_product_product.title,
            size: item.id_product_product.size,
            price: item.id_product_product.price,
            discount: item.id_product_product.discount,
          },
        })),
      };
    });

    return res.status(200).json({
      message: "Lấy danh sách đơn hàng theo từ khóa thành công",
      data: orderList,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm đơn hàng theo từ khóa:", error);
    return res.status(500).json({
      message: "Lỗi server khi tìm kiếm đơn hàng",
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

    if (!status || !["pending", "confirmed", "canceled"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ (phải là pending, confirmed hoặc canceled)" });
    }

    const offset = (page - 1) * limit;

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
          include: [
            {
              model: model.product,
              as: "id_product_product",
              attributes: ["title", "size", "price", "discount"],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: `Không tìm thấy đơn hàng nào với trạng thái ${status}` });
    }

    const orderList = orders.map((order) => {
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
        products: orderData.order_products.map((item) => ({
          product_id: item.id_product,
          quantity: item.quantity,
          total_money: item.total_money,
          product_details: {
            title: item.id_product_product.title,
            size: item.id_product_product.size,
            price: item.id_product_product.price,
            discount: item.id_product_product.discount,
          },
        })),
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

// Export các hàm
export { addToCart, placeOrder, getOrderList, getAllOrders, cancelOrder, deleteOrder, confirmOrder, removeFromCart,getOrderByKeyword,
  getOrderByStatus, };