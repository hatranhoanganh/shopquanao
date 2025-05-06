import _sequelize from "sequelize";
const DataTypes = _sequelize.DataTypes;
import _user from "./user.js";
import _category from "./category.js";
import _product from "./product.js";
import _gallery from "./gallery.js";
import _orders from "./orders.js";
import _order_product from "./order_product.js";

export default function initModels(sequelize) {
  const user = _user.init(sequelize, DataTypes);
  const category = _category.init(sequelize, DataTypes);
  const product = _product.init(sequelize, DataTypes);
  const gallery = _gallery.init(sequelize, DataTypes);
  const orders = _orders.init(sequelize, DataTypes);
  const order_product = _order_product.init(sequelize, DataTypes);

  // Quan hệ giữa product và category
  product.belongsTo(category, { foreignKey: "id_category" });
  category.hasMany(product, { foreignKey: "id_category" });

  // Quan hệ giữa product và gallery (một product thuộc về một gallery)
  product.belongsTo(gallery, { foreignKey: "id_gallery", as: "gallery" });
  gallery.hasMany(product, { foreignKey: "id_gallery" });

  // Quan hệ giữa user và orders
  user.hasMany(orders, { foreignKey: "id_user" });
  orders.belongsTo(user, { foreignKey: "id_user" });

  // Quan hệ giữa orders và order_product
  orders.hasMany(order_product, { foreignKey: "id_order" });
  order_product.belongsTo(orders, { foreignKey: "id_order" });

  // Quan hệ giữa product và order_product
  product.hasMany(order_product, { foreignKey: "id_product" });
  order_product.belongsTo(product, { foreignKey: "id_product", as: "id_product_product" });

  return {
    user,
    category,
    product,
    gallery,
    orders,
    order_product,
  };
}