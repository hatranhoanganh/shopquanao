import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class order_product extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'orders',
        key: 'id_order'
      }
    },
    id_product: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'product',
        key: 'id_product'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    total_money: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'order_product',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id_order" },
          { name: "id_product" },
        ]
      },
      {
        name: "FK_OD_ORDER",
        using: "BTREE",
        fields: [
          { name: "id_order" },
        ]
      },
      {
        name: "FK_OD_PRODUCT",
        using: "BTREE",
        fields: [
          { name: "id_product" },
        ]
      },
    ]
  });
  }
}
